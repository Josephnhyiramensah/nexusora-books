const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { parseMomoStatement } = require('../utils/momoParser');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Import a statement. The client sends the file base64-encoded in the JSON body
// (matching how logo/letterhead uploads already work — the app doesn't use
// multipart). We decode to a buffer, parse, and store a draft session.
//
// This step ONLY parses and stores for review. No ledger posting happens here —
// that is a separate, explicit action once the user has checked the lines.
const importStatement = async (req, res) => {
  try {
    const { fileBase64, fileName, source = 'momo', bankAccountId } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, message: 'No file supplied.' });
    }

    // strip a data: URI prefix if present
    const b64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(b64, 'base64');

    let parsed;
    try {
      parsed = parseMomoStatement(buffer);
    } catch (e) {
      return res.status(422).json({ success: false, message: 'Could not read statement: ' + e.message });
    }

    const Session = getModel(req.tenantDb, 'ReconciliationSession');

    // Dedupe: collect externalIds already imported for this tenant so re-uploading
    // the same statement never creates duplicate lines.
    const priorIds = new Set();
    const existing = await Session.find({}, { 'lines.externalId': 1 }).lean();
    existing.forEach((s) => (s.lines || []).forEach((l) => l.externalId && priorIds.add(l.externalId)));

    const freshLines = parsed.lines.filter((l) => !l.externalId || !priorIds.has(l.externalId));
    const skipped = parsed.lines.length - freshLines.length;

    if (freshLines.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Every transaction in this statement has already been imported (' + skipped + ' duplicates skipped).',
      });
    }

    const count = await Session.countDocuments({});
    const sessionNumber = 'REC-' + new Date().getFullYear() + '-' + String(count + 1).padStart(3, '0');

    const session = await Session.create({
      sessionNumber,
      source,
      bankAccount: bankAccountId || null,
      accountHolder: parsed.meta.accountHolder,
      accountMsisdn: parsed.meta.accountMsisdn,
      periodStart: parsed.meta.periodStart,
      periodEnd: parsed.meta.periodEnd,
      openingBalance: r2(parsed.meta.openingBalance),
      closingBalance: r2(parsed.meta.closingBalance),
      fileName: fileName || 'statement',
      lines: freshLines,
      totalIn: r2(parsed.totals.totalIn),
      totalOut: r2(parsed.totals.totalOut),
      totalFees: r2(parsed.totals.totalFees),
      status: 'draft',
      importedBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'reconcile_bank', module: 'banking',
      entityId: session._id, entityType: 'ReconciliationSession',
      description: 'Imported ' + source + ' statement ' + sessionNumber + ' — '
        + freshLines.length + ' transactions' + (skipped ? ' (' + skipped + ' duplicates skipped)' : ''),
    }, req);

    res.status(201).json({
      success: true,
      message: 'Imported ' + freshLines.length + ' transactions'
        + (skipped ? ' (' + skipped + ' duplicates skipped).' : '.'),
      data: session,
      skipped,
    });
  } catch (error) {
    console.error('[Reconciliation] Import error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to import statement.' });
  }
};

const getSessions = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const sessions = await Session.find({}, { lines: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch sessions.' });
  }
};

const getSession = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const session = await Session.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch session.' });
  }
};

const deleteSession = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    if (session.status === 'reconciled') {
      return res.status(400).json({ success: false, message: 'A reconciled session cannot be deleted.' });
    }
    await session.deleteOne();
    res.json({ success: true, message: 'Session deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete session.' });
  }
};


// Ensure the Mobile Money wallet ledger account exists (1015). Created on first
// post so no manual setup is needed -- same approach as casual wages (6010).
async function ensureMomoWallet(Account) {
  let wallet = await Account.findOne({ code: '1015' });
  if (!wallet) {
    wallet = await Account.create({
      code: '1015', name: 'Mobile Money Wallet', type: 'asset',
      category: 'Current Asset', normalBalance: 'debit',
      isSystemAccount: true, isActive: true, balance: 0,
      description: 'Mobile Money wallet balance (reconciled against MoMo statements)',
    });
  }
  return wallet;
}

