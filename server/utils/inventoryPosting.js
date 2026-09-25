// server/utils/inventoryPosting.js
//
// PERPETUAL inventory — the general-ledger side of stock. Completely INERT while
// a tenant is on the default 'periodic' method, so books behave exactly as they
// always have unless an admin deliberately switches.
//
// The two accounting methods, in short:
//   PERIODIC (default) — buying stock is an expense immediately (Dr Purchases,
//     Cr AP, which is what billController already does). Stock value is reported
//     from the movement ledger but never posted. Nothing here runs.
//   PERPETUAL — buying stock is an ASSET (Dr Inventory 1200), and the cost only
//     becomes an expense when the stock is SOLD (Dr COGS 5010, Cr Inventory 1200).
//     This matches QuickBooks/Xero behaviour when inventory tracking is enabled.
//
// The double-count trap this avoids: if bills still expensed purchases AND stock
// also debited Inventory, the same money would be counted twice. So under
// perpetual, billController redirects item-bearing lines to Inventory instead of
// an expense account (see inventoryAccountForBillLine), and the expense arrives
// later via the sale posting here.

const { getModel } = require('./getModel');

// Account codes used by perpetual posting. Kept in one place so a different
// chart (if the auditor prefers other codes) is a single edit.
const ACCOUNTS = {
  INVENTORY: '1200',          // asset — stock on hand
  COGS: '5010',               // expense — cost of goods actually sold
  COGS_FALLBACK: '5000',      // if 5010 isn't in the chart yet, fall back to Purchases
};

/**
 * Is this tenant on perpetual inventory? Default (and any missing value) = periodic.
 * req.tenant carries the tenant doc with its settings.
 */
function isPerpetual(req) {
  return !!(req && req.tenant && req.tenant.settings && req.tenant.settings.inventoryMethod === 'perpetual');
}

/**
 * Under PERPETUAL, an item-bearing bill line debits INVENTORY instead of the
 * line's expense account — the purchase is an asset, not yet an expense.
 * Under PERIODIC this returns null and the caller keeps its existing behaviour.
 *
 * Usage in billController, at the line-account resolution point:
 *   const invAcct = await inventoryAccountForBillLine(req, line);
 *   const expenseAcct = invAcct || (line.account ? await Account.findById(line.account) : fallback);
 */
async function inventoryAccountForBillLine(req, line) {
  if (!isPerpetual(req)) return null;      // periodic → unchanged behaviour
  if (!line || !line.item) return null;     // non-stock line → unchanged
  const Account = getModel(req.tenantDb, 'Account');
  return Account.findOne({ code: ACCOUNTS.INVENTORY });
}

/**
 * Post the COST side of a sale under PERPETUAL: Dr COGS, Cr Inventory, for the
 * cost of the stock that left. Called after an invoice's stock movements are
 * created (so the costs are known). No-op under periodic.
 *
 * Idempotent: the movements it posts against are marked glPosted, so a second
 * call posts nothing.
 *
 * @returns { posted: bool, amount, entryNumber } or { posted: false, reason }
 */
async function postSaleCost(req, invoice) {
  if (!isPerpetual(req)) return { posted: false, reason: 'periodic' };

  const StockMovement = getModel(req.tenantDb, 'StockMovement');
  const Account = getModel(req.tenantDb, 'Account');
  const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

  // The sale movements this invoice created that haven't been posted to the GL.
  const moves = await StockMovement.find({
    sourceInvoice: invoice._id, type: 'sale', glPosted: false,
  }).lean();
  if (moves.length === 0) return { posted: false, reason: 'nothing to post' };

  // Total cost of goods that left. totalCost was computed at movement time from
  // the weighted average, so this is the true cost of what was sold.
  const totalCost = Math.round(moves.reduce((s, m) => s + (Number(m.totalCost) || 0), 0) * 100) / 100;
  if (totalCost <= 0) return { posted: false, reason: 'zero cost' };

  const inventoryAcct = await Account.findOne({ code: ACCOUNTS.INVENTORY });
  let cogsAcct = await Account.findOne({ code: ACCOUNTS.COGS });
  if (!cogsAcct) cogsAcct = await Account.findOne({ code: ACCOUNTS.COGS_FALLBACK });
  if (!inventoryAcct || !cogsAcct) {
    return { posted: false, reason: `missing account (${ACCOUNTS.INVENTORY}/${ACCOUNTS.COGS})` };
  }

  const lines = [
    {
      account: cogsAcct._id, accountCode: cogsAcct.code, accountName: cogsAcct.name,
      debit: totalCost, credit: 0, description: `Cost of goods sold — ${invoice.invoiceNumber}`,
    },
    {
      account: inventoryAcct._id, accountCode: inventoryAcct.code, accountName: inventoryAcct.name,
      debit: 0, credit: totalCost, description: `Stock issued — ${invoice.invoiceNumber}`,
    },
  ];

  // Reuse the system entry numbering.
  // eslint-disable-next-line global-require
  const { generateEntryNumber, calculateBalanceChange } = require('./accountingHelpers');
  const entryNumber = await generateEntryNumber(JournalEntry);

  const entry = await JournalEntry.create({
    entryNumber,
    date: invoice.date || new Date(),
    journalType: 'sales',
    description: `Cost of goods sold for invoice ${invoice.invoiceNumber}`,
    reference: invoice.invoiceNumber,
    lines,
    totalDebit: totalCost,
    totalCredit: totalCost,
    status: 'posted',
    postedBy: req.user._id,
    postedAt: new Date(),
    createdBy: req.user._id,
    branch: invoice.branch || null,
  });

  // Move the account balances, same as any posted entry.
  for (const l of lines) {
    // eslint-disable-next-line no-await-in-loop
    const acct = await Account.findById(l.account);
    if (acct) {
      const change = calculateBalanceChange(acct.normalBalance, l.debit, l.credit);
      acct.balance = Math.round((acct.balance + change) * 100) / 100;
      // eslint-disable-next-line no-await-in-loop
      await acct.save();
    }
  }

  // Mark the movements posted so this can never double-post.
  await StockMovement.updateMany(
    { _id: { $in: moves.map((m) => m._id) } },
    { $set: { glPosted: true, glJournalEntry: entry._id } }
  );

  return { posted: true, amount: totalCost, entryNumber };
}

module.exports = { isPerpetual, inventoryAccountForBillLine, postSaleCost, ACCOUNTS };