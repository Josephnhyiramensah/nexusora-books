// server/models/Bill.js

const mongoose = require('mongoose');

const billLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
}, { _id: true });

const billSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    date: { type: Date, required: [true, 'Bill date is required'] },
    dueDate: { type: Date, required: [true, 'Due date is required'] },
    lines: {
      type: [billLineSchema],
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
      enum: ['draft', 'approved', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

billSchema.index({ status: 1 });
billSchema.index({ vendor: 1 });
billSchema.index({ dueDate: 1 });

module.exports = billSchema;