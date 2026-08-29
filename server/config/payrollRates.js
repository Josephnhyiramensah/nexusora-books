// server/config/payrollRates.js
//
// Single source of truth for Ghana statutory payroll rates (PAYE + SSNIT).
//
// These are the DEFAULT (fallback) values. Actual rates used by a payroll run
// are resolved in this order:
//   1. Tenant override      (Tenant.settings.payrollRates)     — set by tenant super_admin/admin
//   2. Global default       (PlatformSettings.payrollRates)    — set by platform (master console)
//   3. Hardcoded fallback   (this file)                        — so payroll never breaks
//
// PAYE is progressive (monthly bands). SSNIT is a flat percentage split between
// employee (5.5%) and employer (13%).

// GRA 2026 PAYE Tax Bands (monthly). upTo = null means "and above" (Infinity).
const DEFAULT_PAYE_BANDS = [
  { upTo: 490, rate: 0 },
  { upTo: 600, rate: 0.05 },
  { upTo: 730, rate: 0.10 },
  { upTo: 3896.67, rate: 0.175 },
  { upTo: 20000, rate: 0.25 },
  { upTo: 50000, rate: 0.30 },
  { upTo: null, rate: 0.35 },   // null = highest band, no upper limit
];

const DEFAULT_SSNIT = {
  employeeRate: 0.055,   // 5.5% employee contribution
  employerRate: 0.13,    // 13% employer contribution
};

const DEFAULT_LABEL = 'GRA 2026 monthly bands';

// Normalise a bands array: coerce numbers, turn null/undefined/0-less-than upper
// into Infinity for the top band, sort ascending, drop invalid rows.
function normaliseBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) return null;
  const cleaned = bands
    .map((b) => ({
      upTo: (b.upTo === null || b.upTo === undefined || b.upTo === '' ) ? Infinity : Number(b.upTo),
      rate: Number(b.rate),
    }))
    .filter((b) => Number.isFinite(b.rate) && b.rate >= 0 && b.rate <= 1 && !Number.isNaN(b.upTo))
    .sort((a, b) => a.upTo - b.upTo);
  return cleaned.length ? cleaned : null;
}

function validSsnit(s) {
  if (!s) return null;
  const employeeRate = Number(s.employeeRate);
  const employerRate = Number(s.employerRate);
  if (![employeeRate, employerRate].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return null;
  return { employeeRate, employerRate };
}

/**
 * Resolve the effective payroll rates for a tenant.
 * @param {object} tenantRates  Tenant.settings.payrollRates (may be undefined)
 * @param {object} globalRates  PlatformSettings.payrollRates (may be undefined)
 * @returns {{ payeBands, ssnit, label, source }}
 */
function resolvePayrollRates(tenantRates, globalRates) {
  // PAYE bands: tenant → global → default
  const tenantBands = tenantRates && tenantRates.payeBands && normaliseBands(tenantRates.payeBands);
  const globalBands = globalRates && globalRates.payeBands && normaliseBands(globalRates.payeBands);
  const payeBands = tenantBands || globalBands || normaliseBands(DEFAULT_PAYE_BANDS);

  // SSNIT: tenant → global → default
  const tenantSsnit = tenantRates && validSsnit(tenantRates.ssnit);
  const globalSsnit = globalRates && validSsnit(globalRates.ssnit);
  const ssnit = tenantSsnit || globalSsnit || { ...DEFAULT_SSNIT };

  // Label + source (for display + the historical snapshot)
  let source = 'default';
  let label = DEFAULT_LABEL;
  if (tenantBands || tenantSsnit) {
    source = 'tenant';
    label = (tenantRates && tenantRates.label) || 'Custom (this company)';
  } else if (globalBands || globalSsnit) {
    source = 'global';
    label = (globalRates && globalRates.label) || DEFAULT_LABEL;
  }

  return { payeBands, ssnit, label, source };
}

/**
 * Progressive PAYE calculation over a resolved bands array.
 */
function calculatePAYE(taxableIncome, payeBands) {
  const bands = normaliseBands(payeBands) || normaliseBands(DEFAULT_PAYE_BANDS);
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;
  for (const band of bands) {
    const upper = Number.isFinite(band.upTo) ? band.upTo : Infinity;
    const bandWidth = upper - prevLimit;
    const taxable = Math.min(remaining, bandWidth);
    if (taxable <= 0) { prevLimit = upper; continue; }
    tax += taxable * band.rate;
    remaining -= taxable;
    prevLimit = upper;
    if (remaining <= 0) break;
  }
  return Math.round(tax * 100) / 100;
}

module.exports = {
  DEFAULT_PAYE_BANDS,
  DEFAULT_SSNIT,
  DEFAULT_LABEL,
  normaliseBands,
  resolvePayrollRates,
  calculatePAYE,
};
