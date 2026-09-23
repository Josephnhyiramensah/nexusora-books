// server/controllers/branchController.js
//
// CRUD for branches (multi-branch). Branches live inside a single tenant's DB.
// The Head Office branch is protected: it cannot be deactivated, deleted, or have
// its head-office flag removed — every existing record is tagged to it.

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

// Collections that carry a `branch` tag — used to check whether a branch has any
// data before allowing a hard delete.
const BRANCHED_MODELS = [
  'JournalEntry', 'Voucher', 'Invoice', 'Bill', 'Payment', 'PayrollRun',
  'CasualPaymentSheet', 'ReconciliationSession', 'BankAccount', 'Budget', 'FixedAsset',
];

// Count how many branch-tagged records point at a given branch id (across all
// branched collections). Used to protect branches that hold history.
async function branchRecordCount(req, branchId) {
  let total = 0;
  for (const name of BRANCHED_MODELS) {
    try {
      const M = getModel(req.tenantDb, name);
      // eslint-disable-next-line no-await-in-loop
      total += await M.countDocuments({ branch: branchId });
    } catch (_) { /* model may not exist in some tenant — skip */ }
  }
  return total;
}

// GET /api/branches — list all branches (active first, Head Office first).
const getBranches = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const branches = await Branch.find({})
      .sort({ isHeadOffice: -1, isActive: -1, name: 1 })
      .lean();
    res.json({ success: true, data: branches, count: branches.length });
  } catch (error) {
    console.error('[Branches] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch branches.' });
  }
};

// GET /api/branches/:id — one branch, with its record count (for the UI).
const getBranch = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    const recordCount = await branchRecordCount(req, branch._id);
    res.json({ success: true, data: { ...branch, recordCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch branch.' });
  }
};

// POST /api/branches — create a branch.
const createBranch = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const { name, code, address, city, region, phone, email } = req.body;

    if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Branch name is required.' });
    if (!code || !String(code).trim()) return res.status(400).json({ success: false, message: 'Branch code is required.' });

    const cleanCode = String(code).trim().toUpperCase();
    if (cleanCode.length < 2 || cleanCode.length > 8) {
      return res.status(400).json({ success: false, message: 'Branch code must be 2–8 characters.' });
    }
    // Unique code within the tenant.
    const clash = await Branch.findOne({ code: cleanCode });
    if (clash) return res.status(409).json({ success: false, message: `Branch code "${cleanCode}" is already in use.` });

    const branch = await Branch.create({
      name: String(name).trim(), code: cleanCode,
      address, city, region, phone, email,
      isHeadOffice: false, isActive: true,
      createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'settings',
      entityId: branch._id, entityType: 'Branch',
      description: `Created branch: ${branch.name} (${branch.code})`,
    }, req);

    res.status(201).json({ success: true, message: `Branch ${branch.name} created.`, data: branch });
  } catch (error) {
    console.error('[Branches] Create error:', error.message);
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Branch code already in use.' });
    res.status(500).json({ success: false, message: 'Failed to create branch.' });
  }
};

// PUT /api/branches/:id — edit branch details. Cannot change isHeadOffice here,
// and cannot rename the code to one already in use.
const updateBranch = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });

    const { name, code, address, city, region, phone, email } = req.body;

    if (code !== undefined) {
      const cleanCode = String(code).trim().toUpperCase();
      if (cleanCode.length < 2 || cleanCode.length > 8) {
        return res.status(400).json({ success: false, message: 'Branch code must be 2–8 characters.' });
      }
      if (cleanCode !== branch.code) {
        const clash = await Branch.findOne({ code: cleanCode, _id: { $ne: branch._id } });
        if (clash) return res.status(409).json({ success: false, message: `Branch code "${cleanCode}" is already in use.` });
        branch.code = cleanCode;
      }
    }
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ success: false, message: 'Branch name cannot be empty.' });
      branch.name = String(name).trim();
    }
    if (address !== undefined) branch.address = address;
    if (city !== undefined) branch.city = city;
    if (region !== undefined) branch.region = region;
    if (phone !== undefined) branch.phone = phone;
    if (email !== undefined) branch.email = email;

    await branch.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: branch._id, entityType: 'Branch',
      description: `Updated branch: ${branch.name} (${branch.code})`,
    }, req);

    res.json({ success: true, message: 'Branch updated.', data: branch });
  } catch (error) {
    console.error('[Branches] Update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update branch.' });
  }
};

// PATCH /api/branches/:id/status — activate / deactivate. Head Office cannot be
// deactivated (it is the anchor every existing record points to).
const setBranchStatus = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive (true/false) is required.' });
    }
    if (branch.isHeadOffice && isActive === false) {
      return res.status(400).json({ success: false, message: 'The Head Office branch cannot be deactivated.' });
    }

    branch.isActive = isActive;
    await branch.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: branch._id, entityType: 'Branch',
      description: `${isActive ? 'Activated' : 'Deactivated'} branch: ${branch.name} (${branch.code})`,
    }, req);

    res.json({ success: true, message: `Branch ${isActive ? 'activated' : 'deactivated'}.`, data: branch });
  } catch (error) {
    console.error('[Branches] Status error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update branch status.' });
  }
};

// DELETE /api/branches/:id — hard delete, allowed ONLY for a non-head-office
// branch with zero branch-tagged records. Otherwise deactivate instead.
const deleteBranch = async (req, res) => {
  try {
    const Branch = getModel(req.tenantDb, 'Branch');
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });

    if (branch.isHeadOffice) {
      return res.status(400).json({ success: false, message: 'The Head Office branch cannot be deleted.' });
    }

    const count = await branchRecordCount(req, branch._id);
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `This branch has ${count} record(s) and cannot be deleted. Deactivate it instead to keep its history.`,
      });
    }

    await Branch.findByIdAndDelete(branch._id);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'settings',
      entityId: branch._id, entityType: 'Branch',
      description: `Deleted empty branch: ${branch.name} (${branch.code})`,
    }, req);

    res.json({ success: true, message: `Branch ${branch.name} deleted.` });
  } catch (error) {
    console.error('[Branches] Delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete branch.' });
  }
};

module.exports = { getBranches, getBranch, createBranch, updateBranch, setBranchStatus, deleteBranch };