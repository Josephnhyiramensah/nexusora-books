const mongoose = require('mongoose');

// The item CATALOGUE — what a thing is (code, name, pricing, reorder level).
// It deliberately does NOT hold the stock quantity: on-hand is DERIVED from the
// StockMovement ledger (sum of a branch's signed movements), so every change has
// a date, a branch, a cost and a reason. See utils/inventoryService.js.
const inventoryItemSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  category: String,
  costingMethod: { type: String, enum: ['fifo', 'lifo', 'weighted_average'], default: 'weighted_average' },
  unitCost: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },

  // DEPRECATED — do not read or write this for stock.
  // It is the pre-ledger quantity field, kept ONLY so scripts/migrateInventoryOpening.js
  // can seed opening-balance movements from legacy data (and as a historical record
  // of what a tenant held before the ledger existed). Nothing in the running app
  // uses it: the API returns a derived `onHand` instead, the item form no longer
  // edits it, and inventoryController strips it on create. Remove it only after
  // every tenant has been migrated and you no longer need the legacy value.
  quantityOnHand: { type: Number, default: 0 },

  reorderLevel: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = inventoryItemSchema;