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

    // ── Per-person subsidiary ledger (one dynamic ledger per party) ──
    // Set when this account is auto-provisioned for an external party (e.g. a
    // gold seller) so the control account (parentCode) carries a running
    // sub-ledger. The ledger is debit-normal: a debit balance means the party
    // owes us (receivable), a credit balance means we owe the party (payable);
    // the Ledgers area splits parties into Receivables/Payables by that sign.
    isSubLedger:     { type: Boolean, default: false },
    externalPartyId: { type: String, trim: true, default: null }, // the source system's person/ledger id
  },
  { timestamps: true }
);

accountSchema.index({ type: 1 });
accountSchema.index({ isActive: 1 });
accountSchema.index({ parentCode: 1 });
// One ledger per external party. Sparse so ordinary accounts (null) are exempt.
accountSchema.index({ externalPartyId: 1 }, { unique: true, sparse: true });
accountSchema.index({ isSubLedger: 1 });

module.exports = accountSchema;