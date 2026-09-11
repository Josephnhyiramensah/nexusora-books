// server/controllers/voucherController.js
//
// Vouchers are a professional front-end to the double-entry journal engine.
// Creating a voucher stores a draft; POSTING it generates a balanced
// JournalEntry (validated debits == credits) and links the two, so vouchers
// flow into every report and the audit trail with one source of truth.

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { validateDoubleEntry, generateEntryNumber } = require('../utils/accountingHelpers');
const { generateVoucherNumber, journalTypeForVoucher } = require('../utils/voucherHelpers');

// Build the 2-line "simple" voucher lines from a single debit + credit account.
function simpleLines({ debitAccount, creditAccount, amount, narration }) {
  return [
    { account: debitAccount,  debit: Number(amount), credit: 0, description: narration || '' },
    { account: creditAccount, debit: 0, credit: Number(amount), description: narration || '' },
  ];
}

// Enrich lines with account code/name and confirm each account is valid+active.
async function enrichLines(Account, lines) {
  const enriched = [];
  for (const line of lines) {
    const account = await Account.findById(line.account);
    if (!account) return { error: `Account ID "${line.account}" not found.` };
    if (!account.isActive) return { error: `Account "${account.code} — ${account.name}" is inactive.` };
    enriched.push({ ...line, accountCode: account.code, accountName: account.name });
  }
  return { enriched };
}

// ─── List ────────────────────────────────────────────────────────────────────
const getVouchers = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const { type, status, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (type) filter.voucherType = type;
    if (status) filter.status = status;
    const vouchers = await Voucher.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: vouchers, count: vouchers.length, page: Number(page) });
  } catch (error) {
    console.error('[Vouchers] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch vouchers.' });
  }
};

// ─── Get one ─────────────────────────────────────────────────────────────────
const getVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const voucher = await Voucher.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('vendor', 'name email phone')
      .populate('journalEntry')
      .lean();
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    res.json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch voucher.' });
  }
};

// ─── Create (draft) ──────────────────────────────────────────────────────────
const createVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const Account = getModel(req.tenantDb, 'Account');
    const {
      voucherType, date, narration, reference, partyName, customer, vendor,
      mode, bankAccount, bankName, instrumentNo, paymentDetails,
      // Simple mode:
      debitAccount, creditAccount, amount,
      // Multi-line mode:
      lines: rawLines,
    } = req.body;

    if (!voucherType || !date) {
      return res.status(400).json({ success: false, message: 'Required: voucherType and date.' });
    }

    // Resolve lines: either provided multi-line, or built from simple fields.
    let lines;
    if (Array.isArray(rawLines) && rawLines.length >= 2) {
      lines = rawLines;
    } else if (debitAccount && creditAccount && amount) {
      lines = simpleLines({ debitAccount, creditAccount, amount, narration });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide either 2+ lines, or debitAccount + creditAccount + amount.',
      });
    }

    // Validate balance (debits == credits) up front.
    const validation = validateDoubleEntry(lines);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error,
        data: { totalDebit: validation.totalDebit, totalCredit: validation.totalCredit } });
    }

    // Enrich + validate accounts.
    const { enriched, error } = await enrichLines(Account, lines);
    if (error) return res.status(400).json({ success: false, message: error });

    const voucherNumber = await generateVoucherNumber(Voucher, voucherType);
    const computedAmount = amount != null ? Number(amount) : validation.totalDebit;

    const voucher = await Voucher.create({
      voucherNumber, voucherType, date, narration, reference,
      partyName, customer: customer || undefined, vendor: vendor || undefined,
      mode, bankAccount: bankAccount || undefined, bankName, instrumentNo,
      paymentDetails: paymentDetails || {},
      amount: computedAmount,
      lines: enriched,
      totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
      status: 'draft', createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: `Created draft ${voucherType} voucher: ${voucherNumber}`,
      newData: { voucherNumber, voucherType, amount: computedAmount },
    }, req);

    res.status(201).json({ success: true, message: `Voucher ${voucherNumber} created as draft.`, data: voucher });
  } catch (error) {
    console.error('[Vouchers] Create error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate voucher (already imported).' });
    }
    res.status(500).json({ success: false, message: 'Failed to create voucher.' });
  }
};

