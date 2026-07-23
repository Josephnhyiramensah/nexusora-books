// server/config/permissions.js
// Catalogue of grantable permissions. Deliberately coarse (module-level): an
// admin grants a whole area, not individual fields. Each key names the roles
// that already have it implicitly — a grant only ever ADDS access on top of a
// role, it never removes it.

const PERMISSIONS = [
  { key: 'reports.view',   label: 'Financial Reports',   description: 'Trial Balance, P&L, Balance Sheet, Cash Flow, General Ledger', impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'analytics.view', label: 'Financial Analytics', description: 'Charts, ratios and financial insights',                        impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'payroll.view',   label: 'Payroll',             description: 'Employees, salaries, PAYE and SSNIT',                          impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'banking.view',   label: 'Banking',             description: 'Bank accounts and reconciliation',                             impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'budget.view',    label: 'Budget',              description: 'Budgets and variance analysis',                                impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'tax.view',       label: 'Tax',                 description: 'VAT, PAYE and corporate tax summaries',                        impliedBy: ['super_admin', 'admin', 'accountant'] },
  { key: 'audit.view',     label: 'Audit Log',           description: 'Security and activity trail',                                  impliedBy: ['super_admin', 'admin'] },
];

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

module.exports = { PERMISSIONS, PERMISSION_KEYS };