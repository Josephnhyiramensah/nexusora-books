// server/models/Invoice.js

const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
}, { _id: true });

// Snapshot of a tenant-defined custom field's value, captured at save time so
// the invoice stays self-describing even if the tenant later renames or removes
// the field definition.
const invoiceCustomFieldSchema = new mongoose.Schema({
  fieldId: String,
  label: String,
  type: String,
  value: mongoose.Schema.Types.Mixed,
}, { _id: false });

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
    // --- Multi-currency ---
    // currency: the invoice currency (e.g. USD). Empty = base (GHS). The amount
    // fields above are in THIS currency (what the customer sees). exchangeRate is
    // base-per-1-unit, locked at invoice time. base* fields are the GHS the ledger
    // actually posts, so the books stay in base currency.
    currency: { type: String, uppercase: true, trim: true, default: '' },
    exchangeRate: { type: Number, default: 1 },
    baseSubtotal: { type: Number, default: 0 },
    baseTaxAmount: { type: Number, default: 0 },
    baseTotal: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    // Tenant-defined header-level custom fields (snapshot of label/type/value).
    customFields: { type: [invoiceCustomFieldSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'awaiting_approval', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    notes: String,
    // --- Recurring ---
    // A recurring invoice is a TEMPLATE: it auto-generates draft invoices on a
    // schedule. The template itself is not sent; each generated child is a normal
    // draft that a person reviews and sends. isRecurringTemplate marks the parent;
    // generatedFrom links a child back to its template.
    isRecurringTemplate: { type: Boolean, default: false },
    recurring: {
      active: { type: Boolean, default: true },
      frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'] },
      nextRun: Date,          // when the next child should be generated
      endDate: Date,          // optional stop date
      lastGenerated: Date,    // when the last child was created
      count: { type: Number, default: 0 }, // how many children generated
    },
    generatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ isRecurringTemplate: 1, 'recurring.active': 1, 'recurring.nextRun': 1 });

module.exports = invoiceSchema;
