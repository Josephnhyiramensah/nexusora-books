// server/models/Voucher.js
//
// A Voucher is a user-friendly, professional accounting document (Payment,
// Receipt, Contra, Transfer, Journal, Purchase, Sales, Debit Note, Credit Note).
// When POSTED, a voucher generates a balanced double-entry JournalEntry through
// the existing journal engine — so every voucher flows into the Trial Balance,
// P&L, General Ledger and audit trail automatically, with one source of truth.
//
// Supports two shapes:
//   • Simple  — one debit account + one credit account + one amount (covers most
//               vouchers; matches how external systems typically send data).
//   • Multi-line — several debit/credit lines for complex entries.
// Whichever is used, posting validates that debits equal credits.

const mongoose = require('mongoose');

const voucherLineSchema = new mongoose.Schema({
  account:     { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  accountCode: String,
  accountName: String,
  debit:  { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  description: String,
}, { _id: true });

const voucherSchema = new mongoose.Schema(
  {
    voucherNumber: { type: String, required: true, unique: true },

    voucherType: {
      type: String,
      enum: [
        'payment',      // Payment Voucher  (Debit Voucher)  — pay money out
        'receipt',      // Receipt Voucher  (Credit Voucher) — receive money in
        'contra',       // Contra Voucher   — cash<->bank / bank<->bank transfers
        'transfer',     // Transfer / non-cash movement
        'journal',      // Journal Voucher  — non-cash adjustments
        'purchase',     // Purchase Voucher
        'sales',        // Sales Voucher
        'debit_note',   // Debit Note
        'credit_note',  // Credit Note
      ],
      required: [true, 'Voucher type is required'],
    },

    date: { type: Date, required: [true, 'Voucher date is required'] },
    narration: String,                 // description / purpose
    reference: String,                 // external reference no.

    // Party (only some are relevant per type — kept flexible).
    partyName: String,                 // payee / received-from / name
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    vendor:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },

    // Payment/receipt mechanics.
    mode: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card', 'other'], default: 'cash' },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    bankName: String,
    instrumentNo: String,              // cheque / instrument number

    // Mode-specific details captured on the voucher form. Which keys are filled
    // depends on the payment mode: e.g. mobile_money uses { momoNumber, momoName,
    // reference }; cheque uses { chequeNo, bank, branch }; bank_transfer uses
    // { bank, accountNo, branch, reference }. Kept flexible so new modes don't
    // require schema changes.
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    amount: { type: Number, required: true, min: 0.01 },

    // Accounting lines (simple = 2 lines; multi-line = more). Always balanced
    // when posted.
    lines: {
      type: [voucherLineSchema],
      validate: {
        validator: (lines) => lines && lines.length >= 2,
        message: 'A voucher must have at least 2 accounting lines (one debit, one credit).',
      },
    },
    totalDebit:  { type: Number, required: true, default: 0 },
    totalCredit: { type: Number, required: true, default: 0 },

    status: {
      type: String,
      enum: ['draft', 'awaiting_approval', 'posted', 'reversed'],
      default: 'draft',
    },

    // Link to the JournalEntry this voucher generated when posted.
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },

    // Provenance — set when a voucher arrives via the external API (Phase 2).
    createdViaApi: { type: Boolean, default: false },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey' },
    externalId: String,                // the source system's own id, for dedupe

    // Itemized detail (for sales/purchase-style vouchers). Optional — when empty
    // the voucher is a simple single-amount voucher. The line-item total feeds
    // the voucher amount; the double-entry (lines[]) still posts ONE total.
    lineItems: [{
      description: String,
      quantity: { type: Number, default: 1 },
      unit: String,                         // Kg, Box, Litre, pcs...
      unitPrice: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }, // quantity * unitPrice
    }],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    isItemized: { type: Boolean, default: false },

    // Scanned/attached source documents (receipts, payment vouchers, contracts)
    // stored in Cloudinary and linked here for the audit trail.
    attachments: [{
      url: String,            // Cloudinary secure_url
      publicId: String,       // Cloudinary public_id (for deletion)
      filename: String,       // original filename shown to the user
      resourceType: String,   // 'image' or 'raw' (pdf)
      uploadedAt: { type: Date, default: Date.now },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],

    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

voucherSchema.index({ voucherType: 1 });
voucherSchema.index({ status: 1 });
voucherSchema.index({ date: -1 });
// Prevent duplicate imports of the same external record (Phase 2 safety).
voucherSchema.index({ externalId: 1 }, { unique: true, sparse: true });

module.exports = voucherSchema;
