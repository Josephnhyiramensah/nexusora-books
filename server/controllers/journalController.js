// server/controllers/journalController.js

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const {
  validateDoubleEntry, generateEntryNumber, calculateBalanceChange,
} = require('../utils/accountingHelpers');

const getJournals = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.journalType) filter.journalType = req.query.journalType;
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      JournalEntry.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      JournalEntry.countDocuments(filter),
    ]);

    res.json({
      success: true, data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Journals] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch journal entries.' });
  }
};

const getJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const entry = await JournalEntry.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('postedBy', 'firstName lastName email');
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch journal entry.' });
  }
};

const createJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Account = getModel(req.tenantDb, 'Account');
    const { date, journalType, description, reference, lines } = req.body;

    if (!date || !journalType || !lines || lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Required: date, journalType, and at least 2 journal lines.',
      });
    }

    const validation = validateDoubleEntry(lines);
    if (!validation.valid) {
      return res.status(400).json({
        success: false, message: validation.error,
        data: { totalDebit: validation.totalDebit, totalCredit: validation.totalCredit },
      });
    }

    const enrichedLines = [];
    for (const line of lines) {
      const account = await Account.findById(line.account);
      if (!account) {
        return res.status(400).json({ success: false, message: `Account ID "${line.account}" not found.` });
      }
      if (!account.isActive) {
        return res.status(400).json({ success: false, message: `Account "${account.code} — ${account.name}" is inactive.` });
      }
      enrichedLines.push({
        ...line, accountCode: account.code, accountName: account.name,
      });
    }

    const entryNumber = await generateEntryNumber(JournalEntry);

    const entry = await JournalEntry.create({
      entryNumber, date, journalType, description, reference,
      lines: enrichedLines,
      totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
      status: 'draft', createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'journals',
      entityId: entry._id, entityType: 'JournalEntry',
      description: `Created draft journal entry: ${entryNumber}`,
      newData: { entryNumber, journalType, totalDebit: validation.totalDebit },
    }, req);

    res.status(201).json({ success: true, message: `Journal entry ${entryNumber} created as draft.`, data: entry });
  } catch (error) {
    console.error('[Journals] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create journal entry.' });
  }
};

const updateJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Account = getModel(req.tenantDb, 'Account');
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    if (entry.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot edit a ${entry.status} journal entry. Only drafts can be modified.` });
    }

    const previousData = entry.toObject();
    const { date, journalType, description, reference, lines } = req.body;

    if (lines && lines.length >= 2) {
      const validation = validateDoubleEntry(lines);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.error });
      }
      const enrichedLines = [];
      for (const line of lines) {
        const account = await Account.findById(line.account);
        if (!account) return res.status(400).json({ success: false, message: `Account ID "${line.account}" not found.` });
        enrichedLines.push({ ...line, accountCode: account.code, accountName: account.name });
      }
      entry.lines = enrichedLines;
      entry.totalDebit = validation.totalDebit;
      entry.totalCredit = validation.totalCredit;
    }

    if (date) entry.date = date;
    if (journalType) entry.journalType = journalType;
    if (description !== undefined) entry.description = description;
    if (reference !== undefined) entry.reference = reference;
    await entry.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'journals',
      entityId: entry._id, entityType: 'JournalEntry',
      description: `Updated draft journal entry: ${entry.entryNumber}`,
      previousData, newData: entry.toObject(),
    }, req);

    res.json({ success: true, message: 'Journal entry updated.', data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update journal entry.' });
  }
};

const postJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Account = getModel(req.tenantDb, 'Account');
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    if (entry.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot post a ${entry.status} entry. Only drafts can be posted.` });
    }

    const validation = validateDoubleEntry(entry.lines);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: `Cannot post: ${validation.error}` });
    }

    for (const line of entry.lines) {
      const account = await Account.findById(line.account);
      if (!account) {
        return res.status(400).json({ success: false, message: `Account ${line.accountCode} no longer exists. Cannot post.` });
      }
      const balanceChange = calculateBalanceChange(account.normalBalance, line.debit, line.credit);
      account.balance = Math.round((account.balance + balanceChange) * 100) / 100;
      await account.save();
    }

    entry.status = 'posted';
    entry.postedBy = req.user._id;
    entry.postedAt = new Date();
    await entry.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'post_journal', module: 'journals',
      entityId: entry._id, entityType: 'JournalEntry',
      description: `Posted journal entry: ${entry.entryNumber} (Debit: ${entry.totalDebit}, Credit: ${entry.totalCredit})`,
    }, req);

    res.json({ success: true, message: `Journal entry ${entry.entryNumber} posted successfully.`, data: entry });
  } catch (error) {
    console.error('[Journals] Post error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to post journal entry.' });
  }
};

const reverseJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Account = getModel(req.tenantDb, 'Account');
    const original = await JournalEntry.findById(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    if (original.status !== 'posted') {
      return res.status(400).json({ success: false, message: 'Only posted entries can be reversed.' });
    }

    const reversedLines = original.lines.map((line) => ({
      account: line.account, accountCode: line.accountCode, accountName: line.accountName,
      debit: line.credit, credit: line.debit,
      description: `Reversal: ${line.description || ''}`.trim(),
    }));

    const entryNumber = await generateEntryNumber(JournalEntry);

    const reversalEntry = await JournalEntry.create({
      entryNumber, date: new Date(), journalType: original.journalType,
      description: `Reversal of ${original.entryNumber}: ${original.description || ''}`.trim(),
      reference: original.entryNumber, lines: reversedLines,
      totalDebit: original.totalCredit, totalCredit: original.totalDebit,
      status: 'posted', reversalOf: original._id,
      postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const line of reversedLines) {
      const account = await Account.findById(line.account);
      if (account) {
        const balanceChange = calculateBalanceChange(account.normalBalance, line.debit, line.credit);
        account.balance = Math.round((account.balance + balanceChange) * 100) / 100;
        await account.save();
      }
    }

    original.status = 'reversed';
    await original.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'reverse_journal', module: 'journals',
      entityId: original._id, entityType: 'JournalEntry',
      description: `Reversed journal entry ${original.entryNumber} → ${entryNumber}`,
    }, req);

    res.status(201).json({
      success: true,
      message: `Journal entry ${original.entryNumber} reversed. New entry: ${entryNumber}`,
      data: { original, reversal: reversalEntry },
    });
  } catch (error) {
    console.error('[Journals] Reverse error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reverse journal entry.' });
  }
};

const deleteJournal = async (req, res) => {
  try {
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    if (entry.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Cannot delete a ${entry.status} entry. Only drafts can be deleted.` });
    }

    await JournalEntry.findByIdAndDelete(req.params.id);

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'journals',
      entityId: entry._id, entityType: 'JournalEntry',
      description: `Deleted draft journal entry: ${entry.entryNumber}`,
    }, req);

    res.json({ success: true, message: `Draft entry ${entry.entryNumber} deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete journal entry.' });
  }
};

module.exports = {
  getJournals, getJournal, createJournal, updateJournal,
  postJournal, reverseJournal, deleteJournal,
};