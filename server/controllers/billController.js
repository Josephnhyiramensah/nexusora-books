const { getModel } = require('../utils/getModel');
const { getSpecialAccount, specialAccountCode } = require('../utils/specialAccounts');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');
const { generateBillPDF } = require('../utils/pdfGenerator');
const { scopedFilter } = require('../utils/branchScope');
const { resolveWriteBranch, getActiveBranches } = require('../utils/branchWrite');
const { postStockForBill } = require('../utils/inventoryService');
const { inventoryAccountForBillLine } = require('../utils/inventoryPosting');
// Head Office branch id — safe default so nothing is left unbranched.
async function headOfficeId(req) {
  const Branch = getModel(req.tenantDb, 'Branch');
  const ho = await Branch.findOne({ isHeadOffice: true }).select('_id').lean();
  return ho ? ho._id : null;
}
// Resolve a stamped branch id to a "CODE — Name" label for a document, but only
// when the tenant runs 2+ active branches. Returns null when it shouldn't show.
async function resolveBranchLabel(req, branchId) {
  if (!branchId) return null;
  const active = await getActiveBranches(req);
  if (active.length <= 1) return null;
  const b = active.find((x) => String(x._id) === String(branchId));
  if (!b) return null;
  return b.code ? `${b.code} — ${b.name}` : b.name;
}

// Generate the next bill number. A tenant can customise the series via
// settings.documentNumbers.bill = { prefix, padding, startNumber }. With no
// config the defaults reproduce the historical 'BILL-000001'. The running
// number comes from the highest existing bill that already uses THIS prefix, so
// changing the prefix starts a clean series with no counter to seed or drift.
async function generateBillNumber(Bill, cfg = {}) {
  const c = cfg || {};
  const prefix = (c.prefix != null && c.prefix !== '') ? String(c.prefix) : 'BILL-';
  const padding = Number.isFinite(Number(c.padding)) ? Number(c.padding) : 6;
  const start = Number.isFinite(Number(c.startNumber)) ? Number(c.startNumber) : 1;

  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('^' + esc + '(\\d+)$');

  const last = await Bill.findOne({ billNumber: rx })
    .sort({ billNumber: -1 })
    .select('billNumber')
    .lean();

  let n = start;
  if (last && last.billNumber) {
    const m = last.billNumber.match(rx);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  if (n < start) n = start;
  return prefix + String(n).padStart(padding, '0');
}

const getBills = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const base = {};
    if (req.query.status) base.status = req.query.status;
    if (req.query.vendor) base.vendor = req.query.vendor;
    const bills = await Bill.find(scopedFilter(req, base)).populate('vendor', 'name email phone').populate('createdBy', 'firstName lastName').sort({ date: -1 }).lean();
    res.json({ success: true, data: bills, count: bills.length });
  } catch (error) {
    console.error('[Bills] getBills failed:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch bills.' });
  }
};

const getBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id }))
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

    // Option B — branch is an explicit field on the bill, server-enforced.
    // Rejects an ambiguous create (2+ active branches, none chosen) rather than
    // silently filing under Head Office. Closes the form and the REST API alike.
    const branchChoice = await resolveWriteBranch(req, req.body.branch);
    if (branchChoice.error) {
      return res.status(branchChoice.status).json({ success: false, message: branchChoice.error });
    }

    // Default expense for a line with no account chosen — resolved by ROLE.
    // required:false keeps today's behaviour: with no default in the chart,
    // line.account is left undefined rather than failing the create.
    const defaultExpenseAcct = await getSpecialAccount(req, 'defaultExpense', { required: false });

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
    const billNumber = await generateBillNumber(Bill, req.tenant?.settings?.documentNumbers?.bill);

    // Snapshot tenant-defined custom fields (header-level) onto this bill.
    const cfDefs = ((req.tenant && req.tenant.settings && req.tenant.settings.customFields) || []).filter((d) => d.target === 'bill');
    const cfSubmitted = req.body.customFields || {};
    const cfSnapshot = [];
    for (const d of cfDefs) {
      let v = cfSubmitted[d.id];
      if (d.type === 'checkbox') v = !!v;
      if (d.required && (v === undefined || v === null || v === '')) {
        return res.status(400).json({ success: false, message: d.label + ' is required.' });
      }
      if (v !== undefined && v !== null && v !== '') {
        cfSnapshot.push({ fieldId: d.id, label: d.label, type: d.type, value: v });
      }
    }

    const branch = branchChoice.branch;
    const bill = await Bill.create({
      billNumber, vendor, date, dueDate,
      lines: processedLines,
      subtotal, taxRate: taxRate || 0, taxAmount: tax,
      total, amountPaid: 0, balance: total,
      customFields: cfSnapshot,
      status: 'draft', notes, createdBy: req.user._id,
      branch,
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

    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft bills can be approved.' });
    }

    // Maker-checker: an accountant approving a bill needs a manager's sign-off
    // when the tenant requires it. Route to awaiting_approval WITHOUT posting.
    const needsApproval = req.tenant && req.tenant.settings && req.tenant.settings.requireApproval === true && req.user.role === 'accountant';
    if (needsApproval) {
      bill.status = 'awaiting_approval';
      await bill.save();

          try {
      await postStockForBill(req.tenantDb, bill, req.user._id);
    } catch (e) {
      console.error('[Inventory] Bill stock posting failed:', e.message);
    }

      await logAudit(req.tenantDb, {
        userId: req.user._id, action: 'submit_for_approval', module: 'bills',
        entityId: bill._id, entityType: 'Bill',
        description: 'Submitted bill for approval: ' + bill.billNumber,
      }, req);
      return res.json({ success: true, message: 'Bill ' + bill.billNumber + ' submitted for approval.', data: bill });
    }

    // AP resolved by ROLE, not the literal '2000'. Fetched with required:false so
    // the clearer 500 below remains the single failure path for a chart that has
    // no payables account mapped.
    const apAccount = await getSpecialAccount(req, 'accountsPayable', { required: false });
    if (!apAccount) {
      return res.status(500).json({
        success: false,
        message: `Accounts Payable (code ${specialAccountCode(req, 'accountsPayable')}) not found. Map it under Settings → Special Accounts.`,
      });
    }

    const journalLines = [];

    for (const line of bill.lines) {
      
      // Perpetual: an item-bearing line debits Inventory (the purchase is an asset),
// not an expense — the expense arrives later when the stock is sold. Periodic
// returns null and the original behaviour is unchanged.
const invAcct = await inventoryAccountForBillLine(req, line);
const expenseAcct = invAcct || (line.account ? await Account.findById(line.account) : await getSpecialAccount(req, 'defaultExpense', { required: false }));

      journalLines.push({
        account: expenseAcct._id, accountCode: expenseAcct.code, accountName: expenseAcct.name,
        debit: line.amount, credit: 0, description: line.description,
      });
    }

    if (bill.taxAmount > 0) {
      // Purchase tax stays OPTIONAL exactly as before — no tax account in the
      // chart means the bill still posts and the tax line is simply omitted.
      const taxAccount = await getSpecialAccount(req, 'taxPayable', { required: false });
      if (taxAccount) {
        journalLines.push({
          account: taxAccount._id, accountCode: taxAccount.code, accountName: taxAccount.name,
          debit: bill.taxAmount, credit: 0, description: `Tax on Bill ${bill.billNumber}`,
        });
      }
    }

    journalLines.push({
      account: apAccount._id, accountCode: apAccount.code, accountName: apAccount.name,
      debit: 0, credit: bill.total, description: `Bill ${bill.billNumber}`,
    });

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date: bill.date, journalType: 'purchases',
      description: `Bill ${bill.billNumber} approved`,
      reference: bill.billNumber, lines: journalLines,
      totalDebit: bill.total, totalCredit: bill.total,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
      branch: bill.branch || await headOfficeId(req),
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
    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft bills can be deleted.' });
    }
    await Bill.findByIdAndDelete(bill._id);
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


const confirmBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'Only bills awaiting approval can be confirmed.' });
    }
    if (bill.createdBy && String(bill.createdBy) === String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You cannot approve a bill you created. A different admin must approve it.' });
    }
    bill.status = 'draft';
    bill.approvedBy = req.user._id;
    bill.approvedAt = new Date();
    await bill.save();
    return approveBill(req, res);
  } catch (error) {
    console.error('[Bills] Confirm error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to confirm bill.' });
  }
};

const rejectBill = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'Only bills awaiting approval can be rejected.' });
    }
    bill.status = 'draft';
    bill.rejectionReason = (req.body.reason || '').trim() || 'No reason given';
    await bill.save();
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'reject', module: 'bills',
      entityId: bill._id, entityType: 'Bill',
      description: 'Rejected bill ' + bill.billNumber + ': ' + bill.rejectionReason,
    }, req);
    res.json({ success: true, message: 'Bill ' + bill.billNumber + ' rejected and returned to draft.', data: bill });
  } catch (error) {
    console.error('[Bills] Reject error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reject bill.' });
  }
};

// GET /api/bills/:id/pdf — stream a branded bill PDF.
const downloadBillPDF = async (req, res) => {
  try {
    const Bill = getModel(req.tenantDb, 'Bill');
    const bill = await Bill.findOne(scopedFilter(req, { _id: req.params.id })).populate('vendor', 'name email phone address taxId');
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

    const tenantSettings = req.tenant?.settings || {};
    const companyName = req.tenant?.companyName || '';
    const plan = req.tenant?.plan || 'trial';

    // Branch on the document — only when the tenant runs more than one active
    // branch. Resolved server-side because the PDF has no client branch context.
    const branchLabel = await resolveBranchLabel(req, bill.branch);

    const pdfBuffer = await generateBillPDF({
      bill,
      vendor: bill.vendor,
      tenantSettings,
      companyName,
      plan,
      branchLabel,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${bill.billNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[Bills] PDF generation failed:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate bill PDF.' });
  }
};

module.exports = { getBills, getBill, createBill, approveBill, deleteBill, confirmBill, rejectBill, downloadBillPDF };