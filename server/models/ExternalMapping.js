'use strict';

/**
 * ExternalMapping
 * ---------------
 * Per-tenant, per-source mapping that turns a RAW payload from an external
 * system (e.g. the KGR PHP gold app) into a Books voucher — without hardcoding
 * that system's structure. Mirrors the philosophy of BankColumnMapping: the
 * admin maps the external system's fields, accounts and types ONCE, and every
 * future inbound record is translated automatically.
 *
 * Three translation layers:
 *   1. fieldMap    — external field name -> our voucher field
 *   2. accountMap  — external account id/name -> our Books account code
 *   3. typeMap     — external transaction type -> our voucherType
 */

const { Schema } = require('mongoose');

// external field name (or dotted path) that supplies each of our voucher fields.
const FieldMapSchema = new Schema(
  {
    voucherType:  { type: String, default: null }, // external field holding the type (optional if fixed)
    date:         { type: String, default: null },
    amount:       { type: String, default: null },
    narration:    { type: String, default: null },
    reference:    { type: String, default: null },
    externalId:   { type: String, default: null }, // REQUIRED mapping — the source row's unique id
    partyName:    { type: String, default: null },
    mode:         { type: String, default: null },
    debitAccount: { type: String, default: null }, // external field holding their debit account id
    creditAccount:{ type: String, default: null }, // external field holding their credit account id
  },
  { _id: false }
);

// external account id/name -> our Books account code.
const AccountMapEntrySchema = new Schema(
  {
    externalAccount: { type: String, required: true }, // e.g. "45" or "Cash A/C"
    booksCode:       { type: String, required: true }, // e.g. "1020"
    label:           { type: String, default: '' },    // optional human note
  },
  { _id: false }
);

// external transaction type -> our voucherType.
const TypeMapEntrySchema = new Schema(
  {
    externalType: { type: String, required: true },  // e.g. "receipt", "payment", "1", "SALE"
    voucherType:  { type: String, required: true },  // one of our 9 types
  },
  { _id: false }
);

const ExternalMappingSchema = new Schema(
  {
    // Which external system this mapping is for. One mapping per source.
    source: { type: String, required: true, unique: true, index: true }, // e.g. 'kgr_php_gold'
    label:  { type: String, default: '' }, // friendly name for the UI

    fieldMap:   { type: FieldMapSchema, default: () => ({}) },
    accountMap: { type: [AccountMapEntrySchema], default: [] },
    typeMap:    { type: [TypeMapEntrySchema], default: [] },

    // If the source always sends one voucher type, set it here and leave
    // fieldMap.voucherType null.
    fixedVoucherType: { type: String, default: null },

    // Post vouchers immediately on import (vs. leaving as draft for review).
    autopost: { type: Boolean, default: true },

    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = ExternalMappingSchema;
