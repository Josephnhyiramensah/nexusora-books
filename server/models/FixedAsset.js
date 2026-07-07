const mongoose = require('mongoose');

const fixedAssetSchema = new mongoose.Schema({
  assetCode: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['equipment', 'furniture', 'vehicle', 'property', 'other'], default: 'other' },
  location: String,
  purchaseDate: { type: Date, required: true },
  cost: { type: Number, required: true },
  residualValue: { type: Number, default: 0 },
  usefulLifeYears: { type: Number, required: true },
  depreciationMethod: { type: String, enum: ['straight_line', 'declining_balance', 'units_of_production'], default: 'straight_line' },
  accumulatedDepreciation: { type: Number, default: 0 },
  netBookValue: Number,
  status: { type: String, enum: ['active', 'disposed', 'written_off', 'maintenance'], default: 'active' },
  disposalDate: Date,
  disposalAmount: Number,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

fixedAssetSchema.index({ status: 1 });
module.exports = fixedAssetSchema;