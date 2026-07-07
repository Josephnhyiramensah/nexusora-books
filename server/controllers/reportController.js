// server/controllers/reportController.js
// Financial report generation — queries Account balances and JournalEntry data

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

/**
 * GET /api/reports/trial-balance
 * Lists all accounts with debit/credit balances. Totals must match.
 * Query: ?asOfDate=2026-06-30
 */
const getTrialBalance = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');

    const accounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = accounts.map((acct) => {
      const bal = acct.balance || 0;
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
 */
const getProfitLoss = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { startDate, endDate } = req.query;

    // If date range provided, calculate balances from journal entries in that period
    // Otherwise use current account balances
    let useJournals = false;
    let dateFilter = {};

    if (startDate && endDate) {
      useJournals = true;
      dateFilter = {
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'posted',
      };
    }

    const revenueAccounts = await Account.find({ type: 'revenue', isActive: true }).sort({ code: 1 }).lean();
    const cogsAccounts = await Account.find({ type: 'cogs', isActive: true }).sort({ code: 1 }).lean();
    const expenseAccounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 }).lean();

    // Calculate period balances from journals if date range given
    const calcPeriodBalance = async (accountId) => {
      if (!useJournals) return null;

      const entries = await JournalEntry.find(dateFilter).lean();
      let total = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          if (line.account.toString() === accountId.toString()) {
            total += (line.credit || 0) - (line.debit || 0);
          }
        }
      }
      return Math.round(total * 100) / 100;
    };

    const buildSection = async (accounts) => {
      const items = [];
      let sectionTotal = 0;

      for (const acct of accounts) {
        let balance;
        if (useJournals) {
          balance = await calcPeriodBalance(acct._id);
        } else {
          balance = acct.balance || 0;
        }
        items.push({ code: acct.code, name: acct.name, balance: Math.abs(balance) });
        sectionTotal += Math.abs(balance);
      }

      return { items, total: Math.round(sectionTotal * 100) / 100 };
    };

    const revenue = await buildSection(revenueAccounts);
    const cogs = await buildSection(cogsAccounts);
    const expenses = await buildSection(expenseAccounts);

    const grossProfit = Math.round((revenue.total - cogs.total) * 100) / 100;
    const netIncome = Math.round((grossProfit - expenses.total) * 100) / 100;

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'read',
      module: 'reports',
      description: `Generated Profit & Loss report${startDate ? ` (${startDate} to ${endDate})` : ''}`,
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
        operatingExpenses: expenses,
        netIncome,
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
 */
const getBalanceSheet = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');

    const assetAccounts = await Account.find({ type: 'asset', isActive: true }).sort({ code: 1 }).lean();
    const liabilityAccounts = await Account.find({ type: 'liability', isActive: true }).sort({ code: 1 }).lean();
    const equityAccounts = await Account.find({ type: 'equity', isActive: true }).sort({ code: 1 }).lean();

    // Calculate net income (Revenue - COGS - Expenses) for retained earnings
    const revenueAccounts = await Account.find({ type: 'revenue', isActive: true }).lean();
    const cogsAccts = await Account.find({ type: 'cogs', isActive: true }).lean();
    const expenseAccts = await Account.find({ type: 'expense', isActive: true }).lean();

    const sumBalances = (accts) => accts.reduce((s, a) => s + (a.balance || 0), 0);

    const totalRevenue = sumBalances(revenueAccounts);
    const totalCogs = sumBalances(cogsAccts);
    const totalExpenses = sumBalances(expenseAccts);
    const netIncome = Math.round((totalRevenue - totalCogs - totalExpenses) * 100) / 100;

    const buildSection = (accounts) => {
      const items = accounts.map((a) => ({
        code: a.code,
        name: a.name,
        category: a.category,
        balance: Math.round(Math.abs(a.balance || 0) * 100) / 100,
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
 */
const getCashFlow = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { startDate, endDate } = req.query;

    const cashCodes = ['1000', '1010', '1020'];
    const cashAccounts = await Account.find({ code: { $in: cashCodes } }).lean();
    const cashAccountIds = cashAccounts.map((a) => a._id.toString());

    const filter = { status: 'posted' };
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

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

    // Current cash balance
    const currentCash = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0);

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
 */
const getGeneralLedger = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { accountId, startDate, endDate } = req.query;

    const filter = { status: 'posted' };
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

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