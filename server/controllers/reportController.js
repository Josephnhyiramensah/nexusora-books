// server/controllers/reportController.js
// Financial report generation — queries Account balances and JournalEntry data
//
// MULTI-BRANCH: reports honour the request's branch scope.
//   • Consolidated (no X-Branch header / full-access user): unchanged — reads the
//     stored account.balance, exactly as before.
//   • Branch-scoped (X-Branch header, or a branch-restricted user): each account's
//     balance is computed from that branch's POSTED journal lines, because the
//     stored balance is the all-branches figure and cannot be branch-filtered.
// Since stored balance == full ledger tally, consolidated figures are identical
// either way; the branch path is purely additive.

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { resolveBranchScope, scopedFilter } = require('../utils/branchScope');

// Build a per-account signed movement map from posted journal lines, honouring
// branch scope and (optionally) a date range. Movement is (debit - credit) per
// account — the caller applies the account's normal side. Returns a plain object
// keyed by account id string, or null when the scope is consolidated AND no date
// range is given (the caller should then use the stored balance instead).
async function ledgerMovement(req, JournalEntry, { dateFilter } = {}) {
  const scope = resolveBranchScope(req);
  const branchScoped = scope.mode !== 'all';

  // Consolidated + no date range → signal "use stored balance" (fast path).
  if (!branchScoped && !dateFilter) return null;

  const filter = scopedFilter(req, { status: 'posted', ...(dateFilter || {}) });
  const entries = await JournalEntry.find(filter).lean();
  const movement = {};
  for (const entry of entries) {
    for (const line of (entry.lines || [])) {
      const id = String(line.account);
      movement[id] = (movement[id] || 0) + ((line.debit || 0) - (line.credit || 0));
    }
  }
  return movement;
}

// The signed balance for an account: from the ledger movement map when present
// (branch-scoped or dated), else the stored balance (consolidated all-time).
function acctSignedBalance(acct, movement) {
  if (movement) {
    const raw = movement[String(acct._id)] || 0;
    // Stored balance is signed by the account's normal side; mirror that so the
    // branch/period figure is directly comparable to the consolidated one.
    const signed = acct.normalBalance === 'debit' ? raw : -raw;
    return Math.round(signed * 100) / 100;
  }
  return acct.balance || 0;
}

/**
 * GET /api/reports/trial-balance
 * Lists all accounts with debit/credit balances. Totals must match.
 * Honours branch scope (X-Branch header) — consolidated by default.
 */
