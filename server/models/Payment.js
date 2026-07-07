// server/models/Payment.js

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ['incoming', 'outgoing'], required: true },
    date: { type: Date, required: [true, 'Payment date is required'] },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0.01 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card'],
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    reference: String,
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ type: 1 });
paymentSchema.index({ date: -1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ vendor: 1 });

module.exports = paymentSchema;