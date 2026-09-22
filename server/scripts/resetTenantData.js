// server/scripts/resetTenantData.js
//
// DEVELOPMENT reset. Clears a single tenant's TEST data to give a clean slate for
// handover, while KEEPING the structure we want (users, chart of accounts, the
// Head Office branch, config). It does NOT run by accident and it NEVER touches
// the master DB or any other tenant.
//
//   node scripts/resetTenantData.js --tenant kgr                 # DRY RUN (default): shows what it would do
//   node scripts/resetTenantData.js --tenant kgr --yes --confirm kgr   # actually wipe (both flags required, must match)
//
// Safety:
//   • Dry-run is the default. Nothing is deleted without --yes AND --confirm <sub>.
//   • --confirm must equal --tenant, so you can't fat-finger the wrong tenant.
//   • Aborts if the DB contains a collection this script doesn't explicitly
//     categorise (so a newly-added model can never be silently wiped or missed).
//   • Operates on exactly one named tenant; there is no "all tenants" mode.

require('dotenv').config();

// ── Categorisation: EVERY model must be in exactly one list. ─────────────────
// Structure/config we KEEP untouched.
const KEEP = [
  'User', 'Branch', 'ExternalMapping', 'ApiKey',
  'ExchangeRate', 'BankColumnMapping', 'BankContraRule',
];
// Kept, but balances zeroed (chart of accounts structure stays).
const RESET_BALANCE = ['Account'];
// Test transactional + sample master data we DELETE.
const WIPE = [
  'JournalEntry', 'Voucher', 'Invoice', 'Bill', 'Payment', 'PayrollRun',
  'CasualPaymentSheet', 'ReconciliationSession', 'Notification', 'AuditLog',
  'Customer', 'Vendor', 'Employee', 'CasualWorker', 'InventoryItem',
  'FixedAsset', 'BankAccount', 'Budget', 'Note', 'ToDo',
];

function parseArgs(argv) {
  const get = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };
  return {
    tenant: get('--tenant'),
    confirm: get('--confirm'),
    yes: argv.includes('--yes'),
  };
}

// Verify every registered model is categorised exactly once, and that the three
// lists are disjoint. Returns { ok, error }.
function verifyCoverage(registeredModelNames) {
  const all = [...KEEP, ...RESET_BALANCE, ...WIPE];
  const seen = new Set();
  for (const m of all) {
    if (seen.has(m)) return { ok: false, error: `Model "${m}" is in more than one list.` };
    seen.add(m);
  }
  const known = new Set(all);
  const uncategorised = registeredModelNames.filter((m) => !known.has(m));
  if (uncategorised.length) {
    return { ok: false, error: `Uncategorised model(s): ${uncategorised.join(', ')}. Add each to KEEP, RESET_BALANCE or WIPE before running.` };
  }
  return { ok: true };
}

async function run() {
  const { tenant, confirm, yes } = parseArgs(process.argv.slice(2));
  const dryRun = !(yes && confirm);

  if (!tenant) {
    console.error('Refusing to run: --tenant <subdomain> is required.');
    process.exit(1);
  }
  if (!dryRun && confirm !== tenant) {
    console.error(`Refusing to run: --confirm "${confirm}" does not match --tenant "${tenant}".`);
    process.exit(1);
  }

  const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');
  const dbName = 'nexusora_tenant_' + tenant.replace(/-/g, '_');

  await connectMasterDB();
  const conn = await getTenantConnection(dbName);

  // Coverage guard — every model must be categorised.
  const registered = Object.keys(conn.models);
  const cov = verifyCoverage(registered);
  if (!cov.ok) {
    console.error('\nABORTED (safety): ' + cov.error + '\n');
    await closeAllConnections();
    process.exit(1);
  }

  // Also surface any raw collection with no backing model (advisory — left alone).
  const dbCollections = (await conn.db.listCollections().toArray()).map((c) => c.name);
  const modelCollNames = new Set(registered.map((m) => conn.models[m].collection.name));
  const orphanCollections = dbCollections.filter((c) => !modelCollNames.has(c) && !c.startsWith('system.'));

  const collOf = (name) => conn.models[name].collection;

  console.log(`\n${dryRun ? '[DRY RUN] ' : '[LIVE] '}Reset for tenant: ${dbName}\n`);

  // Report WIPE counts.
  console.log('WILL DELETE (test data):');
  let totalToDelete = 0;
  for (const name of WIPE) {
    // eslint-disable-next-line no-await-in-loop
    const n = await collOf(name).countDocuments({});
    totalToDelete += n;
    console.log(`   ${name.padEnd(24)} ${String(n).padStart(6)}  (${conn.models[name].collection.name})`);
  }

  console.log('\nWILL RESET (kept, balances zeroed):');
  for (const name of RESET_BALANCE) {
    // eslint-disable-next-line no-await-in-loop
    const n = await collOf(name).countDocuments({});
    // eslint-disable-next-line no-await-in-loop
    const nonZero = await collOf(name).countDocuments({ balance: { $ne: 0 } });
    console.log(`   ${name.padEnd(24)} ${String(n).padStart(6)} accounts, ${nonZero} with a non-zero balance`);
  }

  console.log('\nWILL KEEP (untouched):');
  console.log('   ' + KEEP.join(', '));
  if (orphanCollections.length) {
    console.log('\nUnknown collections (no model) — LEFT UNTOUCHED:');
    console.log('   ' + orphanCollections.join(', '));
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would delete ${totalToDelete} document(s) across ${WIPE.length} collections and zero account balances.`);
    console.log('Nothing was changed. To apply, re-run with:  --yes --confirm ' + tenant + '\n');
    await closeAllConnections();
    return { dryRun: true };
  }

  // ── LIVE path ──
  console.log(`\nDeleting… (${totalToDelete} document(s))`);
  const deleted = {};
  for (const name of WIPE) {
    // eslint-disable-next-line no-await-in-loop
    const r = await collOf(name).deleteMany({});
    deleted[name] = r.deletedCount;
  }
  for (const name of RESET_BALANCE) {
    // eslint-disable-next-line no-await-in-loop
    const r = await collOf(name).updateMany({}, { $set: { balance: 0 } });
    console.log(`   ${name}: zeroed ${r.modifiedCount} balance(s)`);
  }

  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  console.log(`\nDone. Deleted ${totalDeleted} document(s); kept users, chart of accounts, Head Office branch and config.`);
  console.log('Per-collection: ' + Object.entries(deleted).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(', ') + '\n');

  await closeAllConnections();
  return { dryRun: false, totalDeleted };
}

if (require.main === module) {
  run().then((r) => process.exit(0)).catch((err) => { console.error('\nFATAL:', err.message); process.exit(1); });
}

module.exports = { verifyCoverage, parseArgs, KEEP, RESET_BALANCE, WIPE };