const getTrialBalance = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const accounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();
    const movement = await ledgerMovement(req, JournalEntry);

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = accounts.map((acct) => {
      const bal = acctSignedBalance(acct, movement);
      let debit = 0;
      let credit = 0;

      if (acct.normalBalance === 'debit') {
        if (bal >= 0) debit = bal;
        else credit = Math.abs(bal);
      } else {
        if (bal >= 0) credit = bal;
        else debit = Math.abs(bal);
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        code: acct.code,
        name: acct.name,
        type: acct.type,
        normalBalance: acct.normalBalance,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
      };
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'read',
      module: 'reports',
      description: 'Generated Trial Balance report',
    }, req);

    res.json({
      success: true,
      data: {
        reportName: 'Trial Balance',
        generatedAt: new Date().toISOString(),
        rows,
        totalDebit,
        totalCredit,
        isBalanced,
        difference: Math.round((totalDebit - totalCredit) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[Reports] Trial Balance error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate Trial Balance.' });
  }
};

/**
 * GET /api/reports/profit-loss
 * Revenue (4000–4999) minus COGS (5000–5999) minus Expenses (6000–6999)
 * Query: ?startDate=2026-01-01&endDate=2026-06-30
 * Honours branch scope.
 */
const getProfitLoss = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { startDate, endDate } = req.query;

    let dateFilter = null;
    if (startDate && endDate) {
      dateFilter = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    }

    const revenueAccounts = await Account.find({ type: 'revenue', isActive: true }).sort({ code: 1 }).lean();
    const cogsAccounts = await Account.find({ type: 'cogs', isActive: true }).sort({ code: 1 }).lean();
    const expenseAccounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 }).lean();

    // One movement map for the whole statement: branch-scoped and/or dated. When
    // consolidated + no dates, this is null and we fall back to stored balances.
    const movement = await ledgerMovement(req, JournalEntry, { dateFilter });

    const acctBalance = (acct) => acctSignedBalance(acct, movement);

    // Build a flat section (list of accounts + total). Uses absolute values so
    // the statement reads naturally regardless of debit/credit normal side.
    const buildSection = (accounts) => {
      const items = [];
      let total = 0;
      for (const acct of accounts) {
        const bal = Math.abs(acctBalance(acct));
        items.push({ code: acct.code, name: acct.name, balance: bal });
        total += bal;
      }
      return { items, total: Math.round(total * 100) / 100 };
    };

    // Group a set of accounts BY their category, each group with its own total.
    const buildGrouped = (accounts) => {
      const groupsMap = {};
      let grandTotal = 0;
      for (const acct of accounts) {
        const cat = acct.category || 'Other';
        const bal = Math.abs(acctBalance(acct));
        if (!groupsMap[cat]) groupsMap[cat] = { category: cat, items: [], total: 0 };
        groupsMap[cat].items.push({ code: acct.code, name: acct.name, balance: bal });
        groupsMap[cat].total += bal;
        grandTotal += bal;
      }
      const groups = Object.values(groupsMap).map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }));
      // Stable, readable order.
      groups.sort((a, b) => a.category.localeCompare(b.category));
      return { groups, total: Math.round(grandTotal * 100) / 100 };
    };

    // Split revenue into operating vs other income by category.
    const operatingRevenueAccts = revenueAccounts.filter((a) => (a.category || '').toLowerCase().includes('operating'));
    const otherIncomeAccts = revenueAccounts.filter((a) => !(a.category || '').toLowerCase().includes('operating'));

    // Split expense accounts into operating vs finance/other/tax by category.
    const isFinance = (a) => (a.category || '').toLowerCase().includes('finance');
    const isTax = (a) => (a.category || '').toLowerCase() === 'tax';
    const isOtherExp = (a) => (a.category || '').toLowerCase().includes('other expense');
    const operatingExpenseAccts = expenseAccounts.filter((a) => !isFinance(a) && !isTax(a) && !isOtherExp(a));
    const financeCostAccts = expenseAccounts.filter(isFinance);
    const otherExpenseAccts = expenseAccounts.filter(isOtherExp);
    const taxAccts = expenseAccounts.filter(isTax);

    // Sections
    const revenue = buildSection(operatingRevenueAccts);
    const cogs = buildSection(cogsAccounts);
    const grossProfit = Math.round((revenue.total - cogs.total) * 100) / 100;

    const operatingExpensesGrouped = buildGrouped(operatingExpenseAccts);
    const operatingProfit = Math.round((grossProfit - operatingExpensesGrouped.total) * 100) / 100;

    const otherIncome = buildSection(otherIncomeAccts);
    const financeCosts = buildSection(financeCostAccts);
    const otherExpenses = buildSection(otherExpenseAccts);
    const profitBeforeTax = Math.round((operatingProfit + otherIncome.total - financeCosts.total - otherExpenses.total) * 100) / 100;

    const taxExpense = buildSection(taxAccts);
    const netProfit = Math.round((profitBeforeTax - taxExpense.total) * 100) / 100;

    // Backward-compatible flat operating-expenses list (old consumers).
    const operatingExpensesFlat = buildSection(operatingExpenseAccts);

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'read', module: 'reports',
      description: 'Generated Profit & Loss report' + (startDate ? ' (' + startDate + ' to ' + endDate + ')' : ''),
    }, req);

    res.json({
      success: true,
      data: {
        reportName: 'Profit & Loss (Income Statement)',
        period: startDate && endDate ? { startDate, endDate } : 'All time',
        generatedAt: new Date().toISOString(),
        revenue,
        costOfGoodsSold: cogs,
        grossProfit,
        operatingExpenseGroups: operatingExpensesGrouped.groups,
        operatingExpensesTotal: operatingExpensesGrouped.total,
        operatingProfit,
        otherIncome,
        financeCosts,
        otherExpenses,
        profitBeforeTax,
        taxExpense,
        netProfit,
        // ── backward-compatible fields ──
        operatingExpenses: operatingExpensesFlat,
        netIncome: netProfit,
      },
    });
  } catch (error) {
    console.error('[Reports] P&L error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate Profit & Loss.' });
  }
};

