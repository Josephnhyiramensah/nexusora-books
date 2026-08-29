const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  // Singleton — only one document ever exists
  _id: { type: String, default: 'platform' },

  company: {
    name:        { type: String, default: 'Nexusora Technology' },
    developer:   { type: String, default: 'JNK Mensah' },
    email:       { type: String, default: 'nexusoratechnologies@gmail.com' },
    supportEmail:{ type: String, default: 'support@nexusorabooks.com' },
    phone:       { type: String, default: '+233 548 211 310' },
    whatsapp:    { type: String, default: '233548211310' },
    website:     { type: String, default: 'nexusorabooks.com' },
    address:     { type: String, default: 'Kumasi, Ashanti Region, Ghana' },
    tagline:     { type: String, default: 'Where Knowledge Meets Technology' },
  },

  smtp: {
    host:     { type: String, default: 'smtp.gmail.com' },
    port:     { type: Number, default: 587 },
    user:     { type: String, default: '' },
    fromName: { type: String, default: 'Nexusora Books' },
  },

  subscription: {
    trialDays:        { type: Number, default: 30 },
    starterPrice:     { type: Number, default: 300 },
    professionalPrice:{ type: Number, default: 990 },
    enterprisePrice:  { type: Number, default: 2400 },
    currency:         { type: String, default: 'GHS' },
    paystackEnabled:  { type: Boolean, default: true },
  },

  branding: {
    platformName: { type: String, default: 'Nexusora Books' },
    logoUrl:      { type: String, default: '' },
    primaryColor: { type: String, default: '#1A3560' },
    accentColor:  { type: String, default: '#C9A227' },
  },

  // Global default Ghana statutory payroll rates. Tenants inherit these unless
  // they set their own override in Tenant.settings.payrollRates. Editable only
  // from the master console. Leaving this empty means tenants fall back to the
  // hardcoded defaults in server/config/payrollRates.js.
  payrollRates: {
    // PAYE progressive monthly bands. upTo:null = highest band (no upper limit).
    payeBands: {
      type: [{ upTo: Number, rate: Number }],
      default: undefined,
    },
    ssnit: {
      employeeRate: { type: Number, default: undefined }, // e.g. 0.055
      employerRate: { type: Number, default: undefined }, // e.g. 0.13
    },
    label: { type: String, default: '' }, // e.g. "GRA 2026 monthly bands"
  },

  lastUpdatedBy: { type: String, default: 'system' },
}, { timestamps: true });

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);