'use strict';

/**
 * fidelityToSessionLines
 * ----------------------
 * Bridges the Fidelity xlsx adapter to the EXISTING ReconciliationSession
 * line contract (identical shape to utils/momoParser.js output), so a bank
 * statement flows through the same importStatement -> autoMatch -> postLine
 * pipeline the MoMo path already uses. No DB, no ledger.
 *
 * Returns { meta, lines, totals } — same keys importStatement already reads.
 *
 * Ghana/IFRS-for-SMEs audit rules baked in:
 *   - Each bank charge is its OWN line (bucket 'fee' -> 6800), never folded
 *     into a sibling, so every statement debit traces 1:1 and 6800 / the
 *     VAT-NHIL-GETFund-COVID levy element stays reconcilable.
 *   - externalId = sha256(fileHash + seq + amount + isoDate): stable across
 *     re-imports (dedupe) yet unique per physical row, so repeated identical
 *     rows (e.g. four 4,000 ATM withdrawals same day) are never collapsed —
 *     protects the auditor's completeness test.
 *   - opening/closing/turnover carried into meta so reconcileSession can show
 *     the balance-chain proof for bank rec too.
 */

const crypto = require('crypto');
const { parseFidelityXlsx } = require('./fidelityXlsxAdapter');
const { classifyBucket } = require('./bankBucketClassifier');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function externalIdFor(fileHash, line) {
  const basis = [fileHash || '', line.seq, r2(Math.abs(line.signed)), isoDay(line.postingDate)].join('|');
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 24);
}

/**
 * @param {Buffer|string} input  xlsx buffer (or path, for CLI testing)
 * @param {object} opts { filename, contraMap }  contraMap: { bucket: contraCode }
 * @returns {{ meta, lines, totals }}
 */
function fidelityToSessionLines(input, opts = {}) {
  const { filename = null, contraMap = {} } = opts;
  const parsed = parseFidelityXlsx(input, { filename });
  const fileHash = parsed.meta.fileHash;

  const lines = parsed.lines.map((l) => {
    const direction = l.signed > 0 ? 'in' : 'out';
    const amount = r2(Math.abs(l.signed));
    const { bucket, confidence } = classifyBucket({
      type: l.extracted.type,
      description: l.description,
      signed: l.signed,
    });
    const suggestedContra = Object.prototype.hasOwnProperty.call(contraMap, bucket)
      ? contraMap[bucket]
      : null;

    return {
      date: l.postingDate,
      description: l.description,
      type: l.extracted.type || 'BANK',
      direction,
      amount,
      fee: 0,       // bank charges are their OWN lines (bucket 'fee'), never folded
      eLevy: 0,
      balanceAfter: r2(l.balance),
      counterparty: l.extracted.counterparty || '',
      counterpartyNo: l.extracted.phone || l.extracted.chqNo || '',
      externalId: externalIdFor(fileHash, l),
      reference: l.extracted.ref || l.extracted.chqNo || '',
      matchStatus: 'unmatched',
      // carried extras (additive fields on the embedded line schema)
      bucket,
      bucketConfidence: confidence,
      suggestedContra,
    };
  });

  const totals = {
    totalIn: r2(lines.filter((l) => l.direction === 'in').reduce((s, l) => s + l.amount, 0)),
    totalOut: r2(lines.filter((l) => l.direction === 'out').reduce((s, l) => s + l.amount, 0)),
    totalFees: 0, // fees are ordinary lines here, not a folded amount
  };

  const meta = {
    source: 'bank',
    accountHolder: parsed.meta.accountHolder || null,
    accountMsisdn: null, // n/a for bank; account no. captured on the session/bankAccount
    periodStart: parsed.meta.periodStart,
    periodEnd: parsed.meta.periodEnd,
    openingBalance: parsed.meta.openingBalance,
    closingBalance: parsed.meta.closingBalance,
    // audit evidence carried through:
    fileHash,
    turnover: parsed.validation.turnover,
    balanceChainOk: parsed.validation.balanceChainOk,
    turnoverOk: parsed.validation.turnoverOk,
  };

  return { meta, lines, totals };
}

module.exports = { fidelityToSessionLines };
