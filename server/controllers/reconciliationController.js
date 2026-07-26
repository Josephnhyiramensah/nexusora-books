const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { parseStatement } = require('../utils/momoParser');
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
      parsed = await parseStatement(buffer, fileName);
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

// Suggestion engine — the "Auto" action. Runs over every UNMATCHED line and,
// for each, returns a suggestion WITHOUT posting anything. Two passes:
//   1. reconcile: is there already a posted journal for this exact transaction?
//      (same amount, date within +/-3 days, referencing this externalId or
//       touching the MoMo wallet) -> suggest 'match'.
//   2. categorise: has this counterparty been posted before? -> suggest that
//      same account, learned from history.
// The user reviews and approves; nothing reaches the ledger here.
const autoMatch = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    const wallet = await Account.findOne({ code: '1015' });
    const walletId = wallet ? String(wallet._id) : null;

    // Pull recent posted journals once, to search in memory (small datasets).
    const journals = await JournalEntry.find({ status: 'posted' })
      .sort({ date: -1 }).limit(1000).lean();

    // Build a counterparty -> category-account history map from prior MoMo posts.
    // A MoMo post always credits/debits the wallet plus a category line; the
    // category is the non-wallet, non-fee line. Key by the externalId's stored
    // reference is not enough, so we learn from description text + amount.
    const DAY = 24 * 60 * 60 * 1000;
    const within3 = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 3 * DAY;

    // history: counterparty number/name -> { accountId, accountCode, accountName, count }
    const history = {};
    for (const j of journals) {
      if (!j.reference) continue;
      // MoMo posts use reference = externalId; find the category line
      const cat = (j.lines || []).find((l) => l.accountCode !== '1015' && l.accountCode !== '6800');
      if (!cat) continue;
      // learn keyed on the journal description (which contains the counterparty)
      const key = (j.description || '').toLowerCase();
      if (!key) continue;
      history[key] = history[key] || {};
    }

    const suggestions = session.lines
      .filter((l) => l.matchStatus === 'unmatched')
      .map((l) => {
        const amt = r2(l.amount);
        const fee = r2((l.fee || 0) + (l.eLevy || 0));
        const gross = l.direction === 'out' ? r2(amt + fee) : amt;

        // --- pass 1: already recorded? ---
        let matchEntry = null;
        for (const j of journals) {
          if (l.externalId && j.reference === l.externalId) { matchEntry = j; break; }
        }
        if (!matchEntry && walletId) {
          matchEntry = journals.find((j) => within3(j.date, l.date)
            && (j.lines || []).some((ln) => String(ln.account) === walletId
              && (Math.abs((ln.debit || 0) - gross) < 0.01 || Math.abs((ln.credit || 0) - gross) < 0.01)));
        }
        if (matchEntry) {
          return { lineId: l._id, kind: 'match', entryId: matchEntry._id,
            entryNumber: matchEntry.entryNumber,
            note: 'Already recorded as ' + matchEntry.entryNumber };
        }

        // --- pass 2: suggest an account from history of this counterparty ---
        let suggestAcct = null;
        if (l.counterparty) {
          const cpKey = l.counterparty.toLowerCase();
          const prior = journals.find((j) => (j.description || '').toLowerCase().includes(cpKey)
            && j.reference !== l.externalId);
          if (prior) {
            const cat = (prior.lines || []).find((ln) => ln.accountCode !== '1015' && ln.accountCode !== '6800');
            if (cat) suggestAcct = { accountId: cat.account, accountCode: cat.accountCode, accountName: cat.accountName };
          }
        }

        return {
          lineId: l._id, kind: suggestAcct ? 'suggest' : 'none',
          suggestedAccount: suggestAcct,
          note: suggestAcct
            ? 'You posted ' + l.counterparty + ' to ' + suggestAcct.accountCode + ' before'
            : 'No history — choose an account',
        };
      });

    res.json({
      success: true,
      data: {
        suggestions,
        summary: {
          total: suggestions.length,
          matches: suggestions.filter((x) => x.kind === 'match').length,
          suggested: suggestions.filter((x) => x.kind === 'suggest').length,
          manual: suggestions.filter((x) => x.kind === 'none').length,
        },
      },
    });
  } catch (error) {
    console.error('[Reconciliation] Auto-match error:', error.message);
    res.status(500).json({ success: false, message: 'Auto-match failed: ' + error.message });
  }
};

