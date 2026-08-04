'use strict';

/**
 * bankBucketClassifier
 * --------------------
 * Pure, account-agnostic. Maps a statement line's raw type (from
 * extracted.type) + direction to ONE semantic bucket shared by every tenant.
 * Emits NO account codes — the tenant contra map (Step 2, file 2) decides the
 * GL. No DB, no ledger, no side effects.
 *
 *   classifyBucket({ type, signed, description }) -> { bucket, confidence }
 *
 * direction: signed > 0 => money IN, signed < 0 => money OUT (Dr-to-1020).
 */

const BUCKETS = [
  'inbound-collection',
  'cash-deposit',
  'cheque-out',
  'cash-out',
  'fee',
  'statutory',
  'payroll',
  'reversal',
  'fx-inbound',
  'internal-transfer',
  'card-atm',
  'unknown',
];

// Each rule: test the normalized type/description; first match wins.
// `dir`: 'in' | 'out' | 'any' — extra guard so a keyword can resolve
// differently by direction where that matters.
const RULES = [
  // fees / charges — direction-independent, always an expense bucket
  { bucket: 'fee', conf: 'exact', dir: 'any', re: /\b(CHARGE|CHARGES|COMMISSION|FEE|E-?BUNDLE|SERVICE CHARGE|CHEQUEBOOK|STATEMENT)\b/ },

  // statutory remittances
  { bucket: 'statutory', conf: 'exact', dir: 'any', re: /\b(SNNIT|SSNIT|GOVERNMENT COLLECTIONS?|GRA|VAT|PAYE|TAX)\b/ },

  // payroll
  { bucket: 'payroll', conf: 'exact', dir: 'any', re: /\b(SALARY|PAYROLL|SALARY PROCESSING)\b/ },

  // reversals / returned / re-presented items
  { bucket: 'reversal', conf: 'exact', dir: 'any', re: /\b(RETURNED|REVERSAL|NRT RETURNS?|ACH RETURNS?|UNPAID|INVALID ACCOUNT|MISCELLANEOUS DEBIT)\b/ },

  // foreign inbound
  { bucket: 'fx-inbound', conf: 'exact', dir: 'in', re: /\b(INWARD REMITT|INWARD REM|REMITTANCE|USD|EUR|GBP|NOSTRO)\b/ },

  // internal / own-account & related-party transfers
  { bucket: 'internal-transfer', conf: 'probable', dir: 'any', re: /\b(ACCOUNT TO ACCOUNT|INTERNAL TRANSFER|FUND TRANSFER|OWN ACCOUNT|SELF)\b/ },

  // card / ATM / POS
  { bucket: 'card-atm', conf: 'exact', dir: 'any', re: /\b(ATM|VISA|POS|CARD|WITHDRAWAL CHARGE)\b/ },

  // cheque OUT (paid from clearing / onus cheque payment / cash cheque withdrawal)
  { bucket: 'cheque-out', conf: 'probable', dir: 'out', re: /\b(CHEQUE PAID|ONUS CHEQUE|CHEQUE WITHDRAWAL|CASH CHEQUE)\b/ },

  // inbound cheque deposits (other-bank clearing INTO the account)
  { bucket: 'inbound-collection', conf: 'probable', dir: 'in', re: /\b(OUTWARD CHEQUE CLEARING|CHQ DEP|CHEQUE DEP)\b/ },

  // cash deposit into the account
  { bucket: 'cash-deposit', conf: 'exact', dir: 'in', re: /\b(CASH DEPOSIT)\b/ },

  // cash out at counter (non-cheque)
  { bucket: 'cash-out', conf: 'probable', dir: 'out', re: /\b(CASH WITHDRAWAL|CASH WITHDRAWAL;|WITHDRAWAL)\b/ },

  // inbound electronic collections (MoMo/USSD/instant/bill pay/insurer ACH)
  { bucket: 'inbound-collection', conf: 'probable', dir: 'in', re: /\b(OTHERS COLLECTION|COLLECTION|INSTANT ACH|MMI|MOBILE MONEY|GHQRCODE|QRCODE|BILL PAYMENT|GHIPSS|DD )\b/ },
];

function normalize(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim().toUpperCase();
}

function classifyBucket(line = {}) {
  const type = normalize(line.type);
  const desc = normalize(line.description);
  const hay = type + ' || ' + desc; // match against type first, fall back to full description
  const signed = Number(line.signed || 0);
  const dir = signed > 0 ? 'in' : signed < 0 ? 'out' : 'any';

  for (const r of RULES) {
    if (r.dir !== 'any' && r.dir !== dir) continue;
    if (r.re.test(hay)) {
      return { bucket: r.bucket, confidence: r.conf };
    }
  }
  return { bucket: 'unknown', confidence: 'low' };
}

module.exports = { classifyBucket, BUCKETS };