/**
 * GET /api/reports/balance-sheet
 * Assets (1000–1999) = Liabilities (2000–2999) + Equity (3000–3999)
 * Honours branch scope.
 */
const getBalanceSheet = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const assetAccounts = await Account.find({ type: 'asset', isActive: true }).sort({ code: 1 }).lean();
    const liabilityAccounts = await Account.find({ type: 'liability', isActive: true }).sort({ code: 1 }).lean();
    const equityAccounts = await Account.find({ type: 'equity', isActive: true }).sort({ code: 1 }).lean();

    // Net income (Revenue - COGS - Expenses) for retained earnings.
    const revenueAccounts = await Account.find({ type: 'revenue', isActive: true }).lean();
    const cogsAccts = await Account.find({ type: 'cogs', isActive: true }).lean();
    const expenseAccts = await Account.find({ type: 'expense', isActive: true }).lean();

    const movement = await ledgerMovement(req, JournalEntry);
    const signed = (acct) => acctSignedBalance(acct, movement);

    const sumSigned = (accts) => accts.reduce((s, a) => s + signed(a), 0);

    const totalRevenue = sumSigned(revenueAccounts);
    const totalCogs = sumSigned(cogsAccts);
    const totalExpenses = sumSigned(expenseAccts);
    // Revenue is credit-normal (negative signed), COGS/expenses debit-normal
    // (positive). Net income = -revenueSigned - cogsSigned - expenseSigned to
    // reproduce the original (Revenue - COGS - Expenses) using absolute magnitudes.
    const netIncome = Math.round((Math.abs(totalRevenue) - Math.abs(totalCogs) - Math.abs(totalExpenses)) * 100) / 100;

    const buildSection = (accounts) => {
      const items = accounts.map((a) => ({
        code: a.code,
        name: a.name,
        category: a.category,
        balance: Math.round(Math.abs(signed(a)) * 100) / 100,
      }));
      const total = Math.round(items.reduce((s, i) => s + i.balance, 0) * 100) / 100;
      return { items, total };
    };

    const assets = buildSection(assetAccounts);
    const liabilities = buildSection(liabilityAccounts);
    const equity = buildSection(equityAccounts);

    // Add net income to equity total for balance check
    const totalEquityWithIncome = Math.round((equity.total + netIncome) * 100) / 100;
    const totalLiabilitiesAndEquity = Math.round((liabilities.total + totalEquityWithIncome) * 100) / 100;
    const isBalanced = Math.abs(assets.total - totalLiabilitiesAndEquity) < 0.01;

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'read',
      module: 'reports',
      description: 'Generated Balance Sheet report',
    }, req);

    res.json({
      success: true,
      data: {
        reportName: 'Balance Sheet (Statement of Financial Position)',
        generatedAt: new Date().toISOString(),
        assets,
        liabilities,
        equity: {
          items: [...equity.items, { code: '—', name: 'Net Income (Current Period)', balance: netIncome }],
          total: totalEquityWithIncome,
        },
        netIncome,
        totalLiabilitiesAndEquity,
        isBalanced,
      },
    });
  } catch (error) {
    console.error('[Reports] Balance Sheet error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate Balance Sheet.' });
  }
};

/**
 * GET /api/reports/cash-flow
 * Derived from journal entries affecting cash/bank accounts (1000, 1010, 1020)
 * Query: ?startDate=2026-01-01&endDate=2026-06-30
 * Honours branch scope.
 */
