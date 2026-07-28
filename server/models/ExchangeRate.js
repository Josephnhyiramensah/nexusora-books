// server/models/ExchangeRate.js
// Per-tenant exchange rates. Each row is a rate for one currency against the
// tenant's base currency, as of a date. Manual entries take precedence over
// live-fetched ones for the same currency/day.
const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema(
  {
    base: { type: String, required: true, uppercase: true, trim: true, default: 'GHS' },
    currency: { type: String, required: true, uppercase: true, trim: true },
    // How many units of BASE currency equal 1 unit of `currency`.
    // e.g. base GHS, currency USD, rate 11.66  →  1 USD = 11.66 GHS
    rate: { type: Number, required: true, min: 0 },
    asOf: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ['manual', 'live'], default: 'manual' },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

exchangeRateSchema.index({ currency: 1, asOf: -1 });
exchangeRateSchema.index({ currency: 1, source: 1, asOf: -1 });

module.exports = exchangeRateSchema;
