// server/controllers/accountController.js

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getAccounts = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
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
    const accounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();

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

module.exports = {
  getAccounts, getAccountTree, getAccount,
  createAccount, updateAccount, deactivateAccount,
};