const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ─── Workers ─────────────────────────────────────────────────────────────────
const getCasualWorkers = async (req, res) => {
  try {
    const CasualWorker = getModel(req.tenantDb, 'CasualWorker');
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const workers = await CasualWorker.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: workers, count: workers.length });
  } catch (error) {
    console.error('[Casual] List workers:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch casual workers.' });
  }
};

const createCasualWorker = async (req, res) => {
  try {
    const { name, phone, idNumber, defaultRate, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    const CasualWorker = getModel(req.tenantDb, 'CasualWorker');
    const count = await CasualWorker.countDocuments({});
    const workerId = `CW-${(count + 1).toString().padStart(3, '0')}`;

    const worker = await CasualWorker.create({
      workerId, name: String(name).trim(), phone, idNumber,
      defaultRate: r2(defaultRate), notes, createdBy: req.user._id,
    });
    res.status(201).json({ success: true, message: `Worker ${workerId} added.`, data: worker });
  } catch (error) {
    console.error('[Casual] Create worker:', error.message);
    res.status(500).json({ success: false, message: 'Failed to add casual worker.' });
  }
};

const updateCasualWorker = async (req, res) => {
  try {
    const CasualWorker = getModel(req.tenantDb, 'CasualWorker');
    const worker = await CasualWorker.findById(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found.' });

    ['name', 'phone', 'idNumber', 'defaultRate', 'notes', 'isActive'].forEach((f) => {
      if (req.body[f] !== undefined) worker[f] = req.body[f];
    });
    await worker.save();
    res.json({ success: true, message: 'Worker updated.', data: worker });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update worker.' });
  }
};

// ─── Payment sheets ──────────────────────────────────────────────────────────
const getCasualSheets = async (req, res) => {
  try {
    const Sheet = getModel(req.tenantDb, 'CasualPaymentSheet');
    const sheets = await Sheet.find({}).sort({ date: -1 }).lean();
    res.json({ success: true, data: sheets, count: sheets.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment sheets.' });
  }
};

const getCasualSheet = async (req, res) => {
  try {
    const Sheet = getModel(req.tenantDb, 'CasualPaymentSheet');
    const sheet = await Sheet.findById(req.params.id).lean();
    if (!sheet) return res.status(404).json({ success: false, message: 'Payment sheet not found.' });
    res.json({ success: true, data: sheet });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment sheet.' });
  }
};

const createCasualSheet = async (req, res) => {
  try {
    const { title, periodLabel, date, lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one worker line is required.' });
    }

    const Sheet = getModel(req.tenantDb, 'CasualPaymentSheet');

    const clean = lines
      .filter((l) => l && (l.workerName || l.worker))
      .map((l) => {
        const rate = r2(l.rate);
        const days = Number(l.days) || 0;
        const computedAmount = r2(rate * days);
        return {
          worker: l.worker || undefined,
          workerName: String(l.workerName || '').trim(),
          rate, days, computedAmount,
          amount: l.amount === undefined || l.amount === null || l.amount === ''
            ? computedAmount : r2(l.amount),
          note: l.note || '',
        };
      });

    if (clean.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid worker lines supplied.' });
    }

    const totalAmount = r2(clean.reduce((s, l) => s + l.amount, 0));
    const count = await Sheet.countDocuments({});
    const sheetNumber = `CP-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`;

    const sheet = await Sheet.create({
      sheetNumber, title, periodLabel,
      date: date ? new Date(date) : new Date(),
      lines: clean, totalAmount, status: 'draft', createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: `Sheet ${sheetNumber} created.`, data: sheet });
  } catch (error) {
    console.error('[Casual] Create sheet:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create payment sheet.' });
  }
};

const approveCasualSheet = async (req, res) => {
  try {
    const Sheet = getModel(req.tenantDb, 'CasualPaymentSheet');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const sheet = await Sheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ success: false, message: 'Payment sheet not found.' });
    if (sheet.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only a draft sheet can be approved.' });
    }
    if (!sheet.totalAmount || sheet.totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Sheet total is zero — nothing to post.' });
    }

    let wagesAcct = await Account.findOne({ code: '6010' });
    if (!wagesAcct) {
      wagesAcct = await Account.create({
        code: '6010', name: 'Casual Wages', type: 'expense',
        category: 'Operating Expense', normalBalance: 'debit',
        isSystemAccount: true, isActive: true, balance: 0,
        description: 'Wages paid to casual/day workers',
      });
    }
    const cashAcct = await Account.findOne({ code: '1020' });
    if (!cashAcct) {
      return res.status(500).json({ success: false, message: 'Cash account (1020) not found.' });
    }

    const journalLines = [
      { account: wagesAcct._id, accountCode: '6010', accountName: wagesAcct.name, debit: sheet.totalAmount, credit: 0, description: `Casual wages ${sheet.sheetNumber}` },
      { account: cashAcct._id, accountCode: '1020', accountName: cashAcct.name, debit: 0, credit: sheet.totalAmount, description: `Casual wages paid ${sheet.sheetNumber}` },
    ];

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journal = await JournalEntry.create({
      entryNumber, date: sheet.date || new Date(), journalType: 'general',
      description: `Casual worker payment ${sheet.sheetNumber}`,
      reference: sheet.sheetNumber, lines: journalLines,
      totalDebit: sheet.totalAmount, totalCredit: sheet.totalAmount,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = r2(acct.balance + change);
        await acct.save();
      }
    }

    sheet.status = 'approved';
    sheet.approvedBy = req.user._id;
    sheet.journalEntry = journal._id;
    await sheet.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'approve', module: 'payroll',
      entityId: sheet._id, entityType: 'CasualPaymentSheet',
      description: `Approved casual sheet ${sheet.sheetNumber} — Journal ${entryNumber}`,
    }, req);

    res.json({ success: true, message: `Sheet ${sheet.sheetNumber} approved. Journal ${entryNumber} posted.`, data: sheet });
  } catch (error) {
    console.error('[Casual] Approve sheet:', error.message);
    res.status(500).json({ success: false, message: 'Failed to approve payment sheet.' });
  }
};

const deleteCasualSheet = async (req, res) => {
  try {
    const Sheet = getModel(req.tenantDb, 'CasualPaymentSheet');
    const sheet = await Sheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ success: false, message: 'Payment sheet not found.' });
    if (sheet.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'An approved sheet cannot be deleted — reverse the journal instead.' });
    }
    await sheet.deleteOne();
    res.json({ success: true, message: 'Draft sheet deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete payment sheet.' });
  }
};

module.exports = {
  getCasualWorkers, createCasualWorker, updateCasualWorker,
  getCasualSheets, getCasualSheet, createCasualSheet,
  approveCasualSheet, deleteCasualSheet,
};
