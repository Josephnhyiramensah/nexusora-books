// server/controllers/dashboardController.js

const { getModel } = require('../utils/getModel');

const getDashboardSummary = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Bill = getModel(req.tenantDb, 'Bill');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Customer = getModel(req.tenantDb, 'Customer');
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const ToDo = getModel(req.tenantDb, 'ToDo');

    const cashAccounts = await Account.find({ code: { $in: ['1000', '1010', '1020'] } }).lean();
    const cashBalance = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0);

    const revenueAccounts = await Account.find({ type: 'revenue' }).lean();
    const expenseAccounts = await Account.find({ type: { $in: ['expense', 'cogs'] } }).lean();
    const totalRevenue = revenueAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const netIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    const arAccount = await Account.findOne({ code: '1100' }).lean();
    const apAccount = await Account.findOne({ code: '2000' }).lean();

    const invoiceCount = await Invoice.countDocuments({});
    const billCount = await Bill.countDocuments({});
    const overdueInvoices = await Invoice.countDocuments({ status: 'overdue' });
    const overdueBills = await Bill.countDocuments({ status: 'overdue' });
    const draftJournals = await JournalEntry.countDocuments({ status: 'draft' });
    const customerCount = await Customer.countDocuments({ isActive: true });
    const vendorCount = await Vendor.countDocuments({ isActive: true });

    const pendingTodos = await ToDo.countDocuments({
      $or: [{ createdBy: req.user._id }, { assignedTo: req.user._id }],
      status: { $ne: 'completed' },
    });

    const recentJournals = await JournalEntry.find({ status: 'posted' })
      .sort({ postedAt: -1 }).limit(5)
      .select('entryNumber date journalType description totalDebit').lean();

    const unpaidInvoices = await Invoice.find({ status: { $in: ['sent', 'partially_paid'] } })
      .populate('customer', 'name')
      .sort({ dueDate: 1 }).limit(5)
      .select('invoiceNumber customer dueDate total balance status').lean();

    const unpaidBills = await Bill.find({ status: { $in: ['approved', 'partially_paid'] } })
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
        outstandingAR: Math.round((arAccount?.balance || 0) * 100) / 100,
        outstandingAP: Math.round((apAccount?.balance || 0) * 100) / 100,
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