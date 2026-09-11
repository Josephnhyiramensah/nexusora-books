// server/utils/voucherHelpers.js
//
// Per-type sequential voucher numbers, mirroring generateEntryNumber's approach.
// Each voucher type has its own prefix and its own running sequence, e.g.
// PV-000001 (payment), RV-000001 (receipt), etc.

const VOUCHER_PREFIX = {
  payment:     'PV',   // Payment Voucher
  receipt:     'RV',   // Receipt Voucher
  contra:      'CV',   // Contra Voucher
  transfer:    'TV',   // Transfer Voucher
  journal:     'JV',   // Journal Voucher
  purchase:    'PUV',  // Purchase Voucher
  sales:       'SV',   // Sales Voucher
  debit_note:  'DN',   // Debit Note
  credit_note: 'CN',   // Credit Note
};

async function generateVoucherNumber(Voucher, voucherType) {
  const prefix = VOUCHER_PREFIX[voucherType] || 'VC';
  // Find the latest voucher of THIS type to continue its sequence.
  const last = await Voucher
    .findOne({ voucherType })
    .sort({ createdAt: -1 })
    .select('voucherNumber')
    .lean();

  if (!last || !last.voucherNumber) {
    return `${prefix}-000001`;
  }
  const lastNum = parseInt(String(last.voucherNumber).replace(`${prefix}-`, ''), 10);
  const nextNum = (Number.isFinite(lastNum) ? lastNum + 1 : 1).toString().padStart(6, '0');
  return `${prefix}-${nextNum}`;
}

// Map a voucher type to the JournalEntry.journalType it should post as.
// JournalEntry enum: general | sales | purchases | cash_receipts | cash_payments
function journalTypeForVoucher(voucherType) {
  switch (voucherType) {
    case 'receipt':     return 'cash_receipts';
    case 'payment':     return 'cash_payments';
    case 'sales':       return 'sales';
    case 'purchase':    return 'purchases';
    case 'contra':
    case 'transfer':
    case 'journal':
    case 'debit_note':
    case 'credit_note':
    default:            return 'general';
  }
}

module.exports = { VOUCHER_PREFIX, generateVoucherNumber, journalTypeForVoucher };
