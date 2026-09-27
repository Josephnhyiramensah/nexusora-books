// server/models/Payment.js

const mongoose = require('mongoose');

// One line of a payment: how much of this payment settles which document.
// A receipt can clear several invoices at once ("apply 5,000 across INV-001,
// INV-002 and part of INV-003"), and a payment can clear several bills.
//
// The header-level `invoice` / `bill` fields below are KEPT and still populated
// with the FIRST allocation, so every existing record, list, report and PDF that
// reads payment.invoice keeps working untouched. Allocations are the full truth;
// the single ref is a compatibility shim.
const allocationSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
  // Document number captured at allocation time, so the payment still reads
  // correctly even if the document is later renumbered.
  documentNumber: String,
  amount: { type: Number, required: true, min: 0.01 },
}, { _id: false });

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
    // What this payment settles, document by document. Always populated on new
    // payments (a single-document payment simply has one allocation). Older
    // records created before allocations existed have an empty array and are
    // read through the `invoice` / `bill` fields above.
    allocations: { type: [allocationSchema], default: [] },
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