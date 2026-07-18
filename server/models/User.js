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

    // ─── Two-factor authentication (TOTP) ─────────────────────────────────────
    twoFactorEnabled: { type: Boolean, default: false },
    // Confirmed, active TOTP secret. Only set once enrolment is verified.
    twoFactorSecret: { type: String, select: false },
    // Provisional secret held DURING enrolment. A user who is already enrolled
    // and starts a re-enrolment gets a new pending secret here; their working
    // twoFactorSecret is untouched until they confirm a code against this one.
    twoFactorPendingSecret: { type: String, select: false },
    // Single-use recovery codes, bcrypt-hashed. Shown to the user once at
    // generation and never retrievable again. A code is removed when redeemed.
    twoFactorBackupCodes: { type: [String], select: false, default: undefined },

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

// ─── Two-factor helpers ────────────────────────────────────────────────────────

/**
 * Verify a candidate backup/recovery code and, on success, BURN it (single-use).
 *
 * The document must have been fetched with `.select('+twoFactorBackupCodes')`,
 * otherwise there is nothing to compare against and this returns false.
 *
 * Candidate normalisation (strip non-alphanumerics, uppercase) MUST mirror the
 * canonical form used when the codes were hashed (see utils/twoFactor.js), or
 * valid codes will silently fail to match.
 *
 * Returns true if a code matched (and was removed + persisted), else false.
 */
userSchema.methods.verifyAndBurnBackupCode = async function (candidate) {
  const codes = this.twoFactorBackupCodes;
  if (!Array.isArray(codes) || codes.length === 0) return false;

  const normalised = String(candidate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!normalised) return false;

  for (let i = 0; i < codes.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const match = await bcrypt.compare(normalised, codes[i]);
    if (match) {
      codes.splice(i, 1);                 // single-use: remove the redeemed code
      this.markModified('twoFactorBackupCodes');
      await this.save({ validateBeforeSave: false });
      return true;
    }
  }
  return false;
};

// Full name virtual
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Serialise virtuals, and defensively strip every secret field so a stray
// res.json(userDoc) can never leak credentials or 2FA material.
userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.twoFactorSecret;
    delete ret.twoFactorPendingSecret;
    delete ret.twoFactorBackupCodes;
    return ret;
  },
});
userSchema.set('toObject', { virtuals: true });

module.exports = userSchema;