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
// ─── Allocation helpers ──────────────────────────────────────────────────────
//
// A payment may settle SEVERAL documents at once. The request may arrive in two
// shapes and both are supported:
//   • legacy single:  { invoiceId | billId, amount }
//   • allocations:    { allocations: [ { invoice|bill, amount }, ... ] }
// The legacy shape is normalised into a one-row allocation list, so there is a
// single code path from here on and every existing caller (the old form, the
// REST API, the PHP integration) keeps working unchanged.
function normaliseAllocations(body, key) {
  const legacyId = key === 'invoice' ? body.invoiceId : body.billId;
  if (Array.isArray(body.allocations) && body.allocations.length > 0) {
    return body.allocations.map((a) => ({
      id: a[key] || a.id || a.document,
      amount: Math.round((Number(a.amount) || 0) * 100) / 100,
    }));
  }
  if (legacyId) {
    return [{ id: legacyId, amount: Math.round((Number(body.amount) || 0) * 100) / 100 }];
  }
  return [];
}

/**
 * Load the documents an allocation list refers to, and check every rule that
 * must hold before a single ledger line is written.
 *
 * Rules enforced here, all of them deliberate:
 *   • each document exists, is within the caller's branch scope, and is in a
 *     state that can take a payment;
 *   • no document appears twice (otherwise the second row would silently
 *     overpay it);
 *   • each allocated amount is positive and does not exceed that document's
 *     remaining balance;
 *   • OVERPAYMENT IS REFUSED — the allocations must add up to the payment
 *     amount exactly. Unapplied cash is a customer deposit (a liability), and
 *     parking money in that account with no way to apply it later would be
 *     worse than refusing it here. Credit-on-account is a deliberate follow-on.
 *   • ONE BRANCH PER PAYMENT — a journal entry carries exactly one branch, so
 *     settling documents from two branches in one payment would either misfile
 *     a branch's cash or need inter-branch accounts, which this chart has no
 *     concept of. Refused with a message telling the user what to do instead.
 */
async function resolveAllocations(req, Model, allocs, opts) {
  const { key, label, numberField, blockedStatuses } = opts;

  if (!allocs.length) {
    return { error: `Nothing to apply. Choose at least one ${label} and an amount.` };
  }

  const seen = new Set();
  const rows = [];
  let allocatedTotal = 0;

  for (let i = 0; i < allocs.length; i += 1) {
    const { id, amount } = allocs[i];
    if (!id) return { error: `Line ${i + 1}: no ${label} selected.` };
    if (seen.has(String(id))) {
      return { error: `The same ${label} appears more than once. Combine those rows into one amount.` };
    }
    seen.add(String(id));

    if (!(amount > 0)) return { error: `Line ${i + 1}: the amount must be greater than zero.` };

    const doc = await Model.findOne(scopedFilter(req, { _id: id }));
    if (!doc) return { error: `Line ${i + 1}: ${label} not found.` };
    if (blockedStatuses.includes(doc.status)) {
      return { error: `${doc[numberField]} is ${doc.status} and cannot take a payment.` };
    }
    if (amount > doc.balance) {
      return { error: `${doc[numberField]}: amount ${amount} exceeds its outstanding balance of ${doc.balance}.` };
    }

    allocatedTotal = Math.round((allocatedTotal + amount) * 100) / 100;
    rows.push({ doc, amount });
  }

  // One branch per payment — see the note above.
  const branches = [...new Set(rows.map((r) => (r.doc.branch ? String(r.doc.branch) : 'none')))];
  if (branches.length > 1) {
    const nums = rows.map((r) => r.doc[numberField]).join(', ');
    return {
      error: `These ${label}s belong to different branches (${nums}). A payment posts to one branch, `
        + `so please record a separate payment for each branch's ${label}s.`,
    };
  }

  return { rows, allocatedTotal, branch: rows[0].doc.branch || null };
}

