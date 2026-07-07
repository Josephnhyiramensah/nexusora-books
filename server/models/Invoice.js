// server/models/Invoice.js

const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
}, { _id: true });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    date: { type: Date, required: [true, 'Invoice date is required'] },
    dueDate: { type: Date, required: [true, 'Due date is required'] },
    lines: {
      type: [invoiceLineSchema],
      validate: {
        validator: function (v) { return v && v.length >= 1; },
        message: 'At least one line item is required.',
      },
    },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });

module.exports = invoiceSchema;