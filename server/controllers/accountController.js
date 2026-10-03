// server/controllers/accountController.js

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const Tenant = require('../models/Tenant');
const { describeSpecialAccounts, sanitiseOverrides } = require('../utils/specialAccounts');

const getAccounts = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    // Chart-of-Accounts views pass excludeSubLedger=true so the per-person
    // ledgers (potentially hundreds) don't clutter the COA. Voucher/journal
    // pickers omit it, so party ledgers stay selectable for manual postings.
    if (req.query.excludeSubLedger === 'true') filter.isSubLedger = { $ne: true };
    const accounts = await Account.find(filter).sort({ code: 1 }).lean();
    res.json({ success: true, data: accounts, count: accounts.length });
  } catch (error) {
    console.error('[Accounts] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch accounts.' });
  }
};

const getAccountTree = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    // The chart-of-accounts tree is the COA structure — per-person sub-ledgers
    // live in the Ledgers area, not here, so they are excluded.
    const accounts = await Account.find({ isActive: true, isSubLedger: { $ne: true } }).sort({ code: 1 }).lean();

    const tree = {};
    const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'];

    typeOrder.forEach((type) => {
      const typeAccounts = accounts.filter((a) => a.type === type);
      const parents = typeAccounts.filter((a) => !a.parentCode);
      const children = typeAccounts.filter((a) => a.parentCode);
      tree[type] = parents.map((parent) => ({
        ...parent,
        children: children.filter((c) => c.parentCode === parent.code),
      }));
    });

    res.json({ success: true, data: tree });
  } catch (error) {
    console.error('[Accounts] Tree error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to build account tree.' });
  }
};

const getAccount = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch account.' });
  }
};

const createAccount = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const { code, name, type, category, parentCode, description, normalBalance } = req.body;

    if (!code || !name || !type || !normalBalance) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: code, name, type, normalBalance.',
      });
    }

    const existing = await Account.findOne({ code });
    if (existing) {
      return res.status(409).json({ success: false, message: `Account code "${code}" already exists.` });
    }

    if (parentCode) {
      const parent = await Account.findOne({ code: parentCode });
      if (!parent) {
        return res.status(400).json({ success: false, message: `Parent account "${parentCode}" not found.` });
      }
    }

    const account = await Account.create({
      code, name, type, category, parentCode, description, normalBalance,
      isSystemAccount: false, balance: 0, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'accounts',
      entityId: account._id, entityType: 'Account',
      description: `Created account: ${code} — ${name}`,
      newData: { code, name, type, normalBalance },
    }, req);

    res.status(201).json({ success: true, message: 'Account created successfully.', data: account });
  } catch (error) {
    console.error('[Accounts] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
};

const updateAccount = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const previousData = account.toObject();
    const allowedFields = ['name', 'category', 'description'];
    if (!account.isSystemAccount) {
      allowedFields.push('parentCode', 'normalBalance', 'type');
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) account[field] = req.body[field];
    });

    await account.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'accounts',
      entityId: account._id, entityType: 'Account',
      description: `Updated account: ${account.code} — ${account.name}`,
      previousData, newData: account.toObject(),
    }, req);

    res.json({ success: true, message: 'Account updated successfully.', data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update account.' });
  }
};

const deactivateAccount = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    if (account.isSystemAccount) {
      return res.status(400).json({ success: false, message: 'System accounts cannot be deactivated.' });
    }
    if (account.balance !== 0) {
      return res.status(400).json({ success: false, message: `Cannot deactivate account with non-zero balance (${account.balance}).` });
    }

    account.isActive = false;
    await account.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'accounts',
      entityId: account._id, entityType: 'Account',
      description: `Deactivated account: ${account.code} — ${account.name}`,
    }, req);

    res.json({ success: true, message: 'Account deactivated.', data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to deactivate account.' });
  }
};

// GET /api/accounts/special-accounts
// Every posting ROLE for this tenant: its default code, any override, what it
// currently resolves to, and whether that account exists. A row with ok:false is
// a posting that would fail or mis-post today, so this doubles as a health check
// on the chart — which is the point of showing it to an admin at all.
const getSpecialAccounts = async (req, res) => {
  try {
    const data = await describeSpecialAccounts(req);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Accounts] getSpecialAccounts error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load special accounts.' });
  }
};

// PUT /api/accounts/special-accounts   { specialAccounts: { role: code, ... } }
// Saves the tenant's role -> code overrides. Unknown keys are dropped and values
// are trimmed (see sanitiseOverrides), so the stored map can only ever contain
// roles this build knows about. Sending a role with an empty value CLEARS its
// override, falling the role back to its historical default.
const setSpecialAccounts = async (req, res) => {
  try {
    const subdomain = req.tenant && req.tenant.subdomain;
    if (!subdomain) return res.status(400).json({ success: false, message: 'No tenant context.' });

    const clean = sanitiseOverrides(req.body && req.body.specialAccounts);

    const tenant = await Tenant.findOne({ subdomain });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    // Replace the map wholesale with the sanitised set: a role the client omits
    // (or sends blank) is intentionally back on its default.
    tenant.settings.specialAccounts = clean;
    tenant.markModified('settings');
    await tenant.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: tenant._id, entityType: 'Tenant',
      description: 'Updated special-account mappings (' + Object.keys(clean).length + ' set)',
      newData: clean,
    }, req);

    // Hand back the freshly resolved picture so the UI can re-render without a refetch.
    // Re-describe against the JUST-SAVED map. Built as a minimal explicit object
    // rather than spreading the Express request (which would copy a large object
    // and lose its prototype); describeSpecialAccounts only needs these two.
    const data = await describeSpecialAccounts({
      tenantDb: req.tenantDb,
      tenant: { settings: { specialAccounts: clean } },
    });
    res.json({ success: true, message: 'Special accounts updated.', data, specialAccounts: clean });
  } catch (error) {
    console.error('[Accounts] setSpecialAccounts error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to save special accounts.' });
  }
};

module.exports = {
  getAccounts, getAccountTree, getAccount,
  createAccount, updateAccount, deactivateAccount,
  getSpecialAccounts, setSpecialAccounts,
};