const receivePayment = async (req, res) => {
  try {
    const Payment = getModel(req.tenantDb, 'Payment');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Customer = getModel(req.tenantDb, 'Customer');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    // Maker-checker: cash movements are posted by an admin when approval is on.
    // An accountant records it as a voucher (which goes through approval) instead.
    if (req.tenant?.settings?.requireApproval === true && req.user?.role === 'accountant') {
      return res.status(403).json({ success: false, message: 'Approval is enabled, so receipts/payments must be posted by an admin. Record it as a voucher (which goes through approval), or ask an admin to post this receipt.' });
    }

    const { amount, date, method, reference, notes } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Required: date.' });

    const allocs = normaliseAllocations(req.body, 'invoice');
    const resolved = await resolveAllocations(req, Invoice, allocs, {
      key: 'invoice', label: 'invoice', numberField: 'invoiceNumber',
      blockedStatuses: ['draft', 'paid', 'cancelled'],
    });
    if (resolved.error) return res.status(400).json({ success: false, message: resolved.error });
    const { rows, allocatedTotal, branch: docBranch } = resolved;

    // The money received. When the caller sends no explicit total (the common
    // case for a multi-invoice receipt) it IS the sum of the allocations.
    const payAmount = amount != null
      ? Math.round(Number(amount) * 100) / 100
      : allocatedTotal;
    if (!(payAmount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    }
    if (payAmount !== allocatedTotal) {
      return res.status(400).json({
        success: false,
        message: `The amounts applied (${allocatedTotal}) do not add up to the payment of ${payAmount}. `
          + `Apply the full amount across invoices, or change the payment amount to match.`,
      });
    }

    // All allocated invoices belong to one customer? A receipt settles one
    // customer's debt; mixing customers would misstate both their balances.
    const customers = [...new Set(rows.map((r) => String(r.doc.customer)))];
    if (customers.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'These invoices belong to different customers. Record one receipt per customer.',
      });
    }

    // Cash side depends on the method: bank/cheque settle through the bank
    // account, everything else through cash on hand. Both resolved by ROLE.
    const cashRole = (method === 'bank_transfer' || method === 'cheque') ? 'cashAtBank' : 'cashOnHand';
    const cashAccount = await getSpecialAccount(req, cashRole, { required: false });
    const arAccount = await getSpecialAccount(req, 'accountsReceivable', { required: false });
    if (!cashAccount || !arAccount) {
      return res.status(500).json({ success: false, message: 'Cash or AR account not found.' });
    }

    const branch = docBranch || await headOfficeId(req);
    const docNums = rows.map((r) => r.doc.invoiceNumber).join(', ');

    // ONE journal for the receipt: DR Cash (total), CR AR (total). The per-invoice
    // split lives on the payment's allocations — AR is a single control account,
    // so splitting the credit line would add rows without adding information.
    const journalLines = [
      {
        account: cashAccount._id, accountCode: cashAccount.code, accountName: cashAccount.name,
        debit: payAmount, credit: 0,
        description: `Payment received for ${docNums}`,
      },
      {
        account: arAccount._id, accountCode: arAccount.code, accountName: arAccount.name,
        debit: 0, credit: payAmount,
        description: `Payment received for ${docNums}`,
      },
    ];

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date, journalType: 'cash_receipts',
      description: `Payment received for ${rows.length > 1 ? `${rows.length} invoices` : `Invoice ${docNums}`}`,
      reference: docNums,
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

    // Apply each allocation to its invoice.
    const allocations = [];
    for (const { doc, amount: applied } of rows) {
      doc.amountPaid = Math.round((doc.amountPaid + applied) * 100) / 100;
      doc.balance = Math.round((doc.total - doc.amountPaid) * 100) / 100;
      doc.status = doc.balance <= 0 ? 'paid' : 'partially_paid';
      await doc.save();
      allocations.push({ invoice: doc._id, documentNumber: doc.invoiceNumber, amount: applied });
    }

    // One customer (enforced above), so one outstanding-balance adjustment.
    const customer = await Customer.findById(rows[0].doc.customer);
    if (customer) {
      customer.outstandingBalance = Math.round((customer.outstandingBalance - payAmount) * 100) / 100;
      await customer.save();
    }

    const paymentNumber = await generatePaymentNumber(Payment, req.tenant?.settings?.documentNumbers?.payment);
    const payment = await Payment.create({
      paymentNumber, type: 'incoming', date,
      amount: payAmount, method,
      customer: rows[0].doc.customer,
      // Compatibility: the first allocation also lands on the single `invoice`
      // ref, so existing lists, reports and PDFs keep reading payment.invoice.
      invoice: rows[0].doc._id,
      allocations,
      reference, notes,
      journalEntry: journalEntry._id,
      createdBy: req.user._id,
      branch,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'payments',
      entityId: payment._id, entityType: 'Payment',
      description: `Received ${payAmount} across ${rows.length} invoice(s) (${docNums}) — Journal ${entryNumber}`,
    }, req);

    const fullyPaid = rows.filter((r) => r.doc.status === 'paid').length;
    res.status(201).json({
      success: true,
      message: `Payment ${paymentNumber} received — applied to ${rows.length} invoice(s), ${fullyPaid} now fully paid.`,
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

    // Maker-checker: cash movements are posted by an admin when approval is on.
    if (req.tenant?.settings?.requireApproval === true && req.user?.role === 'accountant') {
      return res.status(403).json({ success: false, message: 'Approval is enabled, so payments must be posted by an admin. Record it as a voucher (which goes through approval), or ask an admin to post this payment.' });
    }

    const { amount, date, method, reference, notes } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Required: date.' });

    const allocs = normaliseAllocations(req.body, 'bill');
    const resolved = await resolveAllocations(req, Bill, allocs, {
      key: 'bill', label: 'bill', numberField: 'billNumber',
      blockedStatuses: ['draft', 'paid', 'cancelled'],
    });
    if (resolved.error) return res.status(400).json({ success: false, message: resolved.error });
    const { rows, allocatedTotal, branch: docBranch } = resolved;

    const payAmount = amount != null
      ? Math.round(Number(amount) * 100) / 100
      : allocatedTotal;
    if (!(payAmount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    }
    if (payAmount !== allocatedTotal) {
      return res.status(400).json({
        success: false,
        message: `The amounts applied (${allocatedTotal}) do not add up to the payment of ${payAmount}. `
          + `Apply the full amount across bills, or change the payment amount to match.`,
      });
    }

    // One vendor per payment — mixing vendors would misstate both balances.
    const vendors = [...new Set(rows.map((r) => String(r.doc.vendor)))];
    if (vendors.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'These bills belong to different vendors. Record one payment per vendor.',
      });
    }

    const cashRole = (method === 'bank_transfer' || method === 'cheque') ? 'cashAtBank' : 'cashOnHand';
    const cashAccount = await getSpecialAccount(req, cashRole, { required: false });
    const apAccount = await getSpecialAccount(req, 'accountsPayable', { required: false });
    if (!cashAccount || !apAccount) {
      return res.status(500).json({ success: false, message: 'Cash or AP account not found.' });
    }

    const branch = docBranch || await headOfficeId(req);
    const docNums = rows.map((r) => r.doc.billNumber).join(', ');

    // DR Accounts Payable (total), CR Cash (total). Per-bill split lives on the
    // payment's allocations; AP is a single control account.
    const journalLines = [
      {
        account: apAccount._id, accountCode: apAccount.code, accountName: apAccount.name,
        debit: payAmount, credit: 0,
        description: `Payment for ${docNums}`,
      },
      {
        account: cashAccount._id, accountCode: cashAccount.code, accountName: cashAccount.name,
        debit: 0, credit: payAmount,
        description: `Payment for ${docNums}`,
      },
    ];

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date, journalType: 'cash_payments',
      description: `Payment for ${rows.length > 1 ? `${rows.length} bills` : `Bill ${docNums}`}`,
      reference: docNums,
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

    const allocations = [];
    for (const { doc, amount: applied } of rows) {
      doc.amountPaid = Math.round((doc.amountPaid + applied) * 100) / 100;
      doc.balance = Math.round((doc.total - doc.amountPaid) * 100) / 100;
      doc.status = doc.balance <= 0 ? 'paid' : 'partially_paid';
      await doc.save();
      allocations.push({ bill: doc._id, documentNumber: doc.billNumber, amount: applied });
    }

    const vendor = await Vendor.findById(rows[0].doc.vendor);
    if (vendor) {
      vendor.outstandingBalance = Math.round((vendor.outstandingBalance - payAmount) * 100) / 100;
      await vendor.save();
    }

    const paymentNumber = await generatePaymentNumber(Payment, req.tenant?.settings?.documentNumbers?.payment);
    const payment = await Payment.create({
      paymentNumber, type: 'outgoing', date,
      amount: payAmount, method,
      vendor: rows[0].doc.vendor,
      // Compatibility shim, same as the receipt side.
      bill: rows[0].doc._id,
      allocations,
      reference, notes,
      journalEntry: journalEntry._id,
      createdBy: req.user._id,
      branch,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'payments',
      entityId: payment._id, entityType: 'Payment',
      description: `Paid ${payAmount} across ${rows.length} bill(s) (${docNums}) — Journal ${entryNumber}`,
    }, req);

    const fullyPaid = rows.filter((r) => r.doc.status === 'paid').length;
    res.status(201).json({
      success: true,
      message: `Payment ${paymentNumber} recorded — applied to ${rows.length} bill(s), ${fullyPaid} now fully paid.`,
      data: payment,
    });
  } catch (error) {
    console.error('[Payments] Make error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to make payment.' });
  }
};

module.exports = { getPayments, getPayment, receivePayment, makePayment };