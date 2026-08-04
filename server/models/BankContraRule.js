'use strict';

/**
 * BankContraRule
 * --------------
 * Per-tenant map: semantic bucket -> suggested contra GL account code.
 * Drives the `suggestedContra` on unmatched statement lines. It is only ever
 * a SUGGESTION on lines the user confirms — it never auto-posts anything.
 *
 * `bucket` values mirror BUCKETS in utils/bankStatement/bankBucketClassifier.js.
 * `contraAccountCode` is a chart-of-accounts code string (e.g. '6800'),
 * consistent with how COA codes are used elsewhere (not an ObjectId ref).
 *
 * One rule per bucket (unique index) so the lazy seeder is idempotent and a
 * tenant's edits are never duplicated or clobbered.
 *
 * Multi-tenant: exports the *schema*, bound per tenant connection by the
 * central registrar (registerAllModels / getModel).
 */

const { Schema } = require('mongoose');

const BankContraRuleSchema = new Schema(
  {
    bucket: { type: String, required: true, unique: true, index: true },

    // Suggested contra GL code (chart-of-accounts code). null = suggest nothing.
    contraAccountCode: { type: String, default: null },

    // How strongly to present the suggestion in the UI: 'exact' renders
    // confidently, 'probable'/'low' render as "best guess, please confirm".
    confidence: { type: String, enum: ['exact', 'probable', 'low'], default: 'probable' },

    // Human label for Settings UI (e.g. "Bank fees & charges").
    label: { type: String, default: null },

    // false = tenant disabled suggestions for this bucket (still classified,
    // just no contra suggested).
    active: { type: Boolean, default: true },

    // true once a tenant edits it, so the seeder knows never to touch it again.
    tenantEdited: { type: Boolean, default: false },

    // provenance: 'seed' (created by default seeder) or 'tenant'
    source: { type: String, enum: ['seed', 'tenant'], default: 'seed' },
  },
  { timestamps: true }
);

module.exports = BankContraRuleSchema;
