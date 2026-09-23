// server/utils/aiContext.js
// Builds the live company data block for an AI session.
//
// The gate is at LOAD time, not in the prompt. Data a user may not see is never
// fetched, so it never enters the context window -- no phrasing, roleplay or
// injected instruction can extract what was never there.
//
// MULTI-BRANCH: figures honour the request's branch scope. When a branch is
// selected (X-Branch header), the assistant reasons about THAT branch's numbers;
// consolidated by default. Balances come from the shared branchLedger helper, so
// a branch view can never surface another branch's figures — the scoped data is
// all that is ever loaded.
const { getModel } = require('./getModel');
const { effectivePermissions } = require('./aiAccess');
const { ledgerMovement, acctSignedBalance } = require('./branchLedger');
const { scopedFilter } = require('./branchScope');

const money = (n) => 'GHS ' + Number(n || 0).toFixed(2);
const day = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');

// req is threaded through so balances/documents can be branch-scoped. It is
// optional: without it, everything falls back to consolidated (stored balances,
// unscoped queries) — identical to the pre-branch behaviour.
async function buildAIContext(user, tenantDb, tenant, req) {
  const perms = effectivePermissions(user);
  const has = (k) => perms.has(k);
  const parts = [];
  const withheld = [];

  // A scope-aware filter/movement that degrades to consolidated when req is absent.
  const scoped = (extra = {}) => (req ? scopedFilter(req, extra) : extra);
  let movement = null; // per-account signed movement, loaded lazily below.

  parts.push('COMPANY: ' + (tenant?.companyName || 'Unknown') + ' | Plan: ' + (tenant?.plan || '') + ' | Currency: GHS');

  // Chart of accounts WITHOUT balances. Names and codes are structural, not
  // financial, and every role can open the accounts list in the app.
  try {
    const Account = getModel(tenantDb, 'Account');
    const accounts = await Account.find({ isActive: true }).select('code name type').sort({ code: 1 }).lean();
    if (accounts.length) {
      parts.push('CHART OF ACCOUNTS (' + accounts.length + '): ' +
        accounts.map((a) => a.code + ' ' + a.name + ' (' + a.type + ')').join('; '));
    }
  } catch (e) { console.error('[AIContext] accounts:', e.message); }

  // ---- reports.view : balances, position, journals -------------------------
  if (has('reports.view')) {
    try {
      const Account = getModel(tenantDb, 'Account');
      const JournalEntry = getModel(tenantDb, 'JournalEntry');
      const all = await Account.find({ isActive: true }).select('code name type normalBalance balance').lean();
      // Branch-aware balances: consolidated → stored; scoped → ledger tally.
      if (req) movement = await ledgerMovement(req, JournalEntry);
      const bal = (a) => acctSignedBalance(a, movement);
      const sumAbs = (types) => all.filter((a) => types.includes(a.type))
        .reduce((s, a) => s + Math.abs(bal(a)), 0);
      const revenue = sumAbs(['revenue']);
      const expenses = sumAbs(['expense', 'cogs']);
      parts.push([
        'FINANCIAL POSITION (live' + (req && movement ? ', selected branch' : '') + '):',
        '  Total revenue: ' + money(revenue),
        '  Total expenses: ' + money(expenses),
        '  Net income: ' + money(revenue - expenses),
        '  Total assets: ' + money(sumAbs(['asset'])),
        '  Total liabilities: ' + money(sumAbs(['liability'])),
        '  Total equity: ' + money(sumAbs(['equity'])),
      ].join('\n'));

      const nonZero = all.filter((a) => Math.abs(bal(a)) > 0.005);
      if (nonZero.length) {
        parts.push('ACCOUNT BALANCES:\n' + nonZero
          .map((a) => '  ' + a.code + ' ' + a.name + ' (' + a.type + '): ' + money(bal(a))).join('\n'));
      }
    } catch (e) { console.error('[AIContext] balances:', e.message); }

    try {
      const JournalEntry = getModel(tenantDb, 'JournalEntry');
      const entries = await JournalEntry.find(scoped({ status: 'posted' }))
        .sort({ date: -1 }).limit(25)
        .select('entryNumber date description totalDebit journalType').lean();
      if (entries.length) {
        parts.push('RECENT POSTED JOURNALS (latest 25):\n' + entries
          .map((e) => '  ' + day(e.date) + ' ' + (e.entryNumber || '') + ' ' +
            (e.description || '') + ' ' + money(e.totalDebit)).join('\n'));
      }
    } catch (e) { console.error('[AIContext] journals:', e.message); }
  } else {
    withheld.push('financial statements, account balances and journals (needs Financial Reports access)');
  }

  // ---- open to every authenticated user (matches the route guards) ---------
  try {
    const Invoice = getModel(tenantDb, 'Invoice');
    const open = await Invoice.find(scoped({ status: { $in: ['sent', 'partially_paid'] } })).select('balance dueDate').lean();
    const overdue = open.filter((i) => i.dueDate && new Date(i.dueDate) < new Date());
    parts.push('RECEIVABLES: ' + open.length + ' unpaid invoices totalling ' +
      money(open.reduce((s, i) => s + (i.balance || 0), 0)) + '; ' + overdue.length + ' overdue.');
  } catch (e) { console.error('[AIContext] invoices:', e.message); }

  try {
    const Bill = getModel(tenantDb, 'Bill');
    const open = await Bill.find(scoped({ status: { $in: ['approved', 'partially_paid'] } })).select('balance dueDate').lean();
    const overdue = open.filter((b) => b.dueDate && new Date(b.dueDate) < new Date());
    parts.push('PAYABLES: ' + open.length + ' unpaid bills totalling ' +
      money(open.reduce((s, b) => s + (b.balance || 0), 0)) + '; ' + overdue.length + ' overdue.');
  } catch (e) { console.error('[AIContext] bills:', e.message); }

  // ---- payroll.view --------------------------------------------------------
  // Employees are company-wide (shared), so payroll headcount stays unscoped.
  if (has('payroll.view')) {
    try {
      const Employee = getModel(tenantDb, 'Employee');
      const emps = await Employee.find({}).lean();
      const gross = emps.reduce((s, e) => s + (e.grossSalary || e.basicSalary || e.salary || 0), 0);
      parts.push('PAYROLL: ' + emps.length + ' employees, total monthly gross ' + money(gross) + '.');
    } catch (e) { console.error('[AIContext] payroll:', e.message); }
  } else {
    withheld.push('payroll and salary figures (needs Payroll access)');
  }

  // ---- banking.view --------------------------------------------------------
  // Bank accounts belong to one branch each, so scope them.
  if (has('banking.view')) {
    try {
      const BankAccount = getModel(tenantDb, 'BankAccount');
      const banks = await BankAccount.find(scoped({})).lean();
      if (banks.length) {
        parts.push('BANK ACCOUNTS:\n' + banks.map((b) => '  ' +
          (b.name || b.accountName || b.bankName || 'Account') + ': ' +
          money(b.currentBalance ?? b.balance ?? 0)).join('\n'));
      }
    } catch (e) { console.error('[AIContext] banking:', e.message); }
  } else {
    withheld.push('bank account balances (needs Banking access)');
  }

  // ---- budget.view ---------------------------------------------------------
  if (has('budget.view')) {
    try {
      const Budget = getModel(tenantDb, 'Budget');
      const budgets = await Budget.find(scoped({})).lean();
      if (budgets.length) {
        parts.push('BUDGETS:\n' + budgets.map((b) => '  ' +
          (b.name || b.title || 'Budget') + ': ' +
          money(b.totalBudget ?? b.amount ?? 0)).join('\n'));
      }
    } catch (e) { console.error('[AIContext] budget:', e.message); }
  } else {
    withheld.push('budgets and variance analysis (needs Budget access)');
  }

  // ---- tax.view ------------------------------------------------------------
  // Tax account balances are branch-aware via the ledger movement map.
  if (has('tax.view')) {
    try {
      const Account = getModel(tenantDb, 'Account');
      const JournalEntry = getModel(tenantDb, 'JournalEntry');
      if (req && !movement) movement = await ledgerMovement(req, JournalEntry);
      const taxAccts = await Account.find({ name: /tax|vat|paye|ssnit/i }).select('code name type normalBalance balance').lean();
      if (taxAccts.length) {
        parts.push('TAX ACCOUNTS:\n' + taxAccts
          .map((a) => '  ' + a.code + ' ' + a.name + ': ' + money(acctSignedBalance(a, movement))).join('\n'));
      }
    } catch (e) { console.error('[AIContext] tax:', e.message); }
  } else {
    withheld.push('tax summaries - VAT, PAYE, corporate (needs Tax access)');
  }

  return { context: parts.join('\n\n'), withheld };
}

module.exports = { buildAIContext };