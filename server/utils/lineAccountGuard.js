// server/utils/lineAccountGuard.js
//
// Guards the ACCOUNT TYPE on a document's lines.
//
// The forms already restrict the dropdowns — an invoice line offers revenue
// accounts, a bill line offers expense / cost-of-sales / asset accounts. But that
// is only the UI. The REST API validated nothing, so anything posting directly
// (Postman, a script, the PHP gold-app integration) could put a sales line on an
// expense account. It balances, it posts, nothing complains — and the P&L is
// quietly wrong, with revenue understated and expenses overstated by the same
// amount. That is exactly the class of error that survives to an audit.
//
// So the rule the form implies is enforced here too, where it actually binds.
// This checks TYPE only. It deliberately does NOT reject inactive accounts: that
// would change behaviour for documents that post fine today, and is a separate
// decision rather than something to slip in with a validation fix.

const { getModel } = require('./getModel');

// Which account types each document's lines may use, and how to say it in an
// error a user can act on. Mirrors the client-side dropdown filters:
//   InvoiceFormPage -> revenue
//   BillFormPage    -> expense, cogs, asset
const RULES = Object.freeze({
  invoice: {
    types: ['revenue'],
    expected: 'a revenue account',
    hint: 'Sales lines must post to revenue. Pick a revenue account for this line.',
  },
  bill: {
    // 'asset' is allowed because a bill can buy stock or a fixed asset, and under
    // perpetual inventory item lines are redirected to Inventory (an asset) at
    // posting time.
    types: ['expense', 'cogs', 'asset'],
    expected: 'an expense, cost-of-sales or asset account',
    hint: 'Purchase lines must post to an expense, cost-of-sales or asset account.',
  },
});

// Turn a raw type into something readable in an error message.
function describeType(type) {
  const map = {
    asset: 'an asset account',
    liability: 'a liability account',
    equity: 'an equity account',
    revenue: 'a revenue account',
    cogs: 'a cost-of-sales account',
    expense: 'an expense account',
  };
  return map[type] || `a ${type} account`;
}

/**
 * Check that every line's account is of a type the document allows.
 *
 * Lines with no account are skipped — the controller's default-account logic
 * handles those, and the defaults are the right type by definition.
 *
 * @param {object} req      the request (carries req.tenantDb)
 * @param {Array}  lines    processed lines, each possibly carrying `account`
 * @param {string} docType  'invoice' | 'bill'
 * @returns {Promise<{error: string}|null>} an error to return as 400, or null when valid
 */
async function checkLineAccountTypes(req, lines, docType) {
  const rule = RULES[docType];
  if (!rule) return null;                       // unknown document type — nothing to enforce
  if (!Array.isArray(lines) || lines.length === 0) return null;

  // Collect the distinct account ids actually used, so this is ONE query no
  // matter how many lines the document has.
  const ids = [...new Set(
    lines.map((l) => (l && l.account ? String(l.account) : null)).filter(Boolean),
  )];
  if (ids.length === 0) return null;

  const Account = getModel(req.tenantDb, 'Account');
  let accounts;
  try {
    accounts = await Account.find({ _id: { $in: ids } }).select('_id code name type').lean();
  } catch (e) {
    // A malformed id throws on cast. Treat that as a bad request rather than a
    // 500, and name it so the caller can fix their payload.
    return { error: 'One or more line accounts are not valid account ids.' };
  }

  const byId = {};
  accounts.forEach((a) => { byId[String(a._id)] = a; });

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.account) continue;       // no account chosen — default applies
    const acct = byId[String(line.account)];

    if (!acct) {
      return { error: `Line ${i + 1}: the selected account no longer exists.` };
    }
    if (!rule.types.includes(acct.type)) {
      return {
        error: `Line ${i + 1} ("${line.description || acct.name}") uses ${acct.code} — ${acct.name}, `
          + `which is ${describeType(acct.type)}. This document needs ${rule.expected}. ${rule.hint}`,
      };
    }
  }

  return null;
}

module.exports = { checkLineAccountTypes, RULES };