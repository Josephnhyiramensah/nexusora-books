// server/controllers/voucherController.js
//
// Vouchers are a professional front-end to the double-entry journal engine.
// Creating a voucher stores a draft; POSTING it generates a balanced
// JournalEntry (validated debits == credits) and links the two, so vouchers
// flow into every report and the audit trail with one source of truth.
//
// MULTI-BRANCH: a voucher is stamped with a branch at CREATE time. When it is
// later POSTED (possibly by a different user), the JournalEntry inherits the
// VOUCHER's branch — never the poster's — so a branch's ledger always matches
// its vouchers. Reads filter through scopedFilter so a branch-scoped user only
// sees their branch; a full-access user (or any request without an X-Branch
// header) sees everything, exactly as before. Branch is pure metadata — it does
// not touch a single debit, credit, or how the entry posts.

const { getModel } = require('../utils/getModel');
const { getSpecialAccount } = require('../utils/specialAccounts');
const { logAudit } = require('../middleware/auditMiddleware');
const { validateDoubleEntry, generateEntryNumber } = require('../utils/accountingHelpers');
const { generateVoucherNumber, journalTypeForVoucher } = require('../utils/voucherHelpers');
const { scopedFilter } = require('../utils/branchScope');
const { resolveWriteBranch } = require('../utils/branchWrite');

