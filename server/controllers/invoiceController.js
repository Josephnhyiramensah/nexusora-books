const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

// Generate the next invoice number. A tenant can customise the series via
// settings.documentNumbers.invoice = { prefix, padding, startNumber }. When no
// config is passed the defaults reproduce the historical behaviour exactly
// ('INV-000001'), so tenants who never customise are unaffected. The running
// number is derived from the highest existing invoice that already uses THIS
// prefix, so changing the prefix starts a clean series without colliding with
// old numbers, and there is no separate counter to seed or drift.
async function generateInvoiceNumber(Invoice, cfg = {}) {
  const c = cfg || {};
  const prefix = (c.prefix != null && c.prefix !== '') ? String(c.prefix) : 'INV-';
  const padding = Number.isFinite(Number(c.padding)) ? Number(c.padding) : 6;
  const start = Number.isFinite(Number(c.startNumber)) ? Number(c.startNumber) : 1;

  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('^' + esc + '(\\d+)$');

  const last = await Invoice.findOne({ invoiceNumber: rx })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  let n = start;
  if (last && last.invoiceNumber) {
    const m = last.invoiceNumber.match(rx);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  if (n < start) n = start;
  return prefix + String(n).padStart(padding, '0');
}

const getInvoices = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customer) filter.customer = req.query.customer;
    const invoices = await Invoice.find(filter).populate('createdBy', 'firstName lastName')
      .populate('customer', 'name email phone')
      .sort({ date: -1 }).lean();
    res.json({ success: true, data: invoices, count: invoices.length });
 } catch (error) {
    console.error('[Invoices] getInvoices failed:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices.' });
  }
};

const getInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'name email phone address taxId')
      .populate('journalEntry');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoice.' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Account = getModel(req.tenantDb, 'Account');
    const { customer, date, dueDate, lines, taxRate, notes, currency, exchangeRate } = req.body;

    if (!customer || !date || !dueDate || !lines || lines.length < 1) {
      return res.status(400).json({ success: false, message: 'Required: customer, date, dueDate, and at least 1 line.' });
    }

    const defaultRevenueAcct = await Account.findOne({ code: '4000' });

    const processedLines = lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) / 100,
      account: l.account || defaultRevenueAcct?._id,
    }));

    const subtotal = processedLines.reduce((sum, l) => sum + l.amount, 0);
    const tax = taxRate ? Math.round(subtotal * (Number(taxRate) / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const fxRate = (Number(exchangeRate) > 0) ? Number(exchangeRate) : 1;
    const baseSubtotal = Math.round(subtotal * fxRate * 100) / 100;
    const baseTaxAmount = Math.round(tax * fxRate * 100) / 100;
    const baseTotal = Math.round(total * fxRate * 100) / 100;
    const invoiceNumber = await generateInvoiceNumber(Invoice, req.tenant?.settings?.documentNumbers?.invoice);

    const invoice = await Invoice.create({
      invoiceNumber, customer, date, dueDate,
      lines: processedLines,
      subtotal, taxRate: taxRate || 0, taxAmount: tax,
      total, amountPaid: 0, balance: total,
      currency: currency || '', exchangeRate: fxRate,
      baseSubtotal, baseTaxAmount, baseTotal,
      status: 'draft', notes, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'invoices',
      entityId: invoice._id, entityType: 'Invoice',
      description: `Created invoice: ${invoiceNumber} (${total})`,
    }, req);

    res.status(201).json({ success: true, message: `Invoice ${invoiceNumber} created.`, data: invoice });
  } catch (error) {
    console.error('[Invoices] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create invoice.' });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft invoices can be edited.' });
    }

    const { date, dueDate, lines, taxRate, notes } = req.body;

    if (lines && lines.length >= 1) {
      const processedLines = lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) / 100,
        account: l.account,
      }));
      invoice.lines = processedLines;
      invoice.subtotal = processedLines.reduce((sum, l) => sum + l.amount, 0);
      const tr = taxRate !== undefined ? Number(taxRate) : invoice.taxRate;
      invoice.taxRate = tr;
      invoice.taxAmount = Math.round(invoice.subtotal * (tr / 100) * 100) / 100;
      invoice.total = Math.round((invoice.subtotal + invoice.taxAmount) * 100) / 100;
      invoice.balance = invoice.total - invoice.amountPaid;
    }

    if (date) invoice.date = date;
    if (dueDate) invoice.dueDate = dueDate;
    if (notes !== undefined) invoice.notes = notes;
    await invoice.save();

    res.json({ success: true, message: 'Invoice updated.', data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update invoice.' });
  }
};

const sendInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Customer = getModel(req.tenantDb, 'Customer');

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft invoices can be sent.' });
    }

    // Maker-checker: accountant sends need approval when the tenant requires it.
    // Route to awaiting_approval WITHOUT creating the journal entry or moving
    // balances — the real posting happens on approval.
    const needsApproval = req.tenant && req.tenant.settings && req.tenant.settings.requireApproval === true && req.user.role === 'accountant';
    if (needsApproval) {
      invoice.status = 'awaiting_approval';
      await invoice.save();
      await logAudit(req.tenantDb, {
        userId: req.user._id, action: 'submit_for_approval', module: 'invoices',
        entityId: invoice._id, entityType: 'Invoice',
        description: 'Submitted invoice for approval: ' + invoice.invoiceNumber,
      }, req);
      return res.json({ success: true, message: 'Invoice ' + invoice.invoiceNumber + ' submitted for approval.', data: invoice });
    }

    // Multi-currency: post the ledger in base (GHS). For GHS invoices rate=1.
    const fxRate = (invoice.exchangeRate && invoice.exchangeRate > 0) ? invoice.exchangeRate : 1;
    const toBase = (amt) => Math.round((Number(amt) || 0) * fxRate * 100) / 100;
    const arAccount = await Account.findOne({ code: '1100' });
    const taxAccount = await Account.findOne({ code: '2400' });
    if (!arAccount) return res.status(500).json({ success: false, message: 'Accounts Receivable (1100) not found.' });

    const journalLines = [];
    journalLines.push({
      account: arAccount._id, accountCode: '1100', accountName: arAccount.name,
      debit: toBase(invoice.total), credit: 0, description: `Invoice ${invoice.invoiceNumber}`,
    });

    for (const line of invoice.lines) {
      const revenueAcct = line.account ? await Account.findById(line.account) : await Account.findOne({ code: '4000' });
      journalLines.push({
        account: revenueAcct._id, accountCode: revenueAcct.code, accountName: revenueAcct.name,
        debit: 0, credit: toBase(line.amount), description: line.description,
      });
    }

    if (invoice.taxAmount > 0 && taxAccount) {
      journalLines.push({
        account: taxAccount._id, accountCode: '2400', accountName: taxAccount.name,
        debit: 0, credit: invoice.taxAmount,
        description: `Tax on Invoice ${invoice.invoiceNumber}`,
      });
    }

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalEntry = await JournalEntry.create({
      entryNumber, date: invoice.date, journalType: 'sales',
      description: `Invoice ${invoice.invoiceNumber} sent`,
      reference: invoice.invoiceNumber, lines: journalLines,
      totalDebit: toBase(invoice.total), totalCredit: toBase(invoice.total),
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

    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      customer.outstandingBalance = Math.round((customer.outstandingBalance + toBase(invoice.total)) * 100) / 100;
      await customer.save();
    }

    invoice.baseSubtotal = toBase(invoice.subtotal);
    invoice.baseTaxAmount = toBase(invoice.taxAmount);
    invoice.baseTotal = toBase(invoice.total);
    invoice.status = 'sent';
    invoice.journalEntry = journalEntry._id;
    await invoice.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'invoices',
      entityId: invoice._id, entityType: 'Invoice',
      description: `Sent invoice ${invoice.invoiceNumber} — Journal ${entryNumber} created`,
    }, req);

    res.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} sent. Journal ${entryNumber} posted.`,
      data: invoice,
    });
  } catch (error) {
    console.error('[Invoices] Send error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send invoice.' });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft invoices can be deleted.' });
    }
    await Invoice.findByIdAndDelete(req.params.id);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'invoices',
      entityId: invoice._id, entityType: 'Invoice',
      description: `Deleted draft invoice: ${invoice.invoiceNumber}`,
    }, req);
    res.json({ success: true, message: `Invoice ${invoice.invoiceNumber} deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete invoice.' });
  }
};

const downloadInvoicePDF = async (req, res) => {
  try {
    const { generateInvoicePDF } = require('../utils/pdfGenerator');
    const Invoice  = getModel(req.tenantDb, 'Invoice');
    const Customer = getModel(req.tenantDb, 'Customer');

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const customer = await Customer.findById(invoice.customer);

    const pdfBuffer = await generateInvoicePDF({
      invoice,
      customer,
      tenantSettings: req.tenant?.settings || {},
      companyName: req.tenant?.companyName || '',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF] Invoice error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate invoice PDF.' });
  }
};


// ---- Recurring invoices ------------------------------------------------------
// Advance a date by a frequency.
function advanceDate(from, frequency) {
  const d = new Date(from);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}

// Turn an existing invoice into a recurring TEMPLATE.
const markRecurring = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const { frequency, startDate, endDate } = req.body;
    if (!['weekly','monthly','quarterly','yearly'].includes(frequency)) {
      return res.status(400).json({ success: false, message: 'Valid frequency required.' });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    invoice.isRecurringTemplate = true;
    invoice.recurring = {
      active: true, frequency,
      nextRun: startDate ? new Date(startDate) : advanceDate(invoice.date, frequency),
      endDate: endDate ? new Date(endDate) : null,
      lastGenerated: null, count: 0,
    };
    await invoice.save();
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'invoices',
      entityId: invoice._id, entityType: 'Invoice',
      description: 'Made invoice ' + invoice.invoiceNumber + ' recurring (' + frequency + ')',
    }, req);
    res.json({ success: true, message: 'Invoice set to recur ' + frequency + '.', data: invoice });
  } catch (error) {
    console.error('[Invoices] markRecurring error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to set recurring.' });
  }
};

