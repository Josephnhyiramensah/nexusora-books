const express = require('express');
const router = express.Router();
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { authenticateApiKey } = require('../controllers/apiKeyController');
const { getModel } = require('../utils/getModel');

// All external API routes require tenant middleware + API key auth
router.use(tenantMiddleware);
router.use(authenticateApiKey);

// GET /external/v1/invoices
router.get('/invoices', async (req, res) => {
  try {
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const { status, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const invoices = await Invoice.find(filter)
      .populate('customer', 'name email phone')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: invoices, count: invoices.length, page: Number(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoices.' });
  }
});

// GET /external/v1/customers
router.get('/customers', async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const customers = await Customer.find({ isActive: true }).lean();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
  }
});

// GET /external/v1/accounts
router.get('/accounts', async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const accounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch accounts.' });
  }
});

// GET /external/v1/reports/trial-balance
router.get('/reports/trial-balance', async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const accounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();
    let totalDebit = 0, totalCredit = 0;
    const rows = accounts.map((a) => {
      const bal = a.balance || 0;
      let debit = 0, credit = 0;
      if (a.normalBalance === 'debit') { if (bal >= 0) debit = bal; else credit = Math.abs(bal); }
      else { if (bal >= 0) credit = bal; else debit = Math.abs(bal); }
      totalDebit += debit; totalCredit += credit;
      return { code: a.code, name: a.name, type: a.type, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 };
    });
    res.json({ success: true, data: { rows, totalDebit: Math.round(totalDebit * 100) / 100, totalCredit: Math.round(totalCredit * 100) / 100, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

// POST /external/v1/journals — write permission required
router.post('/journals', async (req, res) => {
  if (!req.apiPermissions.includes('write') && !req.apiPermissions.includes('journals')) {
    return res.status(403).json({ success: false, message: 'This API key does not have write permission.' });
  }
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const { description, date, lines } = req.body;
    if (!lines || lines.length < 2) return res.status(400).json({ success: false, message: 'At least 2 journal lines required.' });
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ success: false, message: 'Journal entry does not balance.' });
    const { generateEntryNumber } = require('../utils/accountingHelpers');
    const entryNumber = await generateEntryNumber(JournalEntry);
    const entry = await JournalEntry.create({
      entryNumber, date: date || new Date(), journalType: 'general',
      description, lines, totalDebit, totalCredit,
      status: 'draft', createdBy: null,
      createdViaApi: true, apiKeyId: req.apiKey._id,
    });
    res.status(201).json({ success: true, data: entry, message: `Journal ${entryNumber} created as draft.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create journal.' });
  }
});

module.exports = router;