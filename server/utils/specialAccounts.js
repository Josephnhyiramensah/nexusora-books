// server/utils/specialAccounts.js
//
// The ONE place a POSTING ROLE (accounts receivable, VAT payable, default
// revenue, …) becomes a real ledger account. Before this, every controller
// reached for an account by a hard-coded chart CODE:
//     Account.findOne({ code: '1100' })
// scattered across 18 files in ~83 places. That is a silent correctness risk: a
// tenant can rename or RENUMBER their chart, and the moment code '1100' stops
// meaning Accounts Receivable, a literal lookup either finds nothing (a leg of
// the entry vanishes) or finds the WRONG account (money posts somewhere it
// shouldn't) — while every debit == credit check still passes.
//
// This resolver removes the literal from the controller and makes the mapping
// explicit and per-tenant, the way QuickBooks / Xero handle "special accounts":
//
//     role ──► code (tenant override, else the historical default) ──► Account
//
// Deliberate design decisions:
//   • The map stores role → CODE (a string), not role → _id. The historical
//     fallback is itself a code; codes are this system's stable business
//     identifier (seeded with isSystemAccount:true); and a code map needs no
//     backfill for existing tenants — an unset map resolves EXACTLY as the old
//     literals did, so dropping this in changes nothing until a tenant remaps.
//   • Overrides live on Tenant.settings.specialAccounts (the master doc, already
//     on req.tenant), mirroring settings.documentNumbers: unset ⇒ default.
//   • A few call sites need a SET of accounts, not one (cash position = cash on
//     hand + petty cash + bank). Those are named SETS, and a tenant overrides a
//     set through the SAME Map using a comma-separated list of codes, e.g.
//     specialAccounts.cashAccounts = "1000,1010,1020". No extra schema field.
//   • When a role resolves to a code with no matching account, the resolver
//     THROWS a named error (required) or returns null (optional) — it never
//     silently returns a wrong or empty account. For money, loud beats silent.

const { getModel } = require('./getModel');

// role → historical chart code. These are the literals that were scattered
// across the controllers before this file existed; keeping them here as the
// fallback is what makes the migration behaviour-preserving. Sourced 1:1 from
// server/config/seedData.js and the controllers' prior lookups.
const DEFAULT_CODES = Object.freeze({
  // ─── Receivables / payables ───────────────────────────────────────────────
  accountsReceivable:      '1100', // AR — invoices, payments, customers, dashboard, AI
  accountsPayable:         '2000', // AP — bills, payments, vendors, dashboard, AI
  // ─── Cash ─────────────────────────────────────────────────────────────────
  cashOnHand:              '1000', // Cash — payments made/received in cash
  pettyCash:               '1010', // Petty Cash
  cashAtBank:              '1020', // Bank Accounts — payroll, casual, banking, reconciliation
  mobileMoneyWallet:       '1015', // MoMo wallet — reconciliation (created on first use)
  // ─── Inventory / assets ───────────────────────────────────────────────────
  inventory:               '1200', // Inventory (perpetual asset) — inventoryPosting
  accumulatedDepreciation: '1500', // contra-asset — fixed assets
  staffLoanReceivable:     '1150', // Staff Loan Receivable — payroll recovery
  // ─── Tax ──────────────────────────────────────────────────────────────────
  taxPayable:              '2400', // Taxes Payable — sales/purchase tax on invoices & bills
  vatPayable:              '2410', // VAT Payable (Output VAT) — vouchers
  inputVatRecoverable:     '1310', // Input VAT Recoverable — tax report
  payePayable:             '2400', // payroll posts PAYE here today (parent Taxes Payable)
  payePayableActual:       '2420', // PAYE Payable — what the TAX REPORT reads (see NOTE 1)
  whtPayable:              '2430', // Withholding Tax Payable — tax report
  whtReceivable:           '1320', // Withholding Tax Receivable — tax report
  corporateTaxPayable:     '2440', // Corporate Tax Payable — tax report
  corporateTaxExpense:     '7900', // Corporate Income Tax Expense — tax report
  // ─── Payroll ──────────────────────────────────────────────────────────────
  salaryExpense:           '6000', // Salaries & Wages — payroll
  ssnitPayable:            '2500', // payroll posts SSNIT here today (parent Payroll Liabilities)
  ssnitTier1:              '2510', // SSNIT Tier 1 — tax report
  ssnitTier2:              '2520', // SSNIT Tier 2 — tax report
  ssnitTier3:              '2530', // Provident Fund Tier 3 — tax report / payroll
  casualWages:             '6010', // NOTE 2
  // ─── Revenue / expense defaults ───────────────────────────────────────────
  defaultRevenue:          '4000', // Sales Revenue — an invoice line with no account chosen
  defaultExpense:          '6900', // Miscellaneous Expenses — a bill line with no account chosen
  cogs:                    '5010', // Cost of Goods Sold — perpetual sale posting
  cogsFallback:            '5000', // Purchases — used when 5010 isn't in the chart yet
  depreciationExpense:     '6600', // Depreciation Expense — fixed assets
  bankFees:                '6800', // Bank & Mobile Money Charges — reconciliation
});
//
// NOTE 1 — payePayable vs payePayableActual: payrollController CREDITS PAYE to
// '2400' (the parent, Taxes Payable) while taxController READS PAYE from '2420'
// with no fallback. So the Tax page's PAYE line does not see what payroll
// posted. Both codes are preserved verbatim here so this resolver changes
// NOTHING; reconciling them is a deliberate decision, not a silent edit.
//
// NOTE 2 — casualWages '6010': seedData.js defines 6010 as "Employer SSNIT
// Contribution", but casualController treats 6010 as Casual Wages
// (create-if-missing). On a seeded chart, casual wages therefore post to the
// SSNIT contribution account. Preserved verbatim for the same reason as above.

