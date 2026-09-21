// server/models/Branch.js
//
// A branch (a.k.a. location) inside a single tenant's own database. This is the
// multi-branch equivalent of QuickBooks "Locations" / Xero "Tracking" — it lives
// ENTIRELY within one company's already-isolated tenant DB and never crosses the
// tenant boundary. Transactions carry a `branch` tag; a company that never adds a
// second branch simply has one (its Head Office) and never sees a selector.
//
// Every tenant gets exactly one Head Office branch (isHeadOffice: true), created
// by the migration. `code` drives per-branch document numbering (e.g. ACC-PV-000001).

const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
    },
    // Short uppercase code used as the numbering prefix and quick reference.
    // Unique within this tenant DB. e.g. "HO", "ACC", "TAK".
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 8,
    },
    // Exactly one branch per tenant is the Head Office. The migration creates it;
    // it cannot be deactivated (guarded in the controller in a later phase).
    isHeadOffice: {
      type: Boolean,
      default: false,
    },
    // Optional branch-level contact block, used to head branch documents/prints.
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    region: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // Deactivating (never deleting) keeps history intact and stops the branch
    // counting toward billing from the next cycle. Head Office stays active.
    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// `code` is unique per tenant database (each tenant has its own Branch collection).
branchSchema.index({ code: 1 }, { unique: true });
branchSchema.index({ isHeadOffice: 1 });
branchSchema.index({ isActive: 1 });

module.exports = branchSchema;