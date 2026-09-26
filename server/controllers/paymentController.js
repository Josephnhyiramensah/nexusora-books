// server/controllers/paymentController.js

const { getModel } = require('../utils/getModel');
const { getSpecialAccount } = require('../utils/specialAccounts');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');
const { scopedFilter } = require('../utils/branchScope');

// Head Office fallback so a payment/journal is never left unbranched.
async function headOfficeId(req) {
  const Branch = getModel(req.tenantDb, 'Branch');
  const ho = await Branch.findOne({ isHeadOffice: true }).select('_id').lean();
  return ho ? ho._id : null;
}

// Generate the next payment number. A tenant can customise the series via
// settings.documentNumbers.payment = { prefix, padding, startNumber }. With no
// config the defaults reproduce the historical 'PAY-000001'. The running number
// comes from the highest existing payment that already uses THIS prefix, so
// changing the prefix starts a clean series with no counter to seed or drift.
async function generatePaymentNumber(Payment, cfg = {}) {
  const c = cfg || {};
  const prefix = (c.prefix != null && c.prefix !== '') ? String(c.prefix) : 'PAY-';
  const padding = Number.isFinite(Number(c.padding)) ? Number(c.padding) : 6;
  const start = Number.isFinite(Number(c.startNumber)) ? Number(c.startNumber) : 1;

  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('^' + esc + '(\\d+)$');

  const last = await Payment.findOne({ paymentNumber: rx })
    .sort({ paymentNumber: -1 })
    .select('paymentNumber')
    .lean();

  let n = start;
  if (last && last.paymentNumber) {
    const m = last.paymentNumber.match(rx);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  if (n < start) n = start;
  return prefix + String(n).padStart(padding, '0');
}

const getPayments = async (req, res) => {
  try {
    const Payment = getModel(req.tenantDb, 'Payment');
    const base = {};
    if (req.query.type) base.type = req.query.type;
    const payments = await Payment.find(scopedFilter(req, base)).populate('createdBy', 'firstName lastName')
      .populate('customer', 'name')
      .populate('vendor', 'name')
      .populate('invoice', 'invoiceNumber')
      .populate('bill', 'billNumber')
      .sort({ date: -1 }).lean();
    res.json({ success: true, data: payments, count: payments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
};

const getPayment = async (req, res) => {
  try {
    const Payment = getModel(req.tenantDb, 'Payment');
    const payment = await Payment.findOne(scopedFilter(req, { _id: req.params.id }))
      .populate('customer').populate('vendor')
      .populate('invoice').populate('bill').populate('journalEntry');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment.' });
  }
};

/**
 * POST /api/payments/receive
 * Receive payment against invoice: DR Cash/Bank, CR Accounts Receivable.
 * The payment and its journal inherit the INVOICE's branch.
 */
const receivePayment = async (req, res) => {
  try {
    const Payment = getModel(req.tenantDb, 'Payment');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Customer = getModel(req.tenantDb, 'Customer');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { invoiceId, amount, date, method, reference, notes } = req.body;

    if (!invoiceId || !amount || !date) {
      return res.status(400).json({ success: false, message: 'Required: invoiceId, amount, date.' });
    }

    const invoice = await Invoice.findOne(scopedFilter(req, { _id: invoiceId }));
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (['draft', 'paid', 'cancelled'].includes(invoice.status)) {
      return res.status(400).json({ success: false, message: `Cannot receive payment for a ${invoice.status} invoice.` });
    }

    const payAmount = Math.round(Number(amount) * 100) / 100;
    if (payAmount <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    if (payAmount > invoice.balance) {
      return res.status(400).json({ success: false, message: `Amount (${payAmount}) exceeds invoice balance (${invoice.balance}).` });
    }

    // Cash side depends on the method: bank/cheque settle through the bank
    // account, everything else through cash on hand. Both resolved by ROLE now,
    // so a tenant may remap either without touching this controller.
    const cashRole = (method === 'bank_transfer' || method === 'cheque') ? 'cashAtBank' : 'cashOnHand';
    const cashAccount = await getSpecialAccount(req, cashRole, { required: false });
    const arAccount = await getSpecialAccount(req, 'accountsReceivable', { required: false });

    if (!cashAccount || !arAccount) {
      return res.status(500).json({ success: false, message: 'Cash or AR account not found.' });
    }

    const branch = invoice.branch || await headOfficeId(req);

    // Create journal: DR Cash, CR AR
    const journalLines = [
      {
        account: cashAccount._id, accountCode: cashAccount.code, accountName: cashAccount.name,
        debit: payAmount, credit: 0,
        description: `Payment received for ${invoice.invoiceNumber}`,
      },
      {
        account: arAccount._id, accountCode: arAccount.code, accountName: arAccount.name,
        debit: 0, credit: payAmount,
        description: `Payment received for ${invoice.invoiceNumber}`,
      },
    ];

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date, journalType: 'cash_receipts',
      description: `Payment received for Invoice ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      lines: journalLines,
      totalDebit: payAmount, totalCredit: payAmount,
      status: 'posted',
      postedBy: req.user._id, postedAt: new Date(),
      createdBy: req.user._id,
      branch,
    });

    // Update account balances
    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = Math.round((acct.balance + change) * 100) / 100;
        await acct.save();
      }
    }

    // Update invoice
    invoice.amountPaid = Math.round((invoice.amountPaid + payAmount) * 100) / 100;
    invoice.balance = Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
    invoice.status = invoice.balance <= 0 ? 'paid' : 'partially_paid';
    await invoice.save();

    // Update customer outstanding
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      customer.outstandingBalance = Math.round((customer.outstandingBalance - payAmount) * 100) / 100;
      await customer.save();
    }

    // Create payment record
    const paymentNumber = await generatePaymentNumber(Payment, req.tenant?.settings?.documentNumbers?.payment);
    const payment = await Payment.create({
      paymentNumber, type: 'incoming', date,
      amount: payAmount, method,
      customer: invoice.customer, invoice: invoiceId,
      reference, notes,
      journalEntry: journalEntry._id,
      createdBy: req.user._id,
      branch,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'payments',
      entityId: payment._id, entityType: 'Payment',
      description: `Received ${payAmount} for Invoice ${invoice.invoiceNumber} — Journal ${entryNumber}`,
    }, req);

    res.status(201).json({
      success: true,
      message: `Payment ${paymentNumber} received. Invoice ${invoice.status === 'paid' ? 'fully paid' : 'partially paid'}.`,
      data: payment,
    });
  } catch (error) {
    console.error('[Payments] Receive error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to receive payment.' });
  }
};

/**
 * POST /api/payments/make
 * Make payment against bill: DR Accounts Payable, CR Cash/Bank.
 * The payment and its journal inherit the BILL's branch.
 */
const makePayment = async (req, res) => {
  try {
    const Payment = getModel(req.tenantDb, 'Payment');
    const Bill = getModel(req.tenantDb, 'Bill');
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { billId, amount, date, method, reference, notes } = req.body;

    if (!billId || !amount || !date) {
      return res.status(400).json({ success: false, message: 'Required: billId, amount, date.' });
    }

    const bill = await Bill.findOne(scopedFilter(req, { _id: billId }));
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (['draft', 'paid', 'cancelled'].includes(bill.status)) {
      return res.status(400).json({ success: false, message: `Cannot pay a ${bill.status} bill.` });
    }

    const payAmount = Math.round(Number(amount) * 100) / 100;
    if (payAmount <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    if (payAmount > bill.balance) {
      return res.status(400).json({ success: false, message: `Amount (${payAmount}) exceeds bill balance (${bill.balance}).` });
    }

    // Same role-based cash selection as on the receipt side.
    const cashRole = (method === 'bank_transfer' || method === 'cheque') ? 'cashAtBank' : 'cashOnHand';
    const cashAccount = await getSpecialAccount(req, cashRole, { required: false });
    const apAccount = await getSpecialAccount(req, 'accountsPayable', { required: false });

    if (!cashAccount || !apAccount) {
      return res.status(500).json({ success: false, message: 'Cash or AP account not found.' });
    }

    const branch = bill.branch || await headOfficeId(req);

    // DR Accounts Payable, CR Cash
    const journalLines = [
      {
        account: apAccount._id, accountCode: apAccount.code, accountName: apAccount.name,
        debit: payAmount, credit: 0,
        description: `Payment for ${bill.billNumber}`,
      },
      {
        account: cashAccount._id, accountCode: cashAccount.code, accountName: cashAccount.name,
        debit: 0, credit: payAmount,
        description: `Payment for ${bill.billNumber}`,
      },
    ];

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date, journalType: 'cash_payments',
      description: `Payment for Bill ${bill.billNumber}`,
      reference: bill.billNumber,
      lines: journalLines,
      totalDebit: payAmount, totalCredit: payAmount,
      status: 'posted',
      postedBy: req.user._id, postedAt: new Date(),
      createdBy: req.user._id,
      branch,
    });

    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = Math.round((acct.balance + change) * 100) / 100;
        await acct.save();
      }
    }

    bill.amountPaid = Math.round((bill.amountPaid + payAmount) * 100) / 100;
    bill.balance = Math.round((bill.total - bill.amountPaid) * 100) / 100;
    bill.status = bill.balance <= 0 ? 'paid' : 'partially_paid';
    await bill.save();

    const vendor = await Vendor.findById(bill.vendor);
    if (vendor) {
      vendor.outstandingBalance = Math.round((vendor.outstandingBalance - payAmount) * 100) / 100;
      await vendor.save();
    }

    const paymentNumber = await generatePaymentNumber(Payment, req.tenant?.settings?.documentNumbers?.payment);
    const payment = await Payment.create({
      paymentNumber, type: 'outgoing', date,
      amount: payAmount, method,
      vendor: bill.vendor, bill: billId,
      reference, notes,
      journalEntry: journalEntry._id,
      createdBy: req.user._id,
      branch,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'payments',
      entityId: payment._id, entityType: 'Payment',
      description: `Paid ${payAmount} for Bill ${bill.billNumber} — Journal ${entryNumber}`,
    }, req);

    res.status(201).json({
      success: true,
      message: `Payment ${paymentNumber} made. Bill ${bill.status === 'paid' ? 'fully paid' : 'partially paid'}.`,
      data: payment,
    });
  } catch (error) {
    console.error('[Payments] Make error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to make payment.' });
  }
};

module.exports = { getPayments, getPayment, receivePayment, makePayment };