// Post ONE statement line to the ledger. This is the primary reconciliation
// action: a MoMo statement is usually imported precisely because these
// transactions were not recorded yet, so posting -- not matching -- is the
// common path.
//
// Outgoing (money left the wallet):  DR category, DR fees(6800), CR wallet(1015)
// Incoming (money into the wallet):   DR wallet(1015), CR category
const postLine = async (req, res) => {
  try {
    const { lineId, categoryAccountId } = req.body;
    if (!lineId || !categoryAccountId) {
      return res.status(400).json({ success: false, message: 'Line and category account are required.' });
    }

    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    const line = session.lines.id(lineId);
    if (!line) return res.status(404).json({ success: false, message: 'Statement line not found.' });
    if (line.matchStatus === 'matched') {
      return res.status(400).json({ success: false, message: 'This line is already reconciled.' });
    }

    const category = await Account.findById(categoryAccountId);
    if (!category) return res.status(404).json({ success: false, message: 'Category account not found.' });

    const wallet = await ensureMomoWallet(Account);
    const feeAcct = await Account.findOne({ code: '6800' });

    const amount = r2(line.amount);
    const fee = r2((line.fee || 0) + (line.eLevy || 0));
    const lines = [];

    if (line.direction === 'out') {
      // money left the wallet
      lines.push({ account: category._id, accountCode: category.code, accountName: category.name, debit: amount, credit: 0, description: line.description || line.type });
      if (fee > 0 && feeAcct) {
        lines.push({ account: feeAcct._id, accountCode: feeAcct.code, accountName: feeAcct.name, debit: fee, credit: 0, description: 'MoMo fee' });
      }
      lines.push({ account: wallet._id, accountCode: wallet.code, accountName: wallet.name, debit: 0, credit: r2(amount + fee), description: 'MoMo wallet' });
    } else {
      // money into the wallet
      lines.push({ account: wallet._id, accountCode: wallet.code, accountName: wallet.name, debit: amount, credit: 0, description: 'MoMo wallet' });
      lines.push({ account: category._id, accountCode: category.code, accountName: category.name, debit: 0, credit: amount, description: line.description || line.type });
      // an incoming transfer rarely carries a fee, but if it does, expense it
      if (fee > 0 && feeAcct) {
        lines.push({ account: feeAcct._id, accountCode: feeAcct.code, accountName: feeAcct.name, debit: fee, credit: 0, description: 'MoMo fee' });
        lines.push({ account: wallet._id, accountCode: wallet.code, accountName: wallet.name, debit: 0, credit: fee, description: 'MoMo fee deducted' });
      }
    }

    const totalDebit = r2(lines.reduce((t, l) => t + l.debit, 0));
    const totalCredit = r2(lines.reduce((t, l) => t + l.credit, 0));

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journal = await JournalEntry.create({
      entryNumber, date: line.date || new Date(), journalType: 'general',
      description: 'MoMo ' + line.type + ' — ' + (line.counterparty || '') + ' (' + session.sessionNumber + ')',
      reference: line.externalId || session.sessionNumber,
      lines, totalDebit, totalCredit,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const jl of lines) {
      const acct = await Account.findById(jl.account);
      if (acct) { acct.balance = r2(acct.balance + calculateBalanceChange(acct.normalBalance, jl.debit, jl.credit)); await acct.save(); }
    }

    line.matchStatus = 'matched';
    line.journalEntry = journal._id;
    await session.save();

    res.json({ success: true, message: 'Posted ' + entryNumber + '.', data: { lineId, journalEntry: journal._id, entryNumber } });
  } catch (error) {
    console.error('[Reconciliation] Post line error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to post: ' + error.message });
  }
};

// Ignore a line (not relevant to the books).
const ignoreLine = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    const line = session.lines.id(req.body.lineId);
    if (!line) return res.status(404).json({ success: false, message: 'Line not found.' });
    if (line.matchStatus === 'matched') return res.status(400).json({ success: false, message: 'Already reconciled.' });
    line.matchStatus = line.matchStatus === 'ignored' ? 'unmatched' : 'ignored';
    await session.save();
    res.json({ success: true, data: { lineId: line._id, matchStatus: line.matchStatus } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update line.' });
  }
};
module.exports = { importStatement, getSessions, getSession, deleteSession, postLine, ignoreLine };
