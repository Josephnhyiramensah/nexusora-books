const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  category: String,
  costingMethod: { type: String, enum: ['fifo', 'lifo', 'weighted_average'], default: 'fifo' },
  unitCost: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  quantityOnHand: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = inventoryItemSchema;