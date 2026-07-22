const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

async function generateBillNumber(Bill) {
  const last = await Bill.findOne({}).sort({ createdAt: -1 }).select('billNumber').lean();
  if (!last || !last.billNumber) return 'BILL-000001';
  const num = parseInt(last.billNumber.replace('BILL-', ''), 10);
  return `BILL-${(num + 1).toString().padStart(6, '0')}`;
}

const getBills = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.vendor) filter.vendor = req.query.vendor;
    const bills = await Bill.find(filter).populate('vendor', 'name email phone').sort({ date: -1 }).lean();
    res.json({ success: true, data: bills, count: bills.length });
  } catch (error) {
    console.error('[Bills] getBills failed:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch bills.' });
  }
};

const getBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findById(req.params.id)
      .populate('vendor', 'name email phone address')
      .populate('journalEntry');
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bill.' });
  }
};

const createBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const Account = getModel(req.tenantDb, 'Account');
    const { vendor, date, dueDate, lines, taxRate, notes } = req.body;

    if (!vendor || !date || !dueDate || !lines || lines.length < 1) {
      return res.status(400).json({ success: false, message: 'Required: vendor, date, dueDate, and at least 1 line.' });
    }

    const defaultExpenseAcct = await Account.findOne({ code: '6900' });

    const processedLines = lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) / 100,
      account: l.account || defaultExpenseAcct?._id,
    }));

    const subtotal = processedLines.reduce((sum, l) => sum + l.amount, 0);
    const tax = taxRate ? Math.round(subtotal * (Number(taxRate) / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const billNumber = await generateBillNumber(Bill);

    const bill = await Bill.create({
      billNumber, vendor, date, dueDate,
      lines: processedLines,
      subtotal, taxRate: taxRate || 0, taxAmount: tax,
      total, amountPaid: 0, balance: total,
      status: 'draft', notes, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'bills',
      entityId: bill._id, entityType: 'Bill',
      description: `Created bill: ${billNumber} (${total})`,
    }, req);

    res.status(201).json({ success: true, message: `Bill ${billNumber} created.`, data: bill });
  } catch (error) {
    console.error('[Bills] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create bill.' });
  }
};

const approveBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Vendor = getModel(req.tenantDb, 'Vendor');

    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft bills can be approved.' });
    }

    const apAccount = await Account.findOne({ code: '2000' });
    if (!apAccount) return res.status(500).json({ success: false, message: 'Accounts Payable (2000) not found.' });

    const journalLines = [];

    for (const line of bill.lines) {
      const expenseAcct = line.account ? await Account.findById(line.account) : await Account.findOne({ code: '6900' });
      journalLines.push({
        account: expenseAcct._id, accountCode: expenseAcct.code, accountName: expenseAcct.name,
        debit: line.amount, credit: 0, description: line.description,
      });
    }

    if (bill.taxAmount > 0) {
      const taxAccount = await Account.findOne({ code: '2400' });
      if (taxAccount) {
        journalLines.push({
          account: taxAccount._id, accountCode: '2400', accountName: taxAccount.name,
          debit: bill.taxAmount, credit: 0, description: `Tax on Bill ${bill.billNumber}`,
        });
      }
    }

    journalLines.push({
      account: apAccount._id, accountCode: '2000', accountName: apAccount.name,
      debit: 0, credit: bill.total, description: `Bill ${bill.billNumber}`,
    });

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date: bill.date, journalType: 'purchases',
      description: `Bill ${bill.billNumber} approved`,
      reference: bill.billNumber, lines: journalLines,
      totalDebit: bill.total, totalCredit: bill.total,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = Math.round((acct.balance + change) * 100) / 100;
        await acct.save();
      }
    }

    const vendor = await Vendor.findById(bill.vendor);
    if (vendor) {
      vendor.outstandingBalance = Math.round((vendor.outstandingBalance + bill.total) * 100) / 100;
      await vendor.save();
    }

    bill.status = 'approved';
    bill.approvedBy = req.user._id;
    bill.approvedAt = new Date();
    bill.journalEntry = journalEntry._id;
    await bill.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'approve_bill', module: 'bills',
      entityId: bill._id, entityType: 'Bill',
      description: `Approved bill ${bill.billNumber} — Journal ${entryNumber}`,
    }, req);

    res.json({
      success: true,
      message: `Bill ${bill.billNumber} approved. Journal ${entryNumber} posted.`,
      data: bill,
    });
  } catch (error) {
    console.error('[Bills] Approve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to approve bill.' });
  }
};

const deleteBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft bills can be deleted.' });
    }
    await Bill.findByIdAndDelete(req.params.id);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'bills',
      entityId: bill._id, entityType: 'Bill',
      description: `Deleted draft bill: ${bill.billNumber}`,
    }, req);
    res.json({ success: true, message: `Bill ${bill.billNumber} deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete bill.' });
  }
};

module.exports = { getBills, getBill, createBill, approveBill, deleteBill };