// ─── Post (generates the JournalEntry) ───────────────────────────────────────
const postVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    if (voucher.status === 'posted') {
      return res.status(400).json({ success: false, message: 'Voucher is already posted.' });
    }
    if (voucher.status === 'reversed') {
      return res.status(400).json({ success: false, message: 'Voucher has been reversed.' });
    }

    // Re-validate the stored lines before posting.
    const validation = validateDoubleEntry(voucher.lines);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    // Generate the balanced JournalEntry through the existing engine.
    const entryNumber = await generateEntryNumber(JournalEntry);
    const entry = await JournalEntry.create({
      entryNumber,
      date: voucher.date,
      journalType: journalTypeForVoucher(voucher.voucherType),
      description: voucher.narration || `${voucher.voucherType} voucher ${voucher.voucherNumber}`,
      reference: voucher.voucherNumber,
      lines: voucher.lines,
      totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
      status: 'posted', createdBy: req.user._id,
    });

    voucher.status = 'posted';
    voucher.journalEntry = entry._id;
    await voucher.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'post_journal', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: `Posted ${voucher.voucherType} voucher ${voucher.voucherNumber} → Journal ${entryNumber}`,
      newData: { voucherNumber: voucher.voucherNumber, entryNumber, amount: voucher.amount },
    }, req);

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} posted. Journal ${entryNumber} created.`, data: voucher });
  } catch (error) {
    console.error('[Vouchers] Post error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to post voucher.' });
  }
};

// ─── Reverse ─────────────────────────────────────────────────────────────────
// Reverses the linked JournalEntry by creating an opposite entry, and marks the
// voucher reversed. Mirrors the journal reversal pattern (never silent-edits a
// posted entry).
const reverseVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    if (voucher.status !== 'posted') {
      return res.status(400).json({ success: false, message: 'Only a posted voucher can be reversed.' });
    }

    const original = await JournalEntry.findById(voucher.journalEntry);
    if (!original) return res.status(400).json({ success: false, message: 'Linked journal entry not found.' });

    const reversedLines = original.lines.map((l) => ({
      account: l.account, accountCode: l.accountCode, accountName: l.accountName,
      debit: l.credit, credit: l.debit, description: `Reversal: ${l.description || ''}`.trim(),
    }));
    const entryNumber = await generateEntryNumber(JournalEntry);
    const reversal = await JournalEntry.create({
      entryNumber, date: new Date(), journalType: original.journalType,
      description: `Reversal of voucher ${voucher.voucherNumber} (${original.entryNumber})`,
      reference: voucher.voucherNumber, lines: reversedLines,
      totalDebit: original.totalCredit, totalCredit: original.totalDebit,
      status: 'posted', createdBy: req.user._id,
    });

    voucher.status = 'reversed';
    await voucher.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'reverse_journal', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: `Reversed voucher ${voucher.voucherNumber} → ${entryNumber}`,
    }, req);

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} reversed. Entry ${entryNumber} posted.`, data: voucher });
  } catch (error) {
    console.error('[Vouchers] Reverse error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to reverse voucher.' });
  }
};

// ─── Delete (draft only) ─────────────────────────────────────────────────────
const deleteVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    if (voucher.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft vouchers can be deleted. Post-and-reverse to cancel a posted voucher.' });
    }
    await Voucher.findByIdAndDelete(voucher._id);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: `Deleted draft voucher ${voucher.voucherNumber}`,
    }, req);
    res.json({ success: true, message: `Draft voucher ${voucher.voucherNumber} deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete voucher.' });
  }
};

module.exports = {
  getVouchers, getVoucher, createVoucher, postVoucher, reverseVoucher, deleteVoucher,
};
