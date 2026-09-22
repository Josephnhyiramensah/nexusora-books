// server/scripts/findSuspiciousEntries.js
//
// READ-ONLY. Surfaces journal entries that look like test/junk data or the
// source of a stored-vs-ledger mismatch, so we can eyeball them before deciding
// anything. Writes NOTHING.
//
//   node scripts/findSuspiciousEntries.js            # kgr, threshold 1,000,000
//   node scripts/findSuspiciousEntries.js kgr 500000 # custom subdomain + threshold

require('dotenv').config();
const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');

const sub = process.argv[2] || 'kgr';
const threshold = Number(process.argv[3] || 1000000);
const dbName = 'nexusora_tenant_' + sub.replace(/-/g, '_');

const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await connectMasterDB();
  const conn = await getTenantConnection(dbName);
  const J = conn.collection('journalentries');

  const entries = await J.find({}).sort({ date: 1 }).toArray();
  console.log(`\nTenant: ${dbName}`);
  console.log(`Total journal entries: ${entries.length}`);
  console.log(`Flagging any entry with a line >= ${money(threshold)} or touching 1100/4000\n`);

  let flagged = 0;
  for (const e of entries) {
    const lines = e.lines || [];
    const maxLine = lines.reduce((m, l) => Math.max(m, l.debit || 0, l.credit || 0), 0);
    const touchesARorSales = lines.some((l) => ['1100', '4000'].includes(String(l.accountCode)));
    const big = maxLine >= threshold;
    if (!big && !touchesARorSales) continue;
    // Only actually print the big ones, or AR/Sales ones that are also sizable.
    if (!big && maxLine < 1000) continue;

    flagged += 1;
    console.log(`─ Entry ${e.entryNumber}  (${e.status})  ${e.date ? new Date(e.date).toISOString().slice(0, 10) : '—'}`);
    console.log(`   ${e.description || '(no description)'}   ref: ${e.reference || '—'}`);
    console.log(`   _id: ${e._id}${e.branch ? '   branch: ' + e.branch : ''}`);
    for (const l of lines) {
      const side = (l.debit || 0) > 0 ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit)}`;
      console.log(`     ${String(l.accountCode || '').padEnd(6)} ${String(l.accountName || '').padEnd(28)} ${side}`);
    }
    console.log('');
  }

  if (!flagged) console.log('No entries matched. Try a lower threshold, e.g. 100000.');
  else console.log(`${flagged} entr${flagged === 1 ? 'y' : 'ies'} flagged above. Nothing was changed.`);

  await closeAllConnections();
})().catch((err) => { console.error('FATAL:', err.message); process.exit(1); });