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
 * Translation layers:
 *   1. fieldMap    — external field name -> our voucher field
 *   2. accountMap  — external account id/name -> our Books account code
 *   3. typeMap     — external transaction type -> our voucherType
 *   4. branchMap   — external branch id/name -> our Books branch code
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
    partyId:      { type: String, default: null }, // external PERSON/ledger id (sub-ledger key, distinct from the row's externalId)
    mode:         { type: String, default: null },
    debitAccount: { type: String, default: null }, // external field holding their debit account/ledger id
    creditAccount:{ type: String, default: null }, // external field holding their credit account/ledger id
    branch:       { type: String, default: null }, // external field holding their branch id (optional)
    // Group-driven classification (preferred): the external field holding each
    // leg's ledger GROUP id, and the ledger description used to name a party.
    // When a leg's group is one of partyGroups, that leg becomes the person's
    // sub-ledger automatically; any other group is looked up in accountMap.
    debitGroup:   { type: String, default: null },
    creditGroup:  { type: String, default: null },
    debitName:    { type: String, default: null }, // ledger_desc of the debit leg
    creditName:   { type: String, default: null }, // ledger_desc of the credit leg
    companyId:    { type: String, default: null }, // external field holding the company id (for the guard)
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
    // Per-person sub-ledger classification. When set, this transaction type
    // posts the party's ledger on this side; the other leg stays the mapped
    // contra account. 'debit' = party owes us more (advance); 'credit' = we
    // settle/owe the party (gold received). null/absent = no party ledger
    // (an ordinary two-account voucher).
    partySide:    { type: String, enum: ['debit', 'credit', null], default: null },
  },
  { _id: false }
);

// external branch id/name -> our Books branch code.
const BranchMapEntrySchema = new Schema(
  {
    externalBranch:  { type: String, required: true }, // e.g. "1", "PATASI"
    booksBranchCode: { type: String, required: true }, // our Branch.code, e.g. "HO", "KP"
    label:           { type: String, default: '' },    // optional human note
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
    branchMap:  { type: [BranchMapEntrySchema], default: [] },

    // If the source always sends one voucher type, set it here and leave
    // fieldMap.voucherType null.
    fixedVoucherType: { type: String, default: null },

    // If the source does not send a branch (or always belongs to one branch),
    // set the Books branch code here. Used as the fallback when no per-record
    // branch is mapped. Leave null to require an explicit/mapped branch.
    fixedBranch: { type: String, default: null },

    // Per-person sub-ledger settings. When a transaction type carries a
    // partySide, the party's ledger is auto-provisioned under this control
    // account with this code prefix (e.g. control 1100, prefix 'SL-' →
    // account 'SL-<partyId>'). Defaults suit a single AR/AP control.
    partyControlCode: { type: String, default: '1100' },        // receivable-side control (groups in partyGroups but not payable)
    partyCodePrefix:  { type: String, default: 'SL-' },
    // Group-driven classification. partyGroups = the ledger-group ids that mean
    // "a person/party ledger" (default 4 = Account Receivables, 7 = Account
    // Payables). payableGroups = the subset of those that roll up under the
    // payable control. Comma-separated ids.
    partyGroups:             { type: String, default: '4,7' },
    partyPayableGroups:      { type: String, default: '7' },
    partyPayableControlCode: { type: String, default: '2000' }, // control for payable-group party ledgers
    // Company guard: when set, an inbound record whose company field does not
    // equal this value is rejected (keeps another company's data out of this
    // tenant). Leave null to accept any company.
    sourceCompanyId:         { type: String, default: null },

    // Post vouchers immediately on import (vs. leaving as draft for review).
    autopost: { type: Boolean, default: true },

    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = ExternalMappingSchema;
