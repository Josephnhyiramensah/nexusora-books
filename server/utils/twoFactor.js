// server/utils/twoFactor.js
// TOTP (RFC 6238) + backup-code primitives for tenant-user two-factor auth.
//
// This module is the ONLY place that knows how 2FA secrets and backup codes
// are encoded. The canonical backup-code form defined here (CODE_ALPHABET,
// uppercase, hyphen-free) MUST stay in lockstep with the normalisation in
// User.js → verifyAndBurnBackupCode(), or valid codes will fail to match.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Label shown in the authenticator app (Google Authenticator / Authy).
const TOTP_ISSUER = 'Nexusora Books';

// Accept codes from the adjacent 30s window on each side (±1 step) to absorb
// clock skew between the server and the user's phone. window:1 is the common,
// sane default — larger windows widen the guessing surface.
authenticator.options = { window: 1 };

// Backup-code shape.
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;          // characters per code (excludes hyphen)
// Crockford-style alphabet: uppercase + digits, minus easily-confused glyphs
// (0/O, 1/I/L). Uppercase-only so the model's .toUpperCase() normalise is a
// no-op and can never change a character.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
// Backup codes are high-entropy random strings, so a lighter bcrypt cost than
// the password (12) is safe here and keeps redemption — which may bcrypt.compare
// up to BACKUP_CODE_COUNT times in a loop — responsive. compare() reads the cost
// from each hash, so this value is not coupled to verification.
const BACKUP_CODE_SALT_ROUNDS = 10;

/**
 * Generate a fresh base32 TOTP secret. Store provisionally (twoFactorPendingSecret)
 * until the user proves possession by verifying a code against it.
 */
const generateTotpSecret = () => authenticator.generateSecret();

/**
 * Build the otpauth:// URI that the QR encodes and manual-entry uses.
 * accountName (the user's email) is what appears under the issuer in the app.
 */
const buildOtpauthUri = (secret, accountName) =>
  authenticator.keyuri(accountName, TOTP_ISSUER, secret);

/**
 * Render an otpauth URI to a PNG data URL (data:image/png;base64,...) that the
 * frontend can drop straight into an <img src>. Async.
 */
const generateQrDataUrl = async (otpauthUri) =>
  QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 2, width: 240 });

/**
 * Verify a 6-digit TOTP token against a secret. Defensive: strips whitespace,
 * rejects non-numeric input, and never throws (a malformed secret → false).
 */
const verifyTotp = (token, secret) => {
  if (!secret) return false;
  const cleaned = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ token: cleaned, secret });
  } catch {
    return false;
  }
};

/**
 * Pick one character from CODE_ALPHABET using rejection-free unbiased selection.
 */
const randomChar = () => CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];

/**
 * Format a raw code (all letters, no separator) for human display: a single
 * hyphen at the midpoint, e.g. "A7K2M-9PQR4". The hyphen is cosmetic — it is
 * stripped before hashing and before verification.
 */
const prettyFormat = (raw) => {
  const mid = Math.floor(raw.length / 2);
  return `${raw.slice(0, mid)}-${raw.slice(mid)}`;
};

/**
 * Generate a fresh set of backup codes.
 *
 * Returns:
 *   - display: string[]  → hyphenated codes to show the user ONCE. Never stored.
 *   - hashed:  string[]  → bcrypt hashes of the canonical (hyphen-free,
 *                          uppercase) form, to persist in twoFactorBackupCodes.
 *
 * The two arrays are positionally aligned but only `hashed` is ever saved.
 */
const generateBackupCodes = async (count = BACKUP_CODE_COUNT) => {
  const display = [];
  const hashed = [];

  for (let i = 0; i < count; i += 1) {
    let raw = '';
    for (let j = 0; j < BACKUP_CODE_LENGTH; j += 1) raw += randomChar();
    // raw is already uppercase + hyphen-free → this IS the canonical form.
    // eslint-disable-next-line no-await-in-loop
    const hash = await bcrypt.hash(raw, BACKUP_CODE_SALT_ROUNDS);
    display.push(prettyFormat(raw));
    hashed.push(hash);
  }

  return { display, hashed };
};

module.exports = {
  TOTP_ISSUER,
  generateTotpSecret,
  buildOtpauthUri,
  generateQrDataUrl,
  verifyTotp,
  generateBackupCodes,
};