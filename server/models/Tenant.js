const mongoose = require('mongoose');

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
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
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