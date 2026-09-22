// server/scripts/migrateBranches.js
//
// PHASE 1 multi-branch migration. Idempotent, dry-runnable, per-tenant isolated.
//
// For every tenant it:
//   1. Creates exactly one "Head Office" branch (code HO), if absent.
//   2. Sets branchAccess = 'all' on every user that doesn't have it, so existing
//      users keep full visibility (turning on branches never removes access).
//   3. Back-fills branch = Head Office on every existing Voucher and JournalEntry
//      that isn't tagged yet, so branch-scoped reads have something to match and
//      old data shows up under the (only) branch.
//
// It does NOT change any accounting values — branch is metadata only.
//
// USAGE:
//   node scripts/migrateBranches.js --dry              # report only, no writes
//   node scripts/migrateBranches.js                    # run for all tenants
//   node scripts/migrateBranches.js --tenant kgr       # one subdomain (rehearsal)
//   node scripts/migrateBranches.js --tenant kgr --dry # dry-run one tenant

require('dotenv').config();
const mongoose = require('mongoose');
const branchSchema = require('../models/Branch');

const HEAD_OFFICE = { name: 'Head Office', code: 'HO', isHeadOffice: true, isActive: true };

// ── core steps (small + injectable so they can be unit-tested) ───────────────

// Ensure this tenant has a Head Office branch. Returns { created, branchId }.
async function ensureHeadOffice(conn, { dry }) {
  const Branch = conn.models.Branch || conn.model('Branch', branchSchema);
  let ho = await Branch.findOne({ isHeadOffice: true });
  if (!ho) ho = await Branch.findOne({ code: HEAD_OFFICE.code });
  if (ho) return { created: false, branchId: ho._id };
  if (dry) return { created: true, branchId: null, dryPlanned: true };
  const doc = await Branch.create({ ...HEAD_OFFICE });
  return { created: true, branchId: doc._id };
}

// Ensure every user has a branchAccess value. Raw collection write, so it works
// regardless of whether the User schema was updated yet. Returns count.
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

// Resolve the real collection name for a model (falls back to the mongoose
// default pluralisation when the model isn't registered on this connection).
function collectionName(conn, modelName, fallback) {
  const m = conn.models[modelName];
  return (m && m.collection && m.collection.name) || fallback;
}

// Back-fill branch = Head Office on Vouchers and JournalEntries missing it.
// Raw collection writes; only touches untagged docs, so it is idempotent.
async function backfillBranchTags(conn, hoId, { dry }) {
  const vColl = conn.collection(collectionName(conn, 'Voucher', 'vouchers'));
  const jColl = conn.collection(collectionName(conn, 'JournalEntry', 'journalentries'));

  const vMissing = await vColl.countDocuments({ branch: { $exists: false } });
  const jMissing = await jColl.countDocuments({ branch: { $exists: false } });

  if (dry) return { vouchers: vMissing, journals: jMissing, dry: true };
  if (vMissing === 0 && jMissing === 0) return { vouchers: 0, journals: 0 };
  if (!hoId) return { vouchers: vMissing, journals: jMissing, skipped: 'no head office id' };

  let vMod = 0;
  let jMod = 0;
  if (vMissing) vMod = (await vColl.updateMany({ branch: { $exists: false } }, { $set: { branch: hoId } })).modifiedCount;
  if (jMissing) jMod = (await jColl.updateMany({ branch: { $exists: false } }, { $set: { branch: hoId } })).modifiedCount;
  return { vouchers: vMod, journals: jMod };
}

// Run all steps for one already-open tenant connection.
async function migrateTenant(conn, { dry }) {
  const ho = await ensureHeadOffice(conn, { dry });
  const users = await ensureUserBranchAccess(conn, { dry });
  const backfill = await backfillBranchTags(conn, ho.branchId, { dry });
  return { ho, users, backfill };
}

// ── runner ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const dry = argv.includes('--dry');
  const tIdx = argv.indexOf('--tenant');
  const onlyTenant = tIdx !== -1 ? argv[tIdx + 1] : null;
  return { dry, onlyTenant };
}

async function run({ dry, onlyTenant }) {
  const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');

  const tenantExport = require('../models/Tenant');
  await connectMasterDB();
  const Tenant = (tenantExport && typeof tenantExport.findOne === 'function')
    ? tenantExport
    : (mongoose.models.Tenant || mongoose.model('Tenant', tenantExport));

  const query = onlyTenant ? { subdomain: onlyTenant } : {};
  const tenants = await Tenant.find(query).select('subdomain companyName databaseName status').lean();

  console.log(`\n${dry ? '[DRY RUN] ' : ''}Multi-branch migration — ${tenants.length} tenant(s)${onlyTenant ? ` (filtered: ${onlyTenant})` : ''}\n`);

  const summary = [];
  for (const t of tenants) {
    const tag = `${t.companyName || t.subdomain} [${t.databaseName}]`;
    try {
      const conn = await getTenantConnection(t.databaseName);
      const r = await migrateTenant(conn, { dry });
      const hoNote = r.ho.created ? (dry ? 'HO would be created' : 'HO created') : 'HO present';
      const uNote = r.users.modified > 0 ? `${r.users.modified} user(s) ${dry ? 'would be set' : 'set'}` : 'users set';
      const bTagged = (r.backfill.vouchers || 0) + (r.backfill.journals || 0);
      const bNote = bTagged > 0
        ? `${r.backfill.vouchers} voucher(s) + ${r.backfill.journals} journal(s) ${dry ? 'would be tagged' : 'tagged'}`
        : 'records already tagged';
      console.log(`  ✓ ${tag}\n      ${hoNote}; ${uNote}; ${bNote}`);
      summary.push({ tenant: t.subdomain, ...r, ok: true });
    } catch (err) {
      console.log(`  ✗ ${tag}\n      ERROR: ${err.message}`);
      summary.push({ tenant: t.subdomain, ok: false, error: err.message });
    }
  }

  const ok = summary.filter((s) => s.ok).length;
  const failed = summary.filter((s) => !s.ok);
  console.log(`\n${dry ? '[DRY RUN] ' : ''}Done. ${ok}/${tenants.length} tenant(s) processed cleanly.`);
  if (failed.length) {
    console.log(`  ${failed.length} failed: ${failed.map((f) => f.tenant).join(', ')}`);
    console.log('  (Fix the cause and re-run — the migration is idempotent, done work is skipped.)');
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

module.exports = { ensureHeadOffice, ensureUserBranchAccess, backfillBranchTags, migrateTenant, run, parseArgs, HEAD_OFFICE };