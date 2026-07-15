// server/models/User.js
// Collection: users (per-tenant database)
// Exports SCHEMA (not model) — registered per-connection via getModel()

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Brute-force policy. Progressive: each lockout is longer than the last, so an
// attacker slows to a crawl while a genuine user who mistypes twice is unaffected.
const MAX_ATTEMPTS = 5;
const LOCK_DURATIONS_MIN = [15, 30, 60, 240];   // 4th+ lockout = 4 hours

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'accountant', 'staff', 'viewer'],
      default: 'staff',
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    refreshToken: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },

    // ─── Brute-force protection ───────────────────────────────────────────────
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutCount: { type: Number, default: 0 },     // how many times locked historically
    lockedUntil: { type: Date, default: null },
    lastFailedLogin: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Lockout helpers ──────────────────────────────────────────────────────────

userSchema.methods.isLocked = function () {
  return !!(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
};

userSchema.methods.minutesUntilUnlock = function () {
  if (!this.isLocked()) return 0;
  return Math.ceil((this.lockedUntil.getTime() - Date.now()) / 60000);
};

/**
 * Record a failed login. Locks the account once MAX_ATTEMPTS is reached,
 * for progressively longer each time. Auto-expires — never permanent, so a
 * malicious third party cannot lock a user out indefinitely.
 */
userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  this.lastFailedLogin = new Date();

  if (this.failedLoginAttempts >= MAX_ATTEMPTS) {
    const idx = Math.min(this.lockoutCount || 0, LOCK_DURATIONS_MIN.length - 1);
    const minutes = LOCK_DURATIONS_MIN[idx];
    this.lockedUntil = new Date(Date.now() + minutes * 60 * 1000);
    this.lockoutCount = (this.lockoutCount || 0) + 1;
    this.failedLoginAttempts = 0;
  }

  await this.save({ validateBeforeSave: false });
  return this.isLocked();
};

/** Clear counters after a successful login. */
userSchema.methods.registerSuccessfulLogin = async function (ip) {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  if (ip) this.lastLoginIp = ip;
  await this.save({ validateBeforeSave: false });
};

// Full name virtual
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = userSchema;