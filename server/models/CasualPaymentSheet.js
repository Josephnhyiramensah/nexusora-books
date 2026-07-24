const mongoose = require('mongoose');

const casualPaymentSheetSchema = new mongoose.Schema({
  sheetNumber: { type: String, required: true, unique: true },
  title: { type: String, trim: true },
  periodLabel: { type: String, trim: true },
  date: { type: Date, default: Date.now },

  lines: [{
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'CasualWorker' },
    // Name captured at payment time: a worker may later be renamed or removed,
    // but a signed historical sheet must reprint exactly as it was paid.
    workerName: String,
    rate: Number,
    days: Number,
    // rate x days. Kept alongside `amount` so a manual override is visible
    // rather than silently replacing the computed figure.
    computedAmount: Number,
    amount: Number,
    note: String,
  }],

  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

casualPaymentSheetSchema.index({ date: -1 });

module.exports = casualPaymentSheetSchema;
