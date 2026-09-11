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

// POST /external/v1/vouchers — inbound voucher from an external system.
// Requires 'write' (or 'journals') permission on the API key.
//
// Body (Books format — codes, not the external system's own IDs):
//   {
//     "voucherType": "receipt",        // payment|receipt|contra|transfer|journal|purchase|sales|debit_note|credit_note
//     "date": "2026-09-11",
//     "amount": 5000,
//     "narration": "Gold purchase",
//     "reference": "PHP-REF-123",       // optional, the source's human ref
//     "externalId": "php_payment_49468",// REQUIRED for dedup — the source row's unique id
//     "partyName": "ABC Traders",
//     "mode": "bank_transfer",
//     "paymentDetails": { ... },        // optional, free-form
//     "debitAccountCode": "1020",
//     "creditAccountCode": "4000",
//     "autopost": true                  // optional (default true) — post immediately
//   }
router.post('/vouchers', async (req, res) => {
  if (!req.apiPermissions.includes('write') && !req.apiPermissions.includes('journals')) {
    return res.status(403).json({ success: false, message: 'This API key does not have write permission.' });
  }
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const { validateDoubleEntry, generateEntryNumber } = require('../utils/accountingHelpers');
    const { generateVoucherNumber, journalTypeForVoucher } = require('../utils/voucherHelpers');

    const {
      voucherType, date, amount, narration, reference, externalId,
      partyName, mode, paymentDetails,
      debitAccountCode, creditAccountCode,
      autopost = true,
    } = req.body;

    // Validate required fields.
    const VALID_TYPES = ['payment','receipt','contra','transfer','journal','purchase','sales','debit_note','credit_note'];
    if (!voucherType || !VALID_TYPES.includes(voucherType)) {
      return res.status(400).json({ success: false, message: 'Valid voucherType is required.' });
    }
    if (!date || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'date and a positive amount are required.' });
    }
    if (!debitAccountCode || !creditAccountCode) {
      return res.status(400).json({ success: false, message: 'debitAccountCode and creditAccountCode are required.' });
    }
    if (debitAccountCode === creditAccountCode) {
      return res.status(400).json({ success: false, message: 'Debit and credit accounts must differ.' });
    }
    if (!externalId) {
      return res.status(400).json({ success: false, message: 'externalId is required (used to prevent duplicate imports).' });
    }

    // Dedup: reject if this external record was already imported.
    const existing = await Voucher.findOne({ externalId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This record was already imported.', data: { voucherNumber: existing.voucherNumber, id: existing._id } });
    }

    // Resolve account codes -> account documents.
    const debitAcct = await Account.findOne({ code: String(debitAccountCode) });
    if (!debitAcct) return res.status(400).json({ success: false, message: `Debit account code "${debitAccountCode}" not found.` });
    if (debitAcct.isActive === false) return res.status(400).json({ success: false, message: `Debit account "${debitAccountCode}" is inactive.` });
    const creditAcct = await Account.findOne({ code: String(creditAccountCode) });
    if (!creditAcct) return res.status(400).json({ success: false, message: `Credit account code "${creditAccountCode}" not found.` });
    if (creditAcct.isActive === false) return res.status(400).json({ success: false, message: `Credit account "${creditAccountCode}" is inactive.` });

    const amt = Math.round(Number(amount) * 100) / 100;
    const lines = [
      { account: debitAcct._id, accountCode: debitAcct.code, accountName: debitAcct.name, debit: amt, credit: 0, description: narration || '' },
      { account: creditAcct._id, accountCode: creditAcct.code, accountName: creditAcct.name, debit: 0, credit: amt, description: narration || '' },
    ];
    const validation = validateDoubleEntry(lines);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const voucherNumber = await generateVoucherNumber(Voucher, voucherType);
    const voucher = await Voucher.create({
      voucherNumber, voucherType, date, narration, reference,
      partyName, mode: mode || 'other', paymentDetails: paymentDetails || {},
      amount: amt, lines,
      totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
      status: 'draft', createdBy: null,
      createdViaApi: true, apiKeyId: req.apiKey._id, externalId,
    });

    let journalEntry = null;
    if (autopost) {
      const entryNumber = await generateEntryNumber(JournalEntry);
      journalEntry = await JournalEntry.create({
        entryNumber, date: voucher.date,
        journalType: journalTypeForVoucher(voucherType),
        description: narration || `${voucherType} voucher ${voucherNumber}`,
        reference: voucherNumber, lines,
        totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
        status: 'posted', createdBy: null,
        createdViaApi: true, apiKeyId: req.apiKey._id,
      });
      voucher.status = 'posted';
      voucher.journalEntry = journalEntry._id;
      await voucher.save();
    }

    res.status(201).json({
      success: true,
      message: `Voucher ${voucherNumber} ${autopost ? 'created and posted' : 'created as draft'}.`,
      data: {
        voucherNumber: voucher.voucherNumber,
        id: voucher._id,
        status: voucher.status,
        journalEntryNumber: journalEntry ? journalEntry.entryNumber : null,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate record (already imported).' });
    }
    console.error('[ExternalAPI] Voucher create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create voucher.' });
  }
});

module.exports = router;