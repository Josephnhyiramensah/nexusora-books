const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

async function generateInvoiceNumber(Invoice) {
  const last = await Invoice.findOne({}).sort({ createdAt: -1 }).select('invoiceNumber').lean();
  if (!last || !last.invoiceNumber) return 'INV-000001';
  const num = parseInt(last.invoiceNumber.replace('INV-', ''), 10);
  return `INV-${(num + 1).toString().padStart(6, '0')}`;
}

const getInvoices = async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customer) filter.customer = req.query.customer;
    const invoices = await Invoice.find(filter)
      .populate('customer', 'name email phone')
      .sort({ date: -1 }).lean();
    res.json({ success: true, data: invoices, count: invoices.length });
  } catch (error) {
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
    const { customer, date, dueDate, lines, taxRate, notes } = req.body;

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
    const invoiceNumber = await generateInvoiceNumber(Invoice);

    const invoice = await Invoice.create({
      invoiceNumber, customer, date, dueDate,
      lines: processedLines,
      subtotal, taxRate: taxRate || 0, taxAmount: tax,
      total, amountPaid: 0, balance: total,
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

    const arAccount = await Account.findOne({ code: '1100' });
    const taxAccount = await Account.findOne({ code: '2400' });
    if (!arAccount) return res.status(500).json({ success: false, message: 'Accounts Receivable (1100) not found.' });

    const journalLines = [];
    journalLines.push({
      account: arAccount._id, accountCode: '1100', accountName: arAccount.name,
      debit: invoice.total, credit: 0, description: `Invoice ${invoice.invoiceNumber}`,
    });

    for (const line of invoice.lines) {
      const revenueAcct = line.account ? await Account.findById(line.account) : await Account.findOne({ code: '4000' });
      journalLines.push({
        account: revenueAcct._id, accountCode: revenueAcct.code, accountName: revenueAcct.name,
        debit: 0, credit: line.amount, description: line.description,
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
      totalDebit: invoice.total, totalCredit: invoice.total,
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
      customer.outstandingBalance = Math.round((customer.outstandingBalance + invoice.total) * 100) / 100;
      await customer.save();
    }

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

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, sendInvoice, deleteInvoice, downloadInvoicePDF };