const getCashFlow = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { startDate, endDate } = req.query;

    const cashCodes = ['1000', '1010', '1020'];
    const cashAccounts = await Account.find({ code: { $in: cashCodes } }).lean();
    const cashAccountIds = cashAccounts.map((a) => a._id.toString());

    const base = { status: 'posted' };
    if (startDate && endDate) {
      base.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const filter = scopedFilter(req, base);

    const entries = await JournalEntry.find(filter).sort({ date: 1 }).lean();

    // Categorise cash movements
    const operating = [];
    const investing = [];
    const financing = [];

    let totalOperating = 0;
    let totalInvesting = 0;
    let totalFinancing = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (!cashAccountIds.includes(line.account.toString())) continue;

        const netCash = (line.debit || 0) - (line.credit || 0);
        if (netCash === 0) continue;

        // Find the contra account to categorise
        const contraLine = entry.lines.find((l) => l.account.toString() !== line.account.toString());
        const contraCode = contraLine ? parseInt(contraLine.accountCode) : 0;

        const item = {
          date: entry.date,
          entryNumber: entry.entryNumber,
          description: entry.description || line.description || '',
          amount: Math.round(netCash * 100) / 100,
        };

        if (contraCode >= 1400 && contraCode < 1500) {
          // Fixed assets → investing
          investing.push(item);
          totalInvesting += netCash;
        } else if (contraCode >= 2300 && contraCode < 2400 || contraCode >= 3000 && contraCode < 4000) {
          // Loans, equity → financing
          financing.push(item);
          totalFinancing += netCash;
        } else {
          // Everything else → operating
          operating.push(item);
          totalOperating += netCash;
        }
      }
    }

    totalOperating = Math.round(totalOperating * 100) / 100;
    totalInvesting = Math.round(totalInvesting * 100) / 100;
    totalFinancing = Math.round(totalFinancing * 100) / 100;
    const netChange = Math.round((totalOperating + totalInvesting + totalFinancing) * 100) / 100;

    // Current cash balance — branch-scoped from the ledger when scoped, else stored.
    const cashMovement = await ledgerMovement(req, JournalEntry);
    const currentCash = cashAccounts.reduce((s, a) => s + acctSignedBalance(a, cashMovement), 0);

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'read',
      module: 'reports',
      description: `Generated Cash Flow report${startDate ? ` (${startDate} to ${endDate})` : ''}`,
    }, req);

    res.json({
      success: true,
      data: {
        reportName: 'Cash Flow Statement',
        period: startDate && endDate ? { startDate, endDate } : 'All time',
        generatedAt: new Date().toISOString(),
        operating: { items: operating, total: totalOperating },
        investing: { items: investing, total: totalInvesting },
        financing: { items: financing, total: totalFinancing },
        netChange,
        currentCashBalance: Math.round(currentCash * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[Reports] Cash Flow error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate Cash Flow.' });
  }
};

/**
 * GET /api/reports/general-ledger
 * All transactions for a specific account or all accounts
 * Query: ?accountId=xxx&startDate=...&endDate=...
 * Honours branch scope.
 */
const getGeneralLedger = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { accountId, startDate, endDate } = req.query;

    const base = { status: 'posted' };
    if (startDate && endDate) {
      base.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const filter = scopedFilter(req, base);

    const entries = await JournalEntry.find(filter).sort({ date: 1 }).lean();

    // If specific account requested
    let targetAccounts;
    if (accountId) {
      const acct = await Account.findById(accountId).lean();
      if (!acct) return res.status(404).json({ success: false, message: 'Account not found.' });
      targetAccounts = [acct];
    } else {
      targetAccounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();
    }

    const ledger = targetAccounts.map((acct) => {
      const transactions = [];
      let runningBalance = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          if (line.account.toString() === acct._id.toString()) {
            const debit = line.debit || 0;
            const credit = line.credit || 0;

            if (acct.normalBalance === 'debit') {
              runningBalance += debit - credit;
            } else {
              runningBalance += credit - debit;
            }

            transactions.push({
              date: entry.date,
              entryNumber: entry.entryNumber,
              description: entry.description || line.description || '',
              debit: Math.round(debit * 100) / 100,
              credit: Math.round(credit * 100) / 100,
              balance: Math.round(runningBalance * 100) / 100,
            });
          }
        }
      }

      return {
        code: acct.code,
        name: acct.name,
        type: acct.type,
        normalBalance: acct.normalBalance,
        transactions,
        closingBalance: Math.round(runningBalance * 100) / 100,
      };
    }).filter((a) => a.transactions.length > 0);

    res.json({
      success: true,
      data: {
        reportName: 'General Ledger',
        period: startDate && endDate ? { startDate, endDate } : 'All time',
        generatedAt: new Date().toISOString(),
        accounts: ledger,
      },
    });
  } catch (error) {
    console.error('[Reports] General Ledger error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate General Ledger.' });
  }
};

module.exports = {
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getCashFlow,
  getGeneralLedger,
};