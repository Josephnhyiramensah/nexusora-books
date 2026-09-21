// server/scripts/migrateBranches.js
//
// PHASE 1 — STEP 1 of the multi-branch migration.
//
// For every tenant, this:
//   1. Creates exactly one "Head Office" branch (code HO, isHeadOffice: true),
//      if it doesn't already have one.
//   2. Sets branchAccess = 'all' on every user that doesn't have it yet, so
//      existing users keep full visibility (the QuickBooks/Xero default — turning
//      on locations never silently removes anyone's access).
//
// It does NOT tag any transactions and does NOT change any app behaviour. Nothing
// in the app reads branches yet; this only stands up the data so later slices have
// a Head Office to point existing records at.
//
// SAFE BY DESIGN:
//   • Idempotent — re-running changes nothing the second time.
//   • Dry-run first  — `node scripts/migrateBranches.js --dry` writes nothing and
//     reports exactly what it WOULD do.
//   • Per-tenant isolation — one tenant failing never aborts the others; a summary
//     lists every tenant's result at the end.
//   • Writes branchAccess straight to the raw users collection, so it does not
//     depend on the User schema having been updated yet.
//
// USAGE:
//   node scripts/migrateBranches.js --dry              # report only, no writes
//   node scripts/migrateBranches.js                    # run for all tenants
//   node scripts/migrateBranches.js --tenant kgr       # run for one subdomain (rehearsal)
//   node scripts/migrateBranches.js --tenant kgr --dry # dry-run one tenant

require('dotenv').config();
const mongoose = require('mongoose');
const branchSchema = require('../models/Branch');

const HEAD_OFFICE = { name: 'Head Office', code: 'HO', isHeadOffice: true, isActive: true };

// ── core steps (kept small + injectable so they can be unit-tested) ──────────

// Ensure this tenant has a Head Office branch. Returns { created, branchId }.
async function ensureHeadOffice(conn, { dry }) {
  const Branch = conn.models.Branch || conn.model('Branch', branchSchema);

  // Idempotency: treat an existing Head Office, OR any branch already using the
  // HO code, as "already done" so a re-run never creates a duplicate or trips the
  // unique code index.
  let ho = await Branch.findOne({ isHeadOffice: true });
  if (!ho) ho = await Branch.findOne({ code: HEAD_OFFICE.code });

  if (ho) return { created: false, branchId: ho._id };
  if (dry) return { created: true, branchId: null, dryPlanned: true };

  const doc = await Branch.create({ ...HEAD_OFFICE });
  return { created: true, branchId: doc._id };
}

// Ensure every user has a branchAccess value. Written to the raw collection so it
// works regardless of whether the User schema has been updated yet. Returns count.
async function ensureUserBranchAccess(conn, { dry }) {
  const users = conn.collection('users');
  const missing = await users.countDocuments({ branchAccess: { $exists: false } });
  if (dry || missing === 0) return { modified: missing };

  const res = await users.updateMany(
    { branchAccess: { $exists: false } },
    { $set: { branchAccess: 'all', branches: [] } }
  );
  return { modified: res.modifiedCount };
}

// Run both steps for one already-open tenant connection.
async function migrateTenant(conn, { dry }) {
  const ho = await ensureHeadOffice(conn, { dry });
  const users = await ensureUserBranchAccess(conn, { dry });
  return { ho, users };
}

// ── runner ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const dry = argv.includes('--dry');
  const tIdx = argv.indexOf('--tenant');
  const onlyTenant = tIdx !== -1 ? argv[tIdx + 1] : null;
  return { dry, onlyTenant };
}

async function run({ dry, onlyTenant }) {
  // Lazy-require the app's own DB layer so this file can be unit-tested without it.
  const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');

  const tenantExport = require('../models/Tenant');
  await connectMasterDB();
  // models/* export schemas in this codebase; tolerate either a schema or a model.
  const Tenant = (tenantExport && typeof tenantExport.findOne === 'function')
    ? tenantExport
    : (mongoose.models.Tenant || mongoose.model('Tenant', tenantExport));

  const query = onlyTenant ? { subdomain: onlyTenant } : {};
  const tenants = await Tenant.find(query).select('subdomain companyName databaseName status').lean();

  console.log(`\n${dry ? '[DRY RUN] ' : ''}Multi-branch Step 1 — ${tenants.length} tenant(s)${onlyTenant ? ` (filtered: ${onlyTenant})` : ''}\n`);

  const summary = [];
  for (const t of tenants) {
    const tag = `${t.companyName || t.subdomain} [${t.databaseName}]`;
    try {
      const conn = await getTenantConnection(t.databaseName);
      const r = await migrateTenant(conn, { dry });
      const hoNote = r.ho.created ? (dry ? 'HO would be created' : 'HO created') : 'HO already present';
      const uNote = r.users.modified > 0 ? `${r.users.modified} user(s) ${dry ? 'would be set' : 'set'}` : 'users already set';
      console.log(`  ✓ ${tag}\n      ${hoNote}; ${uNote}`);
      summary.push({ tenant: t.subdomain, status: t.status, ...r, ok: true });
    } catch (err) {
      console.log(`  ✗ ${tag}\n      ERROR: ${err.message}`);
      summary.push({ tenant: t.subdomain, status: t.status, ok: false, error: err.message });
    }
  }

  const ok = summary.filter((s) => s.ok).length;
  const failed = summary.filter((s) => !s.ok);
  console.log(`\n${dry ? '[DRY RUN] ' : ''}Done. ${ok}/${tenants.length} tenant(s) processed cleanly.`);
  if (failed.length) {
    console.log(`  ${failed.length} failed: ${failed.map((f) => f.tenant).join(', ')}`);
    console.log('  (Fix the cause and re-run — the migration is idempotent, processed tenants are skipped.)');
  }
  if (dry) console.log('\nNo changes were written. Re-run without --dry to apply.');

  await closeAllConnections();
  return { summary, ok, failed: failed.length };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then(({ failed }) => process.exit(failed ? 1 : 0))
    .catch((err) => { console.error('\nFATAL:', err); process.exit(1); });
}

module.exports = { ensureHeadOffice, ensureUserBranchAccess, migrateTenant, run, parseArgs, HEAD_OFFICE };