const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { parseMomoStatement } = require('../utils/momoParser');

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

module.exports = { importStatement, getSessions, getSession, deleteSession };
