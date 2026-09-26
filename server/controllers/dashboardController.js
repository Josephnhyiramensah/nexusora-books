// server/controllers/dashboardController.js

const { getModel } = require('../utils/getModel');
const { getSpecialAccount, getSpecialAccountSet } = require('../utils/specialAccounts');
const { scopedFilter } = require('../utils/branchScope');
const { ledgerMovement, acctSignedBalance } = require('../utils/branchLedger');

const getDashboardSummary = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Bill = getModel(req.tenantDb, 'Bill');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Customer = getModel(req.tenantDb, 'Customer');
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const ToDo = getModel(req.tenantDb, 'ToDo');

    // Branch-aware balances: consolidated reads stored balance; a scoped request
    // computes from that branch's posted journal lines.
    const movement = await ledgerMovement(req, JournalEntry);

    // Cash tiles: the cash SET by role (cash on hand + petty cash + bank).
    const cashAccounts = await getSpecialAccountSet(req, 'cashAccounts');
    const cashBalance = cashAccounts.reduce((s, a) => s + acctSignedBalance(a, movement), 0);

    const revenueAccounts = await Account.find({ type: 'revenue' }).lean();
    const expenseAccounts = await Account.find({ type: { $in: ['expense', 'cogs'] } }).lean();
    // Revenue is credit-normal (negative signed); expenses debit-normal (positive).
    // Present as positive magnitudes, matching the previous stored-balance output.
    const totalRevenue = revenueAccounts.reduce((s, a) => s + Math.abs(acctSignedBalance(a, movement)), 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + Math.abs(acctSignedBalance(a, movement)), 0);
    const netIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    // AR/AP resolved by ROLE for the dashboard tiles. Read-only and optional:
    // a chart missing either simply reports 0, exactly as before.
    const arAccount = await getSpecialAccount(req, 'accountsReceivable', { required: false, lean: true });
    const apAccount = await getSpecialAccount(req, 'accountsPayable', { required: false, lean: true });
    const outstandingAR = arAccount ? Math.abs(acctSignedBalance(arAccount, movement)) : 0;
    const outstandingAP = apAccount ? Math.abs(acctSignedBalance(apAccount, movement)) : 0;

    // Counts + lists: scoped so a branch view only reflects its own documents.
    const invoiceCount = await Invoice.countDocuments(scopedFilter(req, {}));
    const billCount = await Bill.countDocuments(scopedFilter(req, {}));
    const overdueInvoices = await Invoice.countDocuments(scopedFilter(req, { status: 'overdue' }));
    const overdueBills = await Bill.countDocuments(scopedFilter(req, { status: 'overdue' }));
    const draftJournals = await JournalEntry.countDocuments(scopedFilter(req, { status: 'draft' }));
    // Customers & vendors are company-wide (shared masters) — not branch-scoped.
    const customerCount = await Customer.countDocuments({ isActive: true });
    const vendorCount = await Vendor.countDocuments({ isActive: true });

    // To-dos are personal (by user), not branch-scoped.
    const pendingTodos = await ToDo.countDocuments({
      $or: [{ createdBy: req.user._id }, { assignedTo: req.user._id }],
      status: { $ne: 'completed' },
    });

    const recentJournals = await JournalEntry.find(scopedFilter(req, { status: 'posted' }))
      .sort({ postedAt: -1 }).limit(5)
      .select('entryNumber date journalType description totalDebit').lean();

    const unpaidInvoices = await Invoice.find(scopedFilter(req, { status: { $in: ['sent', 'partially_paid'] } }))
      .populate('customer', 'name')
      .sort({ dueDate: 1 }).limit(5)
      .select('invoiceNumber customer dueDate total balance status').lean();

    const unpaidBills = await Bill.find(scopedFilter(req, { status: { $in: ['approved', 'partially_paid'] } }))
      .populate('vendor', 'name')
      .sort({ dueDate: 1 }).limit(5)
      .select('billNumber vendor dueDate total balance status').lean();

    res.json({
      success: true,
      data: {
        cashBalance: Math.round(cashBalance * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netIncome,
        outstandingAR: Math.round(outstandingAR * 100) / 100,
        outstandingAP: Math.round(outstandingAP * 100) / 100,
        invoiceCount, billCount, overdueInvoices, overdueBills,
        draftJournals, customerCount, vendorCount, pendingTodos,
        recentJournals, unpaidInvoices, unpaidBills,
      },
    });
  } catch (error) {
    console.error('[Dashboard] Summary error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
};

module.exports = { getDashboardSummary };