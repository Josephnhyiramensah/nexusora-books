// server/controllers/ledgerController.js
//
// Per-person subsidiary ledgers (one dynamic ledger per party). These are the
// Account documents flagged isSubLedger, provisioned automatically from the
// external integration and keyed by externalPartyId.
//
// A party ledger is debit-normal: a positive (debit) balance means the party
// owes us (receivable); a negative (credit) balance means we owe the party
// (payable). The list below splits parties into Receivables / Payables by that
// sign, and the statement reproduces the running-balance view the accountant
// described — time (date/entry/mode) shows on the row, the table leads with the
// running balance.
'use strict';

const { getModel } = require('../utils/getModel');
const { scopedFilter } = require('../utils/branchScope');
const { ledgerMovement, acctSignedBalance } = require('./reportController');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * GET /api/ledgers/parties
 * List every party ledger with its current signed balance and side.
 * Branch scope (X-Branch) applies, same as the reports.
 */
const getPartyLedgers = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const { q } = req.query;
    const ledgers = await Account.find({ isSubLedger: true }).sort({ name: 1 }).lean();

    // One movement map (branch-scoped); null = consolidated all-time → stored balance.
    const movement = await ledgerMovement(req, JournalEntry);

    let parties = ledgers.map((a) => {
      const balance = acctSignedBalance(a, movement); // signed on the debit side
      return {
        id: String(a._id),
        externalPartyId: a.externalPartyId || null,
        code: a.code,
        name: a.name,
        control: a.parentCode || null,
        balance,                                   // + = receivable, − = payable
        side: balance >= 0 ? 'receivable' : 'payable',
        isActive: a.isActive !== false,
      };
    });

    // Optional search over "id — name" (matches the select format in the UI).
    if (q && String(q).trim()) {
      const needle = String(q).trim().toLowerCase();
      parties = parties.filter((p) =>
        (p.name || '').toLowerCase().includes(needle) ||
        (p.externalPartyId || '').toLowerCase().includes(needle) ||
        (p.code || '').toLowerCase().includes(needle));
    }

    const receivableTotal = round2(parties.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0));
    const payableTotal = round2(parties.filter((p) => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0));

    res.json({
      success: true,
      data: {
        parties,
        summary: {
          count: parties.length,
          receivableTotal,
          payableTotal,
          net: round2(receivableTotal - payableTotal),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Ledgers] party list error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load party ledgers.' });
  }
};

/**
 * GET /api/ledgers/parties/:id/statement?startDate=&endDate=
 * Running-balance statement of account for one party ledger. Honours branch
 * scope and an optional date range (an opening balance carries in the range).
 */
const getPartyStatement = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Voucher = getModel(req.tenantDb, 'Voucher');

    const acct = await Account.findById(req.params.id).lean();
    if (!acct || !acct.isSubLedger) {
      return res.status(404).json({ success: false, message: 'Party ledger not found.' });
    }

    const { startDate, endDate } = req.query;
    const acctId = String(acct._id);

    // Opening balance: all posted movement for this account BEFORE the range
    // start (branch-scoped), signed on the debit side.
    let openingBalance = 0;
    if (startDate) {
      const openFilter = scopedFilter(req, { status: 'posted', date: { $lt: new Date(startDate) } });
      const prior = await JournalEntry.find(openFilter).lean();
      for (const e of prior) {
        for (const l of (e.lines || [])) {
          if (String(l.account) === acctId) openingBalance += (l.debit || 0) - (l.credit || 0);
        }
      }
    }
    openingBalance = round2(openingBalance);

    // In-range (or all-time) entries for this account, oldest first.
    const base = { status: 'posted' };
    if (startDate && endDate) base.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    else if (startDate) base.date = { $gte: new Date(startDate) };
    else if (endDate) base.date = { $lte: new Date(endDate) };
    const entries = await JournalEntry.find(scopedFilter(req, base)).sort({ date: 1, createdAt: 1 }).lean();

    // Enrich with voucher mode / type via the journal reference (= voucherNumber).
    const refs = [...new Set(entries.map((e) => e.reference).filter(Boolean))];
    const vouchers = refs.length
      ? await Voucher.find({ voucherNumber: { $in: refs } }).select('voucherNumber mode voucherType partyName externalId').lean()
      : [];
    const vByNumber = new Map(vouchers.map((v) => [v.voucherNumber, v]));

    let running = openingBalance;
    const rows = [];
    for (const e of entries) {
      for (const l of (e.lines || [])) {
        if (String(l.account) !== acctId) continue;
        const debit = round2(l.debit || 0);
        const credit = round2(l.credit || 0);
        running = round2(running + debit - credit); // debit-normal ledger
        const v = vByNumber.get(e.reference) || {};
        rows.push({
          date: e.date,                       // full timestamp — UI shows time only on drill-down
          entryNumber: e.entryNumber,
          reference: e.reference || '',       // voucher number (the "id" on the row)
          description: e.description || l.description || '',
          mode: v.mode || '',
          voucherType: v.voucherType || '',
          debit,
          credit,
          balance: running,                   // running balance (signed, debit-normal)
        });
      }
    }

    const closingBalance = round2(running);
    res.json({
      success: true,
      data: {
        party: {
          id: acctId,
          externalPartyId: acct.externalPartyId || null,
          code: acct.code,
          name: acct.name,
          control: acct.parentCode || null,
          openingBalance,
          closingBalance,
          side: closingBalance >= 0 ? 'receivable' : 'payable',
        },
        period: startDate && endDate ? { startDate, endDate } : 'All time',
        rows,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Ledgers] statement error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate the statement of account.' });
  }
};

module.exports = { getPartyLedgers, getPartyStatement };
