// server/controllers/chartSyncController.js
//
// Safely tops up a tenant's chart of accounts to the current default template.
// ADDITIVE ONLY: adds accounts whose code the tenant is missing; never modifies,
// renames, or deletes existing accounts (so balances and history are untouched).

const { getModel } = require('../utils/getModel');
const { getTenantConnection } = require('../config/db');
const Tenant = require('../models/Tenant');
const { defaultChartOfAccounts } = require('../config/seedData');
const { logAudit } = require('../middleware/auditMiddleware');

// Core: given a tenant DB connection, add any missing default accounts.
async function syncChartForDb(tenantDb) {
  const Account = getModel(tenantDb, 'Account');
  const existing = await Account.find({}).select('code').lean();
  const existingCodes = new Set(existing.map((a) => String(a.code)));

  const toAdd = defaultChartOfAccounts
    .filter((a) => !existingCodes.has(String(a.code)))
    .map((a) => ({ ...a, balance: 0 }));

  if (toAdd.length > 0) {
    await Account.insertMany(toAdd);
  }
  return { added: toAdd.length, addedCodes: toAdd.map((a) => a.code), totalDefault: defaultChartOfAccounts.length, existingBefore: existingCodes.size };
}

// Tenant-facing: sync the CALLER's own tenant (admin only, via /api/accounts/sync-chart).
const syncMyChart = async (req, res) => {
  try {
    const result = await syncChartForDb(req.tenantDb);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'accounts',
      entityType: 'Account',
      description: `Chart of accounts synced: ${result.added} account(s) added.`,
      newData: { added: result.added, addedCodes: result.addedCodes },
    }, req);
    res.json({ success: true, message: `${result.added} account(s) added. Existing accounts unchanged.`, data: result });
  } catch (error) {
    console.error('[ChartSync] error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to sync chart of accounts.' });
  }
};

// Platform-facing: sync ALL tenants at once (master console, platformProtect).
const syncAllTenantsChart = async (req, res) => {
  try {
    const tenants = await Tenant.find({ status: { $nin: ['archived'] } }).select('subdomain databaseName companyName');
    const results = [];
    for (const t of tenants) {
      try {
        const db = await getTenantConnection(t.databaseName);
        const r = await syncChartForDb(db);
        results.push({ subdomain: t.subdomain, ok: true, added: r.added });
      } catch (e) {
        results.push({ subdomain: t.subdomain, ok: false, error: e.message });
      }
    }
    const totalAdded = results.reduce((s, r) => s + (r.added || 0), 0);
    res.json({ success: true, message: `Synced ${results.length} tenant(s); ${totalAdded} account(s) added in total.`, data: results });
  } catch (error) {
    console.error('[ChartSync] all-tenants error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to sync all tenants.' });
  }
};

module.exports = { syncChartForDb, syncMyChart, syncAllTenantsChart };
