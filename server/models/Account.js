// server/models/Account.js
// Collection: accounts (per-tenant database)
// Chart of Accounts — exports SCHEMA for getModel()

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, 'Account code is required'], unique: true, trim: true },
    name: { type: String, required: [true, 'Account name is required'], trim: true },
    type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense'],
      required: [true, 'Account type is required'],
    },
    category: { type: String, trim: true },
    parentCode: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isSystemAccount: { type: Boolean, default: false },
    normalBalance: {
      type: String,
      enum: ['debit', 'credit'],
      required: [true, 'Normal balance is required'],
    },
    balance: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

accountSchema.index({ type: 1 });
accountSchema.index({ isActive: 1 });
accountSchema.index({ parentCode: 1 });

module.exports = accountSchema;