// Named SETS of codes, for the few call sites that need several accounts at once.
const DEFAULT_SETS = Object.freeze({
  cashAccounts: ['1000', '1010', '1020'], // cash position — reports, AI, forecasting
});

// The tenant's override for a key, or null. Handles BOTH shapes the map can
// arrive in: a Mongoose Map (live request, req.tenant is a doc) exposes .get();
// a plain object (settings API / lean / JSON) uses bracket access.
function rawOverride(req, key) {
  const sa = req && req.tenant && req.tenant.settings && req.tenant.settings.specialAccounts;
  if (!sa) return null;
  const v = typeof sa.get === 'function' ? sa.get(key) : sa[key];
  return (v != null && String(v).trim() !== '') ? String(v).trim() : null;
}

// The code a role resolves to for THIS tenant: an explicit override wins, else
// the historical default. Returns null for an unknown role (a caller bug).
function codeForRole(req, role) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_CODES, role)) return null;
  return rawOverride(req, role) || DEFAULT_CODES[role];
}

// The list of codes a SET resolves to. A tenant override is a comma-separated
// string of codes in the same specialAccounts map, e.g. "1000,1010,1020".
function codesForSet(req, setName) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETS, setName)) return null;
  const ov = rawOverride(req, setName);
  if (!ov) return DEFAULT_SETS[setName].slice();
  const codes = ov.split(',').map((c) => c.trim()).filter(Boolean);
  return codes.length ? codes : DEFAULT_SETS[setName].slice();
}

/**
 * Resolve a posting role to a ledger Account for this tenant.
 *
 * @param {object} req   the request (carries req.tenantDb and req.tenant.settings)
 * @param {string} role  a key of DEFAULT_CODES, e.g. 'accountsReceivable'
 * @param {object} [opts]
 * @param {boolean} [opts.required=true]  true → throw when the account is missing;
 *                                        false → return null instead.
 * @param {boolean} [opts.lean=false]     true → return a lean plain object.
 * @returns {Promise<object|null>} the Account, or null when required:false and
 *   nothing resolves.
 * @throws {Error} code 'SPECIAL_ACCOUNT_UNKNOWN_ROLE' for an unknown role, or
 *   code 'SPECIAL_ACCOUNT_NOT_FOUND' when required and the code has no account.
 */
async function getSpecialAccount(req, role, opts = {}) {
  const { required = true, lean = false } = opts;
  const code = codeForRole(req, role);
  if (code == null) {
    const e = new Error(`Unknown special-account role "${role}".`);
    e.code = 'SPECIAL_ACCOUNT_UNKNOWN_ROLE';
    throw e;
  }

  const Account = getModel(req.tenantDb, 'Account');
  const q = Account.findOne({ code });
  const account = lean ? await q.lean() : await q;

  if (!account && required) {
    const mapped = rawOverride(req, role) != null;
    const e = new Error(
      `The account for "${role}" (code ${code}${mapped ? ', mapped in settings' : ''}) ` +
      `was not found in the chart of accounts. Map it under Settings → Special Accounts, ` +
      `or restore account ${code}.`
    );
    e.code = 'SPECIAL_ACCOUNT_NOT_FOUND';
    e.role = role;
    e.accountCode = code;
    throw e;
  }
  return account || null;
}

/**
 * Resolve a named SET of roles to the matching Accounts (e.g. 'cashAccounts').
 * Returns whatever exists — a missing code is simply absent from the result,
 * which matches the previous `find({ code: { $in: [...] } })` behaviour.
 *
 * @returns {Promise<Array<object>>}
 */
async function getSpecialAccountSet(req, setName, opts = {}) {
  const { lean = true } = opts;
  const codes = codesForSet(req, setName);
  if (codes == null) {
    const e = new Error(`Unknown special-account set "${setName}".`);
    e.code = 'SPECIAL_ACCOUNT_UNKNOWN_SET';
    throw e;
  }
  const Account = getModel(req.tenantDb, 'Account');
  const q = Account.find({ code: { $in: codes } });
  return lean ? q.lean() : q;
}

// Resolve to just the code (no DB hit) — for callers that only need to stamp an
// accountCode, build a message, or compare.
function specialAccountCode(req, role) {
  return codeForRole(req, role);
}

// Resolve a set to just its codes (no DB hit).
function specialAccountSetCodes(req, setName) {
  return codesForSet(req, setName);
}

module.exports = {
  getSpecialAccount,
  getSpecialAccountSet,
  specialAccountCode,
  specialAccountSetCodes,
  DEFAULT_CODES,
  DEFAULT_SETS,
};