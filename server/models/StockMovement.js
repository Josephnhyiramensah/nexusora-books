// server/models/StockMovement.js
//
// The inventory ledger. Stock quantity is NEVER hand-set — it is DERIVED as the
// sum of a branch's movements for an item (exactly like account balances derive
// from journal lines). Every change to stock is one append-only, dated, branch-
// tagged movement here.
//
// This schema is intentionally COMPLETE for the whole inventory plan (receipts,
// issues, adjustments, transfers, weighted-average costing, invoice/bill linkage,
// and general-ledger posting) so no later phase needs a schema change. Fields not
// yet exercised by a given phase are simply left at their defaults until that
// phase wires them.

const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    // What moved, and where.
    item:   { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // The kind of movement. transfer_out/transfer_in are the two halves of a
    // branch-to-branch transfer and always come as a linked pair (see transferId).
    type: {
      type: String,
      enum: ['receipt', 'sale', 'issue', 'adjustment', 'transfer_out', 'transfer_in', 'opening_balance'],
      required: true,
      index: true,
    },

    // SIGNED quantity: positive adds to the branch's on-hand, negative removes.
    //   receipt / transfer_in / opening_balance      → positive
    //   sale / issue / transfer_out                  → negative
    //   adjustment                                   → either sign (a correction)
    // Storing the sign here means on-hand is a straight sum with no per-type logic.
    quantity: { type: Number, required: true },

    // Cost per unit for THIS movement (the money side).
    //  - receipts/opening: the cost stock came in at → feeds weighted-average.
    //  - issues/sales:     the cost stock left at (computed from costing method).
    // Kept on every movement so valuation and cost-of-goods are always reconstructable.
    unitCost:   { type: Number, default: 0 },
    totalCost:  { type: Number, default: 0 },   // quantity(abs) × unitCost, cached for reporting

    // When it happened (not necessarily when it was recorded).
    date: { type: Date, required: true, default: Date.now, index: true },

    // --- Source / provenance -------------------------------------------------
    // A human reference (invoice number, bill number, transfer id, count sheet).
    reference: { type: String, default: '' },
    // Structured links to the source document when the movement was auto-created
    // by posting an invoice or a bill. Null for manual movements. Lets us trace a
    // movement back to its cause and avoid double-posting the same document.
    sourceType:     { type: String, enum: ['invoice', 'bill', 'manual', 'transfer', 'migration', ''], default: '' },
    sourceInvoice:  { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    sourceBill:     { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },

    // Links the OUT and IN halves of a transfer so the pair can be reconciled
    // (their quantities must net to zero) and shown together.
    transferId: { type: String, default: '', index: true },

    // --- General-ledger posting (guarded; wired in a later phase) -------------
    // Whether this movement has been posted to the GL (Dr/Cr Inventory & COGS).
    // Present now so the posting phase never needs a schema change; defaults keep
    // it inert until that phase runs.
    glPosted:      { type: Boolean, default: false },
    glJournalEntry:{ type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },

    // Audit.
    notes:     { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Hot query paths: on-hand for an item at a branch, and per-branch/per-item history.
stockMovementSchema.index({ item: 1, branch: 1, date: -1 });
stockMovementSchema.index({ branch: 1, date: -1 });
stockMovementSchema.index({ sourceInvoice: 1 });
stockMovementSchema.index({ sourceBill: 1 });

module.exports = stockMovementSchema;