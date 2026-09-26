// server/scripts/ensureIndexes.js
//
// Adds the branch-aware compound indexes that multi-branch scoping relies on,
// across every tenant. Indexes are ADDITIVE and IDEMPOTENT — creating one that
// already exists is a no-op, and none of this touches document data; it only
// speeds up reads. So this is safe to run (and re-run) any time.
//
// USAGE (run on the DROPLET — Atlas IP allowlist):
//   node scripts/ensureIndexes.js            # DRY RUN (default) — lists what it would create
//   node scripts/ensureIndexes.js --apply    # actually create the indexes
//
// Why these indexes: branch-scoped queries filter { branch, status, date } together.
// Single-field indexes don't serve a compound filter efficiently, so we add the
// compound shapes the app actually queries. Collections without a `branch` field
// are skipped automatically.

require('dotenv').config();
const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');
const Tenant = require('../models/Tenant');

const APPLY = process.argv.includes('--apply');

// Index plan per collection. Each entry: { keys, name }. We keep names explicit
// and stable so re-runs match existing indexes instead of creating duplicates.
// Only compound / branch indexes are here — single-field ones already exist.
const PLAN = {
  journalentries: [
    { keys: { branch: 1, status: 1, date: -1 }, name: 'branch_status_date' },
    { keys: { status: 1, branch: 1 },           name: 'status_branch' },
    { keys: { 'lines.account': 1 },              name: 'lines_account' },
  ],
  vouchers: [
    { keys: { branch: 1, status: 1, date: -1 }, name: 'branch_status_date' },
  ],
  invoices: [
    { keys: { branch: 1, status: 1, dueDate: 1 }, name: 'branch_status_dueDate' },
  ],
  bills: [
    { keys: { branch: 1, status: 1, dueDate: 1 }, name: 'branch_status_dueDate' },
  ],
  payments: [
    { keys: { branch: 1, date: -1 }, name: 'branch_date' },
  ],
  payrollruns: [
    { keys: { branch: 1, status: 1 }, name: 'branch_status' },
  ],
  casualpaymentsheets: [
    { keys: { branch: 1, status: 1 }, name: 'branch_status' },
  ],
  reconciliationsessions: [
    { keys: { branch: 1 }, name: 'branch' },
  ],
  bankaccounts: [
    { keys: { branch: 1 }, name: 'branch' },
  ],
  budgets: [
    { keys: { branch: 1 }, name: 'branch' },
  ],
  fixedassets: [
    { keys: { branch: 1 }, name: 'branch' },
  ],
};

// Does this collection have any document with a `branch` field? If not, skip it
// (nothing to index, and it may be a collection that predates branches).
async function collectionHasBranch(db, coll) {
  try {
    const one = await db.collection(coll).findOne({ branch: { $exists: true } }, { projection: { _id: 1 } });
    return !!one;
  } catch { return false; }
}

async function existingIndexNames(db, coll) {
  try {
    const ix = await db.collection(coll).indexes();
    return new Set(ix.map((i) => i.name));
  } catch { return new Set(); }
}

async function processTenant(t) {
  const label = `${t.companyName || t.subdomain} [${t.databaseName}]`;
  let db;
  try {
    db = await getTenantConnection(t.databaseName);
  } catch (e) {
    console.log(`  ✗ ${label}\n      ERROR connecting: ${e.message}`);
    return { ok: false };
  }

  const planned = [];   // { coll, name, keys }
  const skipped = [];    // { coll, reason }

  for (const [coll, specs] of Object.entries(PLAN)) {
    // Skip collections that don't exist or have no branch-tagged docs.
    const collections = await db.db.listCollections({ name: coll }).toArray();
    if (collections.length === 0) { skipped.push({ coll, reason: 'no such collection' }); continue; }

    // lines.account and branch indexes: for lines.account we don't require a
    // branch field; for the rest we do.
    const hasBranch = await collectionHasBranch(db, coll);
    const existing = await existingIndexNames(db, coll);

    for (const spec of specs) {
      const needsBranch = Object.keys(spec.keys).some((k) => k === 'branch');
      if (needsBranch && !hasBranch) { skipped.push({ coll, reason: `no branch-tagged docs (${spec.name})` }); continue; }
      if (existing.has(spec.name)) { skipped.push({ coll, reason: `exists (${spec.name})` }); continue; }
      planned.push({ coll, name: spec.name, keys: spec.keys });
    }
  }

  if (!APPLY) {
    if (planned.length === 0) {
      console.log(`  ✓ ${label}\n      nothing to add — all indexes already present`);
    } else {
      console.log(`  • ${label}\n      WOULD CREATE ${planned.length}:`);
      planned.forEach((p) => console.log(`        ${p.coll}: ${p.name}  ${JSON.stringify(p.keys)}`));
    }
    return { ok: true, planned: planned.length };
  }

  // APPLY
  let created = 0;
  for (const p of planned) {
    try {
      // background:true keeps the collection readable/writable while it builds.
      await db.collection(p.coll).createIndex(p.keys, { name: p.name, background: true });
      created += 1;
    } catch (e) {
      console.log(`      ! ${p.coll}.${p.name} failed: ${e.message}`);
    }
  }
  console.log(`  ✓ ${label}\n      created ${created}/${planned.length} index(es)`);
  return { ok: true, created };
}

(async () => {
  await connectMasterDB();
  const tenants = await Tenant.find({ status: { $nin: ['archived'] } })
    .select('subdomain databaseName companyName').lean();

  console.log(`\n${APPLY ? '' : '[DRY RUN] '}Ensure branch indexes — ${tenants.length} tenant(s)\n`);

  let totalPlanned = 0;
  let totalCreated = 0;
  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await processTenant(t);
    totalPlanned += r.planned || 0;
    totalCreated += r.created || 0;
  }

  console.log(`\n${APPLY ? 'Done.' : '[DRY RUN] Done.'} ${tenants.length} tenant(s) processed.`);
  if (APPLY) console.log(`  ${totalCreated} index(es) created in total.`);
  else console.log(`  ${totalPlanned} index(es) would be created. Re-run with --apply to create them.`);

  await closeAllConnections();
  console.log('');
  process.exit(0);
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });