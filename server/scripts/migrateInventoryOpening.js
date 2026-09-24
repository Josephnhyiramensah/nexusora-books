// server/scripts/migrateInventoryOpening.js
//
// Seeds the new stock-movement ledger from the OLD per-item quantityOnHand.
// For every item that has a non-zero quantityOnHand and no opening movement yet,
// it creates ONE opening_balance movement at the tenant's Head Office branch,
// dated now, at the item's current unitCost. After this runs, on-hand derives
// entirely from movements and matches what the item showed before — nothing lost.
//
// Safe: additive and idempotent. It never edits or deletes an item, and it skips
// any item that already has an opening_balance movement, so re-running does
// nothing. The item's quantityOnHand field is left in place (untouched) as a
// historical record; the app stops trusting it once movements drive on-hand.
//
// USAGE (run on the DROPLET — Atlas allowlist):
//   node scripts/migrateInventoryOpening.js            # DRY RUN (default)
//   node scripts/migrateInventoryOpening.js --apply    # actually create movements

require('dotenv').config();
const { connectMasterDB, getTenantConnection, closeAllConnections } = require('../config/db');
const { getModel } = require('../utils/getModel');
const Tenant = require('../models/Tenant');

const APPLY = process.argv.includes('--apply');

async function processTenant(t) {
  const label = `${t.companyName || t.subdomain} [${t.databaseName}]`;
  let db;
  try {
    db = await getTenantConnection(t.databaseName);
  } catch (e) {
    console.log(`  ✗ ${label}\n      ERROR connecting: ${e.message}`);
    return { ok: false };
  }

  const Item = getModel(db, 'InventoryItem');
  const Branch = getModel(db, 'Branch');
  const StockMovement = getModel(db, 'StockMovement');

  // Head Office is the anchor branch every existing record already uses.
  const ho = await Branch.findOne({ isHeadOffice: true }).select('_id').lean();
  if (!ho) {
    console.log(`  ✗ ${label}\n      no Head Office branch — run the branch migration first`);
    return { ok: false };
  }

  const items = await Item.find({}).select('code name quantityOnHand unitCost').lean();
  let wouldCreate = 0;
  let created = 0;
  const details = [];

  for (const item of items) {
    const qty = Number(item.quantityOnHand) || 0;
    if (qty === 0) continue; // nothing to seed

    // Idempotency: skip if this item already has an opening_balance movement.
    // eslint-disable-next-line no-await-in-loop
    const exists = await StockMovement.findOne({ item: item._id, type: 'opening_balance' }).select('_id').lean();
    if (exists) continue;

    wouldCreate += 1;
    details.push(`${item.code} ${item.name}: ${qty} @ ${item.unitCost || 0}`);

    if (APPLY) {
      const unitCost = Number(item.unitCost) || 0;
      // eslint-disable-next-line no-await-in-loop
      await StockMovement.create({
        item: item._id,
        branch: ho._id,
        type: 'opening_balance',
        quantity: qty,               // positive — opening stock adds to Head Office
        unitCost,
        totalCost: Math.round(qty * unitCost * 100) / 100,
        date: new Date(),
        reference: 'Opening balance (migrated)',
        sourceType: 'migration',
        notes: 'Opening balance seeded from the pre-ledger quantityOnHand.',
      });
      created += 1;
    }
  }

  if (!APPLY) {
    if (wouldCreate === 0) {
      console.log(`  ✓ ${label}\n      nothing to seed — no items with stock, or all already have openings`);
    } else {
      console.log(`  • ${label}\n      WOULD CREATE ${wouldCreate} opening movement(s) at Head Office:`);
      details.slice(0, 20).forEach((d) => console.log(`        ${d}`));
      if (details.length > 20) console.log(`        …and ${details.length - 20} more`);
    }
  } else {
    console.log(`  ✓ ${label}\n      created ${created} opening movement(s) at Head Office`);
  }
  return { ok: true, count: APPLY ? created : wouldCreate };
}

(async () => {
  await connectMasterDB();
  const tenants = await Tenant.find({ status: { $nin: ['archived'] } })
    .select('subdomain databaseName companyName').lean();

  console.log(`\n${APPLY ? '' : '[DRY RUN] '}Inventory opening-balance migration — ${tenants.length} tenant(s)\n`);

  let total = 0;
  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await processTenant(t);
    total += r.count || 0;
  }

  console.log(`\n${APPLY ? 'Done.' : '[DRY RUN] Done.'} ${tenants.length} tenant(s) processed.`);
  console.log(`  ${total} opening movement(s) ${APPLY ? 'created' : 'would be created'}.`);
  if (!APPLY) console.log('  Re-run with --apply to create them.');

  await closeAllConnections();
  console.log('');
  process.exit(0);
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });