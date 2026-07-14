// server/models/PlatformAdmin.js
// Platform-level administrators (Nexusora staff). Lives in the MASTER database.
// These are NOT tenant users — they administer the platform itself.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const platformAdminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, minlength: 12, select: false },
    role:      { type: String, enum: ['platform_admin', 'platform_owner'], default: 'platform_admin' },
    isActive:  { type: Boolean, default: true },
    lastLogin: Date,
    refreshToken: { type: String, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

platformAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

platformAdminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

platformAdminSchema.methods.isLocked = function () {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

module.exports = mongoose.model('PlatformAdmin', platformAdminSchema);