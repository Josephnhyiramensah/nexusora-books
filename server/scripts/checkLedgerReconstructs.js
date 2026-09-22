// server/scripts/checkLedgerReconstructs.js
//
// READ-ONLY diagnostic. For a tenant, it rebuilds each account's balance purely
// from posted JournalEntry lines and compares it to the stored account.balance.
//
//   0 mismatches  → the ledger is the complete source of truth; per-branch
//                   reports can be recomputed from journal lines and WILL balance.
//   >0 mismatches → some balances (almost certainly opening balances) live only
//                   on account.balance, outside the ledger. We'd fix that first
//                   (opening-balance journal entries) before per-branch reports.
//
// Writes nothing. Run on the DROPLET (whitelisted for Atlas).
//
//   node scripts/checkLedgerReconstructs.js            # defaults to kgr
//   node scripts/checkLedgerReconstructs.js essence_kapital

require('dotenv').config();
const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');

const sub = process.argv[2] || 'kgr';
const dbName = 'nexusora_tenant_' + sub.replace(/-/g, '_');

(async () => {
  await connectMasterDB();
  const conn = await getTenantConnection(dbName);
  const A = conn.collection('accounts');
  const J = conn.collection('journalentries');

  // Sum signed movement (debit - credit) per account across posted entries.
  const movement = {};
  const cursor = J.find({ status: 'posted' });
  let entryCount = 0;
  // eslint-disable-next-line no-await-in-loop
  for await (const e of cursor) {
    entryCount += 1;
    for (const l of (e.lines || [])) {
      const id = String(l.account);
      movement[id] = (movement[id] || 0) + ((l.debit || 0) - (l.credit || 0));
    }
  }

  const accts = await A.find({}).toArray();
  const mismatches = [];
  for (const a of accts) {
    const raw = movement[String(a._id)] || 0;
    // Stored balance is signed by the account's normal side.
    const ledger = a.normalBalance === 'debit' ? raw : -raw;
    const stored = a.balance || 0;
    if (Math.abs(stored - Math.round(ledger * 100) / 100) > 0.01) {
      mismatches.push({
        code: a.code, name: a.name, normalBalance: a.normalBalance,
        stored: Math.round(stored * 100) / 100,
        fromLedger: Math.round(ledger * 100) / 100,
        diff: Math.round((stored - ledger) * 100) / 100,
      });
    }
  }

  console.log(`\nTenant: ${dbName}`);
  console.log(`Posted journal entries: ${entryCount}`);
  console.log(`Accounts checked: ${accts.length}`);
  console.log(`Stored-vs-ledger mismatches: ${mismatches.length}\n`);
  if (mismatches.length) {
    console.log('These accounts do NOT reconstruct from the ledger (likely opening balances):');
    for (const m of mismatches.slice(0, 40)) {
      console.log(`  ${m.code} ${m.name}: stored ${m.stored}, ledger ${m.fromLedger}, diff ${m.diff}`);
    }
    if (mismatches.length > 40) console.log(`  … and ${mismatches.length - 40} more`);
    console.log('\n→ Per-branch reports would need opening-balance journals first.');
  } else {
    console.log('✓ Every account reconstructs exactly from posted journal lines.');
    console.log('→ Safe to build per-branch reports directly from the ledger.');
  }

  await closeAllConnections();
})().catch((err) => { console.error('FATAL:', err.message); process.exit(1); });