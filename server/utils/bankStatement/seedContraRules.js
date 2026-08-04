'use strict';

/**
 * seedContraRules
 * ---------------
 * Lazy, idempotent seeder for the per-tenant bucket -> contra GL map.
 * Opinionated QuickBooks-style defaults so a tenant has working suggestions
 * with zero setup. Writes ONLY to the bankcontrarules collection — never the
 * ledger / journals.
 *
 * Rules:
 *   - Inserts a default only for buckets that have NO rule yet.
 *   - Never modifies an existing rule (so tenant edits are always preserved).
 *   - Safe to call on every Bank Rec open.
 *
 * Usage (later, from a controller):
 *   const seedContraRules = require('../utils/bankStatement/seedContraRules');
 *   await seedContraRules(tenantDb);
 */

const { getModel } = require('../getModel');
const { BUCKETS } = require('./bankBucketClassifier');

// Opinionated defaults. contra = null means "suggest nothing" for that bucket.
const DEFAULTS = {
  'inbound-collection': { contra: '4010', confidence: 'probable', label: 'Inbound collections / income' },
  'cash-deposit':       { contra: '1000', confidence: 'exact',    label: 'Cash banked (from till)' },
  'cheque-out':         { contra: '2000', confidence: 'probable', label: 'Cheque payments to suppliers' },
  'cash-out':           { contra: '1000', confidence: 'probable', label: 'Cash withdrawn' },
  'fee':                { contra: '6800', confidence: 'exact',    label: 'Bank fees & charges' },
  'statutory':          { contra: '2400', confidence: 'probable', label: 'Statutory remittances (tax/SSNIT)' },
  'payroll':            { contra: '6000', confidence: 'exact',    label: 'Salaries & payroll' },
  'reversal':           { contra: null,   confidence: 'low',      label: 'Reversals / returned items' },
  'fx-inbound':         { contra: '1100', confidence: 'probable', label: 'Foreign inbound receipts' },
  'internal-transfer':  { contra: null,   confidence: 'low',      label: 'Internal / own-account transfers' },
  'card-atm':           { contra: '1000', confidence: 'probable', label: 'Card / ATM / POS' },
  'unknown':            { contra: null,   confidence: 'low',      label: 'Unclassified' },
};

/**
 * Ensure every known bucket has a rule on this tenant. Returns a summary.
 * @param {mongoose.Connection} tenantDb
 */
async function seedContraRules(tenantDb) {
  const BankContraRule = getModel(tenantDb, 'BankContraRule');

  const existing = await BankContraRule.find({}, 'bucket').lean();
  const have = new Set(existing.map((r) => r.bucket));

  const toInsert = [];
  for (const bucket of BUCKETS) {
    if (have.has(bucket)) continue; // never touch an existing rule
    const d = DEFAULTS[bucket] || { contra: null, confidence: 'low', label: bucket };
    toInsert.push({
      bucket,
      contraAccountCode: d.contra,
      confidence: d.confidence,
      label: d.label,
      active: true,
      tenantEdited: false,
      source: 'seed',
    });
  }

  if (toInsert.length) {
    // ordered:false so a race that duplicates one bucket can't abort the rest
    // (the unique index on `bucket` makes concurrent seeds safe).
    try {
      await BankContraRule.insertMany(toInsert, { ordered: false });
    } catch (err) {
      // Ignore duplicate-key races (E11000); rethrow anything else.
      if (!err || err.code !== 11000) throw err;
    }
  }

  return { seeded: toInsert.length, total: BUCKETS.length, alreadyPresent: have.size };
}

module.exports = seedContraRules;
