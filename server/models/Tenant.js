const mongoose = require('mongoose');

// A tenant-defined custom field (header-level) that appears on a document type.
// Definitions live in Tenant.settings.customFields; the value a user enters is
// snapshotted onto each document so records stay self-describing over time.
const customFieldSchema = new mongoose.Schema({
  id: String,                                  // stable id, generated in the UI
  label: { type: String, trim: true },
  type: { type: String, enum: ['text', 'number', 'date', 'select', 'checkbox'], default: 'text' },
  target: { type: String, enum: ['invoice', 'bill'], default: 'invoice' },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },    // choices when type === 'select'
}, { _id: false });

const tenantSchema = new mongoose.Schema(
  {
    subdomain: {
      type: String, required: [true, 'Subdomain is required'],
      unique: true, lowercase: true, trim: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Subdomain must be lowercase alphanumeric'],
    },
    companyName: { type: String, required: [true, 'Company name is required'], trim: true },
    databaseName: { type: String, required: true, unique: true },
    plan: {
      type: String,
      enum: ['trial', 'starter', 'professional', 'enterprise', 'founding'],
      default: 'trial',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived', 'trial', 'founding', 'expired'],
      default: 'trial',
    },
    owner: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: String,
    },
    settings: {
      fiscalYearStart: { type: Number, default: 1, min: 1, max: 12 },
      baseCurrency: { type: String, default: 'GHS' },
      currencies: { type: [String], default: [] }, // enabled foreign currencies
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      // Maker-checker: when true, entries created by accountants need admin
      // approval before they post. Default off — tenants opt in.
      requireApproval: { type: Boolean, default: false },
      // Per-tenant document number formats for invoices, bills and payments.
      // When a tenant leaves these unset the system falls back to the historical
      // default (INV-000001 / BILL-000001 / PAY-000001), so nothing changes for
      // anyone who doesn't customise. Journals are NOT included — they always use
      // the system entry numbering. The running number is derived from existing
      // documents that share the prefix, so there is no counter to seed or drift.
      documentNumbers: {
        invoice: {
          prefix: { type: String, default: 'INV-' },
          padding: { type: Number, default: 6, min: 1, max: 12 },
          startNumber: { type: Number, default: 1, min: 0 },
        },
        bill: {
          prefix: { type: String, default: 'BILL-' },
          padding: { type: Number, default: 6, min: 1, max: 12 },
          startNumber: { type: Number, default: 1, min: 0 },
        },
        payment: {
          prefix: { type: String, default: 'PAY-' },
          padding: { type: Number, default: 6, min: 1, max: 12 },
          startNumber: { type: Number, default: 1, min: 0 },
        },
      },
      // Tenant-defined header-level custom fields for invoices/bills.
      customFields: { type: [customFieldSchema], default: [] },
      logo: String,
      letterheadImage: String,
      address: String,
      city: String,
      region: String,
      taxId: String,
      letterhead: {
        companyName: String,
        tagline: String,
        address: String,
        phone: String,
        email: String,
        website: String,
      },
      whiteLabel: {
        enabled: { type: Boolean, default: false },
        brandName: String,
        brandTagline: String,
        primaryColor: String,
        accentColor: String,
        customDomain: String,
        hidePoweredBy: { type: Boolean, default: false },
      },
    },
    subscription: {
      plan: { type: String, enum: ['trial', 'starter', 'professional', 'enterprise', 'founding'], default: 'trial' },
      billingCycle: { type: String, enum: ['monthly', 'semi_annual', 'annual'], default: 'monthly' },
      startDate: { type: Date, default: Date.now },
      expiryDate: Date,
      maxUsers: { type: Number, default: 2 },
      maxAccountants: { type: Number, default: 1 },
      amountPaid: { type: Number, default: 0 },
      currency: { type: String, default: 'GHS' },
      paystackCustomerId: String,
      paystackSubscriptionCode: String,
      lastPaymentDate: Date,
      lastPaymentRef: String,
      autoRenew: { type: Boolean, default: false },
    },
    usage: {
      currentUsers: { type: Number, default: 1 },
      currentAccountants: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      storageUsedMB: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

tenantSchema.pre('validate', function (next) {
  if (this.isNew && !this.databaseName) {
    this.databaseName = `nexusora_tenant_${this.subdomain.replace(/-/g, '_')}`;
  }
  // Set subscription defaults based on plan
  if (this.isNew) {
    const planDefaults = {
      trial: { maxUsers: 2, maxAccountants: 1, days: 30 },
      starter: { maxUsers: 5, maxAccountants: 2, days: 30 },
      professional: { maxUsers: 20, maxAccountants: 5, days: 30 },
      enterprise: { maxUsers: 9999, maxAccountants: 9999, days: 30 },
      founding: { maxUsers: 9999, maxAccountants: 9999, days: 36500 },
    };
    const defaults = planDefaults[this.plan] || planDefaults.trial;
    if (!this.subscription) this.subscription = {};
    this.subscription.plan = this.plan;
    this.subscription.maxUsers = defaults.maxUsers;
    this.subscription.maxAccountants = defaults.maxAccountants;
    this.subscription.startDate = new Date();
    this.subscription.expiryDate = new Date(Date.now() + defaults.days * 24 * 60 * 60 * 1000);
  }
  next();
});

// Check if subscription is active
tenantSchema.methods.isSubscriptionActive = function () {
  if (this.plan === 'founding') return true;
  if (!this.subscription?.expiryDate) return false;
  return new Date() < new Date(this.subscription.expiryDate);
};

module.exports = require('mongoose').model('Tenant', tenantSchema);