// The tenant's Head Office branch id — the safe default so a voucher is never
// left unbranched (single-branch companies always resolve to this).
async function headOfficeId(req) {
  const Branch = getModel(req.tenantDb, 'Branch');
  const ho = await Branch.findOne({ isHeadOffice: true }).select('_id').lean();
  return ho ? ho._id : null;
}



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
    const base = {};
    if (type) base.voucherType = type;
    if (status) base.status = status;
    // Branch scope: no-op for a full-access request (sees all); restricts to the
    // caller's branch(es) when scoped.
    const filter = scopedFilter(req, base);
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
    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }))
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
      lineItems, subtotal, discount, isItemized,
      dueDate, terms, vatEnabled, vatRate,
      // Simple mode:
      debitAccount, creditAccount, amount,
      // Multi-line mode:
      lines: rawLines,
    } = req.body;

    if (!voucherType || !date) {
      return res.status(400).json({ success: false, message: 'Required: voucherType and date.' });
    }

    
    // Option B — the branch is an explicit field on the transaction, and the
    // server is its authority. resolveWriteBranch validates the chosen branch
    // against this user's access and REJECTS an ambiguous create (2+ active
    // branches, none chosen) instead of silently filing under Head Office. One
    // call closes the form, the REST API and the PHP integration together.
    const branchChoice = await resolveWriteBranch(req, req.body.branch);
    if (branchChoice.error) {
      return res.status(branchChoice.status).json({ success: false, message: branchChoice.error });
    }
    const branch = branchChoice.branch;


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

    // ── VAT: rebuild as a 3-line entry when enabled ──
    // Base amount (subtotal after discount) = the amount computed so far MINUS
    // the vat portion. Front end sends vatRate; we compute vat here from the
    // "amount" (which the front end sent as the VAT-INCLUSIVE total for itemized,
    // or the typed amount for simple). To keep it robust we treat the incoming
    // amount as the grand total and derive the net + vat from vatRate.
    let vatAmountComputed = 0;
    if (vatEnabled && Number(vatRate) > 0 && debitAccount && creditAccount) {
      // VAT Payable is resolved by ROLE now, not the literal '2410', so a tenant
      // may renumber their chart and remap it in settings. required:true is the
      // deliberate fix to the old silent failure below: a chart with no VAT
      // account must FAIL the post, never save a voucher whose VAT quietly
      // vanished from the entry. The error is turned into a clear 400 so the
      // admin is told exactly which account to map.
      let vatAcct;
      try {
        vatAcct = await getSpecialAccount(req, 'vatPayable');
      } catch (e) {
        if (e.code === 'SPECIAL_ACCOUNT_NOT_FOUND') {
          return res.status(400).json({ success: false, message: e.message });
        }
        throw e;
      }
      const grand = Number(amount) || 0;
      // grand = net + net*rate  => net = grand / (1 + rate/100)
      const rate = Number(vatRate) / 100;
      const net = Math.round((grand / (1 + rate)) * 100) / 100;
      vatAmountComputed = Math.round((grand - net) * 100) / 100;
        if (vatAmountComputed > 0) {
        // Dr debitAccount grand ; Cr creditAccount net ; Cr VAT Payable vat
        lines = [
          { account: debitAccount, debit: grand, credit: 0, description: narration || '' },
          { account: creditAccount, debit: 0, credit: net, description: narration || '' },
          { account: vatAcct._id, debit: 0, credit: vatAmountComputed, description: 'VAT @ ' + vatRate + '%' },
        ];
      }
      // vatAcct is guaranteed here — a missing VAT account already returned 400
      // above rather than silently posting a 2-line entry with the tax dropped.
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

    // If itemized, compute subtotal from line items and the effective amount
    // (subtotal - discount). This becomes the voucher amount + the posting total.
    let itemizedTotal = null;
    let cleanItems = [];
    if (isItemized && Array.isArray(lineItems) && lineItems.length > 0) {
      cleanItems = lineItems
        .filter((it) => (Number(it.quantity) || 0) > 0 || (Number(it.unitPrice) || 0) > 0 || it.description)
        .map((it) => {
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const amt = Math.round(qty * price * 100) / 100;
          return { description: it.description || '', quantity: qty, unit: it.unit || '', unitPrice: price, amount: amt };
        });
      const sub = cleanItems.reduce((sM, it) => sM + it.amount, 0);
      const disc = Number(discount) || 0;
      itemizedTotal = Math.round((sub - disc) * 100) / 100;
    }

    const voucherNumber = await generateVoucherNumber(Voucher, voucherType);
    const computedAmount = amount != null ? Number(amount) : validation.totalDebit;

    const voucher = await Voucher.create({
      voucherNumber, voucherType, date, narration, reference,
      partyName, customer: customer || undefined, vendor: vendor || undefined,
      mode, bankAccount: bankAccount || undefined, bankName, instrumentNo,
      paymentDetails: paymentDetails || {},
      amount: itemizedTotal != null ? itemizedTotal : computedAmount,
      lineItems: cleanItems,
      subtotal: isItemized ? Math.round(cleanItems.reduce((sM, it) => sM + it.amount, 0) * 100) / 100 : 0,
      discount: Number(discount) || 0,
      isItemized: !!isItemized,
      dueDate: dueDate || undefined, terms: terms || '',
      vatEnabled: !!vatEnabled, vatRate: Number(vatRate) || 0, vatAmount: vatAmountComputed,
      lines: enriched,
      totalDebit: validation.totalDebit, totalCredit: validation.totalCredit,
      status: 'draft', createdBy: req.user._id,
      branch,
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

    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }));
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

    // The journal inherits the VOUCHER's branch (not the poster's), falling back
    // to Head Office only for a legacy draft created before branches existed.
    const branch = voucher.branch || await headOfficeId(req);

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
      branch,
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

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} posted. Journal ${entryNumber} created.`, data:voucher });
  } catch (error) {
    console.error('[Vouchers] Post error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to post voucher.' });
  }
};

// ─── Reverse ─────────────────────────────────────────────────────────────────
// Reverses the linked JournalEntry by creating an opposite entry, and marks the
// voucher reversed. Mirrors the journal reversal pattern (never silent-edits a
// posted entry). The reversing entry keeps the same branch as the original.
const reverseVoucher = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }));
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
      branch: voucher.branch || original.branch || await headOfficeId(req),
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
    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }));
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

// Link an already-uploaded document (from /upload/document) to a voucher.
const addAttachment = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    const { url, publicId, filename, resourceType } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'No document url provided.' });
    voucher.attachments.push({ url, publicId, filename, resourceType, uploadedBy: req.user._id, uploadedAt: new Date() });
    await voucher.save();
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: 'Attached document "' + (filename || 'document') + '" to voucher ' + voucher.voucherNumber,
    }, req);
    res.json({ success: true, message: 'Document attached.', data: voucher.attachments });
  } catch (error) {
    console.error('[Vouchers] addAttachment error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to attach document.' });
  }
};

// Remove an attachment from a voucher (by attachment _id).
const removeAttachment = async (req, res) => {
  try {
    const Voucher = getModel(req.tenantDb, 'Voucher');
    const voucher = await Voucher.findOne(scopedFilter(req, { _id: req.params.id }));
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found.' });
    const before = voucher.attachments.length;
    voucher.attachments = voucher.attachments.filter((a) => String(a._id) !== String(req.params.attachmentId));
    if (voucher.attachments.length === before) return res.status(404).json({ success: false, message: 'Attachment not found.' });
    await voucher.save();
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'journals',
      entityId: voucher._id, entityType: 'Voucher',
      description: 'Removed a document from voucher ' + voucher.voucherNumber,
    }, req);
    res.json({ success: true, message: 'Attachment removed.', data: voucher.attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove attachment.' });
  }
};

module.exports = {
  getVouchers, getVoucher, createVoucher, postVoucher, reverseVoucher, deleteVoucher,
  addAttachment, removeAttachment };