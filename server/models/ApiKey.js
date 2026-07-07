const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  name: { type: String, required: true },
  hashedKey: { type: String, required: true, unique: true },
  keyPrefix: String, // e.g. "nbk_kgr_a8f3..." — shown in UI
  permissions: [{
    type: String,
    enum: ['read', 'write', 'invoices', 'journals', 'reports', 'payroll'],
    default: 'read',
  }],
  isActive: { type: Boolean, default: true },
  expiresAt: Date,
  lastUsed: Date,
  requestCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = apiKeySchema;