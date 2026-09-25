// server/utils/inventoryService.js
//
// The inventory engine. Everything that changes or reads stock goes through here,
// so the rules live in ONE place (mirrors how branchScope centralises scoping and
// journal posting centralises the ledger).
//
// Core idea: stock on-hand is DERIVED from StockMovement records, never stored.
// Each movement carries a SIGNED quantity, so on-hand is a plain sum:
//   receipt / transfer_in / opening_balance  → positive
//   sale / issue / transfer_out              → negative
//   adjustment                               → caller-signed (a correction)
//
// Costing: weighted-average. The average unit cost after each receipt is
//   (existing qty × existing avg + received qty × received cost) / (existing + received)
// Issues are valued at the running average at the time of issue. This is correct
// for most goods and the sensible basis for gold by weight.

const { getModel } = require('./getModel');

// Which movement types add vs remove. adjustment is caller-signed.
const SIGN = {
  receipt: +1,
  opening_balance: +1,
  transfer_in: +1,
  sale: -1,
  issue: -1,
  transfer_out: -1,
  adjustment: 0, // caller passes a signed quantity directly
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Record ONE stock movement. The single safe path to write stock.
 * @param db        tenant connection
 * @param opts      { item, branch, type, quantity, unitCost?, date?, reference?,
 *                    sourceType?, sourceInvoice?, sourceBill?, transferId?, notes?, createdBy? }
 *   quantity is given as a POSITIVE magnitude for typed movements (receipt/sale/
 *   issue/transfer_*); the sign is applied from the type. For 'adjustment', pass
 *   a signed quantity (e.g. -3 to remove 3), and it is stored as given.
 * @returns the created movement doc
 */
async function recordMovement(db, opts) {
  const StockMovement = getModel(db, 'StockMovement');
  const {
    item, branch, type, quantity, unitCost, date, reference,
    sourceType, sourceInvoice, sourceBill, transferId, notes, createdBy,
  } = opts;

  if (!item || !branch) throw new Error('recordMovement: item and branch are required.');
  if (!(type in SIGN)) throw new Error(`recordMovement: invalid type "${type}".`);
  const mag = Math.abs(Number(quantity) || 0);
  if (mag === 0) throw new Error('recordMovement: quantity must be non-zero.');

  // Signed quantity: from type, except adjustment which trusts the caller's sign.
  let signed;
  if (type === 'adjustment') {
    signed = Number(quantity); // caller-signed
    if (!signed) throw new Error('recordMovement: adjustment quantity must be non-zero and signed.');
  } else {
    signed = SIGN[type] * mag;
  }

  // Cost: for inbound movements the caller supplies the cost; for outbound we use
  // the weighted-average at this branch NOW (unless the caller pinned a cost).
  let cost = Number(unitCost);
  if (!Number.isFinite(cost)) {
    if (signed < 0) {
      cost = await weightedAvgCost(db, item, branch);
    } else {
      cost = 0;
    }
  }

  const absQty = Math.abs(signed);
  const doc = await StockMovement.create({
    item, branch, type,
    quantity: signed,
    unitCost: round2(cost),
    totalCost: round2(absQty * cost),
    date: date || new Date(),
    reference: reference || '',
    sourceType: sourceType || 'manual',
    sourceInvoice: sourceInvoice || null,
    sourceBill: sourceBill || null,
    transferId: transferId || '',
    notes: notes || '',
    createdBy: createdBy || null,
  });
  return doc;
}

/**
 * On-hand quantity for an item at ONE branch — the signed sum of its movements.
 */
async function getOnHand(db, item, branch) {
  const StockMovement = getModel(db, 'StockMovement');
  const rows = await StockMovement.aggregate([
    { $match: { item: toId(item), branch: toId(branch) } },
    { $group: { _id: null, qty: { $sum: '$quantity' } } },
  ]);
  return rows.length ? round2(rows[0].qty) : 0;
}

/**
 * On-hand for an item across ALL branches → { total, byBranch: { branchId: qty } }.
 */
async function getOnHandAllBranches(db, item) {
  const StockMovement = getModel(db, 'StockMovement');
  const rows = await StockMovement.aggregate([
    { $match: { item: toId(item) } },
    { $group: { _id: '$branch', qty: { $sum: '$quantity' } } },
  ]);
  const byBranch = {};
  let total = 0;
  for (const r of rows) { byBranch[String(r._id)] = round2(r.qty); total += r.qty; }
  return { total: round2(total), byBranch };
}

/**
 * Weighted-average unit cost for an item at a branch, computed from the receipt
 * history (inbound movements) in date order. Issues don't change the average;
 * they consume at it. Returns 0 when there have been no inbound movements.
 */
async function weightedAvgCost(db, item, branch) {
  const StockMovement = getModel(db, 'StockMovement');
  const moves = await StockMovement.find({ item: toId(item), branch: toId(branch) })
    .sort({ date: 1, createdAt: 1 }).select('quantity unitCost type').lean();

  let qty = 0;      // running on-hand
  let avg = 0;      // running weighted-average unit cost
  for (const m of moves) {
    if (m.quantity > 0) {
      // Inbound → blend into the average.
      const inQty = m.quantity;
      const inCost = Number(m.unitCost) || 0;
      const newQty = qty + inQty;
      avg = newQty > 0 ? ((qty * avg) + (inQty * inCost)) / newQty : 0;
      qty = newQty;
    } else if (m.quantity < 0) {
      // Outbound → reduce qty, average unchanged. Guard against going negative.
      qty = Math.max(0, qty + m.quantity);
    }
  }
  return round2(avg);
}

/**
 * Per-branch stock valuation: for each item at the branch, on-hand × weighted-avg
 * cost, summed. Returns { total, items: [{ item, code, name, qty, avgCost, value }] }.
 */
async function branchValuation(db, branch) {
  const Item = getModel(db, 'InventoryItem');
  const items = await Item.find({ isActive: true }).select('code name').lean();
  const out = [];
  let total = 0;
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    const qty = await getOnHand(db, it._id, branch);
    if (qty === 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const avg = await weightedAvgCost(db, it._id, branch);
    const value = round2(qty * avg);
    total += value;
    out.push({ item: it._id, code: it.code, name: it.name, qty, avgCost: avg, value });
  }
  return { total: round2(total), items: out };
}

// Accept an id or a doc/string; return a Mongoose ObjectId-compatible value.
function toId(v) {
  if (v && v._id) return v._id;
  return v;
}


/**
 * Post stock movements for a SENT/POSTED invoice — one 'sale' movement per line
 * that names an inventory item. Lines without an item (services, fees, free-text)
 * are skipped, so existing invoices are unaffected.
 *
 * IDEMPOTENT: if this invoice already has movements, it does nothing. The invoice
 * post path can be reached more than once (send, and approve→send), so this guard
 * is what guarantees stock moves exactly once per invoice.
 *
 * Stock is allowed to go NEGATIVE: a sale is real even if stock wasn't keyed in
 * yet. Negative on-hand surfaces a counting gap to fix rather than blocking a sale.
 * Returns { created, skipped, negative: [...] } for reporting/logging.
 */
async function postStockForInvoice(db, invoice, userId) {
  const StockMovement = getModel(db, 'StockMovement');

  // Guard: already posted for this invoice → do nothing.
  const already = await StockMovement.countDocuments({ sourceInvoice: invoice._id });
  if (already > 0) return { created: 0, skipped: 0, alreadyPosted: true, negative: [] };

  const branch = invoice.branch;
  if (!branch) return { created: 0, skipped: 0, noBranch: true, negative: [] };

  let created = 0;
  let skipped = 0;
  const negative = [];

  for (const line of (invoice.lines || [])) {
    if (!line.item) { skipped += 1; continue; }          // not an inventory line
    const qty = Math.abs(Number(line.quantity) || 0);
    if (qty === 0) { skipped += 1; continue; }

    // Cost the issue at the branch's weighted average at this moment.
    // eslint-disable-next-line no-await-in-loop
    const cost = await weightedAvgCost(db, line.item, branch);

    // eslint-disable-next-line no-await-in-loop
    await recordMovement(db, {
      item: line.item, branch, type: 'sale', quantity: qty, unitCost: cost,
      date: invoice.date || new Date(),
      reference: invoice.invoiceNumber,
      sourceType: 'invoice', sourceInvoice: invoice._id,
      notes: `Auto: sold on invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
    created += 1;

    // Flag (don't block) if this drove on-hand below zero.
    // eslint-disable-next-line no-await-in-loop
    const onHand = await getOnHand(db, line.item, branch);
    if (onHand < 0) negative.push({ item: line.item, onHand });
  }

  return { created, skipped, negative };
}

/**
 * Post stock movements for an APPROVED/POSTED bill — one 'receipt' movement per
 * line naming an inventory item, at the line's unit price as the incoming cost
 * (which feeds the weighted average). Same idempotency guard as invoices.
 */
async function postStockForBill(db, bill, userId) {
  const StockMovement = getModel(db, 'StockMovement');

  const already = await StockMovement.countDocuments({ sourceBill: bill._id });
  if (already > 0) return { created: 0, skipped: 0, alreadyPosted: true };

  const branch = bill.branch;
  if (!branch) return { created: 0, skipped: 0, noBranch: true };

  let created = 0;
  let skipped = 0;

  for (const line of (bill.lines || [])) {
    if (!line.item) { skipped += 1; continue; }
    const qty = Math.abs(Number(line.quantity) || 0);
    if (qty === 0) { skipped += 1; continue; }

    // Purchase price per unit is the cost this stock comes in at.
    const unitCost = Number(line.unitPrice) || 0;

    // eslint-disable-next-line no-await-in-loop
    await recordMovement(db, {
      item: line.item, branch, type: 'receipt', quantity: qty, unitCost,
      date: bill.date || new Date(),
      reference: bill.billNumber,
      sourceType: 'bill', sourceBill: bill._id,
      notes: `Auto: received on bill ${bill.billNumber}`,
      createdBy: userId,
    });
    created += 1;
  }

  return { created, skipped };
}

module.exports = {
  recordMovement,
  postStockForInvoice,
  postStockForBill,
  getOnHand,
  getOnHandAllBranches,
  weightedAvgCost,
  branchValuation,
  SIGN,
};