// List active recurring templates.
const getRecurringTemplates = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const templates = await Invoice.find({ isRecurringTemplate: true })
      .populate('customer', 'name').sort({ 'recurring.nextRun': 1 }).lean();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch templates.' });
  }
};

// Stop a template recurring (keeps the invoice, just deactivates the schedule).
const stopRecurring = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    invoice.recurring = invoice.recurring || {};
    invoice.recurring.active = false;
    await invoice.save();
    res.json({ success: true, message: 'Recurring stopped.', data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to stop recurring.' });
  }
};

// The generator: find due templates and create a draft child from each. Called
// on invoice-page load. Safe to call often — it only acts on templates whose
// nextRun has passed, and advances nextRun so it won't double-generate.
const runDueRecurring = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const now = new Date();
    const due = await Invoice.find({
      isRecurringTemplate: true,
      'recurring.active': true,
      'recurring.nextRun': { $lte: now },
    });

    const created = [];
    for (const tmpl of due) {
      // stop if past end date
      if (tmpl.recurring.endDate && tmpl.recurring.nextRun > tmpl.recurring.endDate) {
        tmpl.recurring.active = false; await tmpl.save(); continue;
      }
      // guard against a runaway loop: generate at most a few catch-up cycles
      let cycles = 0;
      while (tmpl.recurring.active && tmpl.recurring.nextRun <= now && cycles < 24) {
        cycles += 1;
        const invDate = new Date(tmpl.recurring.nextRun);
        const dueDate = new Date(invDate);
        // keep the same gap the template had between date and dueDate
        const gap = Math.max(0, Math.round((new Date(tmpl.dueDate) - new Date(tmpl.date)) / 86400000)) || 30;
        dueDate.setDate(dueDate.getDate() + gap);

        const invoiceNumber = await generateInvoiceNumber(Invoice, req.tenant?.settings?.documentNumbers?.invoice);
        const child = await Invoice.create({
          invoiceNumber, customer: tmpl.customer, date: invDate, dueDate,
          lines: tmpl.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, account: l.account })),
          subtotal: tmpl.subtotal, taxRate: tmpl.taxRate, taxAmount: tmpl.taxAmount,
          total: tmpl.total, amountPaid: 0, balance: tmpl.total,
          status: 'draft', notes: tmpl.notes,
          generatedFrom: tmpl._id, createdBy: tmpl.createdBy,
        });
        created.push(child.invoiceNumber);

        tmpl.recurring.lastGenerated = new Date();
        tmpl.recurring.count = (tmpl.recurring.count || 0) + 1;
        tmpl.recurring.nextRun = advanceDate(tmpl.recurring.nextRun, tmpl.recurring.frequency);
        if (tmpl.recurring.endDate && tmpl.recurring.nextRun > tmpl.recurring.endDate) {
          tmpl.recurring.active = false;
        }
      }
      await tmpl.save();
    }

    res.json({ success: true, message: created.length ? ('Generated ' + created.length + ' invoice(s).') : 'Nothing due.', data: { created } });
  } catch (error) {
    console.error('[Invoices] runDueRecurring error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate recurring invoices.' });
  }
};


const approveInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'Only invoices awaiting approval can be approved.' });
    }
    if (invoice.createdBy && String(invoice.createdBy) === String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You cannot approve an invoice you created. A different admin must approve it.' });
    }
    invoice.status = 'draft';
    invoice.approvedBy = req.user._id;
    invoice.approvedAt = new Date();
    await invoice.save();
    return sendInvoice(req, res);
  } catch (error) {
    console.error('[Invoices] Approve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to approve invoice.' });
  }
};

const rejectInvoice = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status !== 'awaiting_approval') {
      return res.status(400).json({ success: false, message: 'Only invoices awaiting approval can be rejected.' });
    }
    invoice.status = 'draft';
    invoice.rejectionReason = (req.body.reason || '').trim() || 'No reason given';
    await invoice.save();
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'reject', module: 'invoices',
      entityId: invoice._id, entityType: 'Invoice',
      description: 'Rejected invoice ' + invoice.invoiceNumber + ': ' + invoice.rejectionReason,
    }, req);
    res.json({ success: true, message: 'Invoice ' + invoice.invoiceNumber + ' rejected and returned to draft.', data: invoice });
  } catch (error) {
    console.error('[Invoices] Reject error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reject invoice.' });
  }
};

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, sendInvoice, deleteInvoice, downloadInvoicePDF , markRecurring, getRecurringTemplates, stopRecurring, runDueRecurring, approveInvoice, rejectInvoice };
