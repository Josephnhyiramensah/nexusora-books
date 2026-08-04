const mongoose = require('mongoose');

// One imported statement (bank or MoMo) and every line in it. Lines are embedded
// because they're always read/written together with their session.
const statementLineSchema = new mongoose.Schema({
  // Parsed from the statement, normalized so bank and MoMo look identical here.
  date: Date,
  description: String,
  type: String,               // TRANSFER, PAYMENT, CASH_OUT, DEBIT, CASH_IN, ...
  direction: { type: String, enum: ['in', 'out'], required: true },
  amount: { type: Number, default: 0 },     // principal, always positive
  fee: { type: Number, default: 0 },
  eLevy: { type: Number, default: 0 },
  balanceAfter: Number,
  counterparty: String,       // the other party's name
  counterpartyNo: String,     // the other party's number/account
  // MoMo's F_ID (or a bank ref). UNIQUE per transaction -> dedupe key so the same
  // statement can be re-imported without double-posting.
  externalId: { type: String, index: true },
  reference: String,          // REF column / narration

  matchStatus: { type: String, enum: ['unmatched', 'matched', 'ignored'], default: 'unmatched' },
  // Bank-rec classification (populated for source:'bank'; empty for momo).
  bucket: { type: String, default: null },
  suggestedContra: { type: String, default: null },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  matchedEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
}, { _id: true });

const reconciliationSessionSchema = new mongoose.Schema({
  sessionNumber: { type: String, required: true, unique: true },
  source: { type: String, enum: ['momo', 'bank'], required: true },

  // The wallet/bank account being reconciled (a BankAccount; MoMo wallets are
  // BankAccounts with accountType 'mobile_money').
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  accountHolder: String,      // name on the statement
  accountMsisdn: String,      // the statement's own number — used to derive direction

  periodStart: Date,
  periodEnd: Date,
  openingBalance: Number,     // first line's BAL BEFORE
  closingBalance: Number,     // last line's BAL AFTER

  fileName: String,
  lines: [statementLineSchema],

  totalIn: { type: Number, default: 0 },
  totalOut: { type: Number, default: 0 },
  totalFees: { type: Number, default: 0 },

  status: { type: String, enum: ['draft', 'reconciled'], default: 'draft' },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

reconciliationSessionSchema.index({ createdAt: -1 });
reconciliationSessionSchema.index({ source: 1, status: 1 });

module.exports = reconciliationSessionSchema;
