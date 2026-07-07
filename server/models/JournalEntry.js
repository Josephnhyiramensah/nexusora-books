// server/models/JournalEntry.js

const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Account is required for each journal line'],
  },
  accountCode: String,
  accountName: String,
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  description: String,
}, { _id: true });

const journalEntrySchema = new mongoose.Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: [true, 'Journal date is required'],
    },
    journalType: {
      type: String,
      enum: ['general', 'sales', 'purchases', 'cash_receipts', 'cash_payments'],
      required: [true, 'Journal type is required'],
    },
    description: String,
    reference: String,
    lines: {
      type: [journalLineSchema],
      validate: {
        validator: function (lines) {
          return lines && lines.length >= 2;
        },
        message: 'A journal entry must have at least 2 lines.',
      },
    },
    totalDebit: {
      type: Number,
      required: true,
    },
    totalCredit: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'posted', 'reversed'],
      default: 'draft',
    },
    isRecurring: { type: Boolean, default: false },
    recurringSchedule: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      },
      nextDate: Date,
      endDate: Date,
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

journalEntrySchema.index({ status: 1 });
journalEntrySchema.index({ journalType: 1 });
journalEntrySchema.index({ date: -1 });
journalEntrySchema.index({ entryNumber: 1 });

module.exports = journalEntrySchema;