// Post an approved batch. Each item is { lineId, categoryAccountId } — matches
// are confirmed separately via confirmMatch. Reuses postLine's ledger logic by
// looping; a failure on one line does not roll back the others already posted,
// so we report per-line results.
const postBatch = async (req, res) => {
  try {
    const { items } = req.body;   // [{ lineId, categoryAccountId }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No lines to post.' });
    }
    const results = { posted: 0, failed: 0, errors: [] };
    for (const it of items) {
      req.body.lineId = it.lineId;
      req.body.categoryAccountId = it.categoryAccountId;
      // call postLine's core by faking res capture
      const fakeRes = { _s: 200, status(c){ this._s = c; return this; }, json(p){ this._p = p; } };
      await postLine(req, fakeRes);
      if (fakeRes._p && fakeRes._p.success) results.posted += 1;
      else { results.failed += 1; results.errors.push({ lineId: it.lineId, message: fakeRes._p ? fakeRes._p.message : 'unknown' }); }
    }
    res.json({ success: true, message: 'Posted ' + results.posted + ' of ' + items.length + '.', data: results });
  } catch (error) {
    console.error('[Reconciliation] Batch post error:', error.message);
    res.status(500).json({ success: false, message: 'Batch post failed.' });
  }
};

// Confirm a 'match' suggestion — link the line to the existing journal without
// creating a new one (it's already in the books).
const confirmMatch = async (req, res) => {
  try {
    const { lineId, entryId } = req.body;
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    const line = session.lines.id(lineId);
    if (!line) return res.status(404).json({ success: false, message: 'Line not found.' });
    line.matchStatus = 'matched';
    line.matchedEntry = entryId || null;
    await session.save();
    res.json({ success: true, data: { lineId, matchStatus: 'matched' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to confirm match.' });
  }
};

// Verify and (optionally) close a session. This is the reconciliation PROOF:
// once every line is posted/matched/ignored, the Mobile Money Wallet ledger
// balance should reflect the posted transactions, and the statement's own
// opening->closing movement should equal in - out - fees. We surface all three
// figures so a difference is explained, not just flagged red.
const reconcileSession = async (req, res) => {
  try {
    const Session = getModel(req.tenantDb, 'ReconciliationSession');
    const Account = getModel(req.tenantDb, 'Account');

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

    const lines = session.lines || [];
    const unmatched = lines.filter((l) => l.matchStatus === 'unmatched').length;
    const matched = lines.filter((l) => l.matchStatus === 'matched').length;
    const ignored = lines.filter((l) => l.matchStatus === 'ignored').length;

    // Movement the statement itself reports.
    const statementMovement = r2((session.closingBalance || 0) - (session.openingBalance || 0));
    // Movement implied by the transactions we parsed.
    const parsedMovement = r2((session.totalIn || 0) - (session.totalOut || 0) - (session.totalFees || 0));
    // Does the statement's own maths hold? (Should always, since the parser
    // reconciled every line — this is a sanity check on the import.)
    const statementConsistent = Math.abs(statementMovement - parsedMovement) < 0.01;

    // The live ledger wallet balance.
    const wallet = await Account.findOne({ code: '1015' });
    const ledgerWalletBalance = wallet ? r2(wallet.balance) : 0;

    // Only the POSTED lines (not matched-to-existing, not ignored) moved the
    // wallet via our journals. Sum their net effect.
    const postedMovement = r2(lines
      .filter((l) => l.matchStatus === 'matched' && l.journalEntry)
      .reduce((sum, l) => {
        const gross = l.direction === 'in' ? (l.amount || 0) : -((l.amount || 0) + (l.fee || 0) + (l.eLevy || 0));
        return sum + gross;
      }, 0));

    const allHandled = unmatched === 0;
    const ties = statementConsistent; // the parse-level proof

    // If the caller asked to finalise and everything is handled, mark reconciled.
    let finalised = false;
    if (req.body.finalise && allHandled) {
      session.status = 'reconciled';
      session.reconciledBy = req.user._id;
      await session.save();
      finalised = true;
      await logAudit(req.tenantDb, {
        userId: req.user._id, action: 'reconcile_bank', module: 'banking',
        entityId: session._id, entityType: 'ReconciliationSession',
        description: 'Reconciled ' + session.sessionNumber + ' — ' + matched + ' posted/matched, ' + ignored + ' ignored',
      }, req);
    }

    res.json({
      success: true,
      data: {
        sessionNumber: session.sessionNumber,
        status: session.status,
        finalised,
        counts: { total: lines.length, matched, ignored, unmatched },
        openingBalance: r2(session.openingBalance),
        closingBalance: r2(session.closingBalance),
        statementMovement,
        parsedMovement,
        statementConsistent,
        postedMovement,
        ledgerWalletBalance,
        allHandled,
        ties,
        // difference between the statement's declared movement and what we posted
        postedVsStatement: r2(postedMovement - statementMovement),
      },
    });
  } catch (error) {
    console.error('[Reconciliation] Reconcile error:', error.message);
    res.status(500).json({ success: false, message: 'Reconcile failed: ' + error.message });
  }
};
module.exports = { importStatement, getSessions, getSession, deleteSession, postLine, ignoreLine, autoMatch, postBatch, confirmMatch, reconcileSession };
