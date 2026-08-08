// server/models/Bill.js

const mongoose = require('mongoose');

const billLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
}, { _id: true });

// Snapshot of a tenant-defined custom field's value, captured at save time so
// the bill stays self-describing even if the tenant later renames or removes
// the field definition.
const billCustomFieldSchema = new mongoose.Schema({
  fieldId: String,
  label: String,
  type: String,
  value: mongoose.Schema.Types.Mixed,
}, { _id: false });

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
    // Tenant-defined header-level custom fields (snapshot of label/type/value).
    customFields: { type: [billCustomFieldSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'awaiting_approval', 'approved', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
  },
  { timestamps: true }
);

billSchema.index({ status: 1 });
billSchema.index({ vendor: 1 });
billSchema.index({ dueDate: 1 });

module.exports = billSchema;