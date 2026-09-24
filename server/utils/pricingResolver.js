// server/utils/pricingResolver.js
//
// SINGLE source of truth for subscription pricing — plan prices AND per-branch
// fees. Reads console-set values from PlatformSettings.subscription, falling back
// to built-in defaults. So a price change is one edit (a console field once the
// screen exists; the DEFAULTS here until then) and BOTH the Paystack charge and
// any display read the same number — they can never drift apart.
//
// Amounts are handled in CEDIS here (matching how the console stores them) and
// converted to pesewas only at the Paystack boundary.
//
// Billing cycles carry a built-in discount, taken from the historical price list:
//   monthly = 1x, semi_annual = 5x (one month free), annual = 9x (three free).
// Branch fees get the SAME cycle discount as the plan, so a branch on an annual
// cycle is discounted just like the plan is.

const CYCLE_MULTIPLIER = { monthly: 1, semi_annual: 5, annual: 9 };
const CYCLE_DAYS = { monthly: 30, semi_annual: 180, annual: 365 };

// Built-in defaults (CEDIS, monthly). Used until the console overrides them.
// Head office is included in the base; perBranch is the fee per EXTRA active branch.
const DEFAULTS = {
  starter:      { base: 300,  perBranch: 200 },
  professional: { base: 990,  perBranch: 500 },
  enterprise:   { base: 2400, perBranch: 1000 },
};

// Load effective monthly cedi prices, console value winning over the default.
// `settings` is a PlatformSettings doc (or null). Missing/zero fields fall back.
function loadPricing(settings) {
  const s = (settings && settings.subscription) || {};
  const pick = (val, def) => (Number.isFinite(Number(val)) && Number(val) > 0 ? Number(val) : def);
  return {
    starter: {
      base: pick(s.starterPrice, DEFAULTS.starter.base),
      perBranch: pick(s.starterBranchPrice, DEFAULTS.starter.perBranch),
    },
    professional: {
      base: pick(s.professionalPrice, DEFAULTS.professional.base),
      perBranch: pick(s.professionalBranchPrice, DEFAULTS.professional.perBranch),
    },
    enterprise: {
      base: pick(s.enterprisePrice, DEFAULTS.enterprise.base),
      perBranch: pick(s.enterpriseBranchPrice, DEFAULTS.enterprise.perBranch),
    },
  };
}

/**
 * Compute the amount for a payment, in PESEWAS (Paystack's unit), with a
 * human-readable breakdown in cedis.
 *
 * @param settings     PlatformSettings doc (or null → all defaults)
 * @param plan         'starter' | 'professional' | 'enterprise'
 * @param billingCycle 'monthly' | 'semi_annual' | 'annual'
 * @param extraBranches number of EXTRA active branches (active − 1, min 0)
 * @returns { ok, amountPesewas, days, breakdown } or { ok:false, error }
 */
function computeAmount(settings, plan, billingCycle, extraBranches = 0) {
  const pricing = loadPricing(settings);
  const p = pricing[plan];
  const mult = CYCLE_MULTIPLIER[billingCycle];
  const days = CYCLE_DAYS[billingCycle];
  if (!p) return { ok: false, error: 'Invalid plan.' };
  if (!mult) return { ok: false, error: 'Invalid billing cycle.' };

  const extra = Math.max(0, Number(extraBranches) || 0);

  // All maths in cedis, then × 100 → pesewas at the end.
  const baseCedis = p.base * mult;
  const branchCedis = extra * p.perBranch * mult;
  const totalCedis = baseCedis + branchCedis;

  return {
    ok: true,
    amountPesewas: Math.round(totalCedis * 100),
    days,
    breakdown: {
      plan,
      billingCycle,
      currency: 'GHS',
      baseMonthly: p.base,
      perBranchMonthly: p.perBranch,
      cycleMultiplier: mult,
      extraBranches: extra,
      baseAmount: baseCedis,
      branchAmount: branchCedis,
      totalAmount: totalCedis,
    },
  };
}

module.exports = { loadPricing, computeAmount, DEFAULTS, CYCLE_MULTIPLIER, CYCLE_DAYS };