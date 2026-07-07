const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  accountName: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumber: String,
  accountType: { type: String, enum: ['checking', 'savings', 'mobile_money'], default: 'checking' },
  currency: { type: String, default: 'GHS' },
  currentBalance: { type: Number, default: 0 },
  ledgerAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = bankAccountSchema;