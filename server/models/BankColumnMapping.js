'use strict';

/**
 * BankColumnMapping
 * -----------------
 * Per-tenant saved mapping that turns an UNRECOGNIZED bank statement (any
 * xlsx/csv) into the standard { meta, lines, totals } contract. The tenant
 * maps each bank's columns once; every future import from that bank is then
 * automatic. This is what opens reconciliation to any bank without per-bank
 * code — the user confirms column meaning, and the balance-chain check
 * guarantees a wrong mapping is caught before anything imports.
 *
 * No DB coupling here beyond the schema; bound per tenant connection by the
 * central registrar (registerAllModels / getModel).
 */

const { Schema } = require('mongoose');

const ColumnRolesSchema = new Schema(
  {
    // Each value is a source column: either a header name or a 0-based index
    // (stored as string; the reader resolves both). null = not present.
    date: { type: String, default: null },
    valueDate: { type: String, default: null },
    description: { type: String, default: null },
    debit: { type: String, default: null },
    credit: { type: String, default: null },
    amount: { type: String, default: null }, // used when amountConvention = 'signed'
    balance: { type: String, default: null },
    reference: { type: String, default: null },
    counterparty: { type: String, default: null },
  },
  { _id: false }
);

const BankColumnMappingSchema = new Schema(
  {
    // Tenant's label for the bank, e.g. 'GCB', 'Ecobank'. One mapping per bank.
    bankName: { type: String, required: true, unique: true, index: true },

    columns: { type: ColumnRolesSchema, default: () => ({}) },

    // 'separate' = distinct debit & credit columns (Fidelity-style).
    // 'signed'   = one amount column; negative = money out.
    amountConvention: { type: String, enum: ['separate', 'signed'], default: 'separate' },

    // Parsing hints.
    dateFormat: { type: String, default: null }, // e.g. 'DD-MMM-YYYY', 'DD/MM/YYYY'
    headerRow: { type: Number, default: null },     // 0-based row of the header
    dataStartRow: { type: Number, default: null },  // 0-based first data row

    // true once this mapping passed the balance-chain check on a real file.
    sampleValidated: { type: Boolean, default: false },

    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = BankColumnMappingSchema;
