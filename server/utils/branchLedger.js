// server/utils/branchLedger.js
//
// Shared branch-aware balance logic, used by every READ surface (reports,
// dashboard, tax, ai) so they all compute per-branch figures the same, tested way.
//
// The rule, everywhere:
//   • Consolidated (no X-Branch header / full-access user) and no date range:
//       use the stored account.balance — fast, and unchanged from before branches.
//   • Branch-scoped (X-Branch header, or a branch-restricted user), OR a date
//       range is requested: compute each account's balance from that scope's
//       POSTED journal lines.
// Because stored balance === full ledger tally, consolidated figures are
// identical either way; the branch path is purely additive.

const { resolveBranchScope, scopedFilter } = require('./branchScope');

/**
 * Build a per-account signed-movement map (debit - credit) from posted journal
 * lines, honouring branch scope and an optional date filter.
 *
 * @returns a map keyed by account-id string, OR null when the request is
 *   consolidated AND undated — meaning the caller should read stored balances.
 */
async function ledgerMovement(req, JournalEntry, { dateFilter } = {}) {
  const scope = resolveBranchScope(req);
  const branchScoped = scope.mode !== 'all';

  // Consolidated + no date range → signal "use the stored balance" (fast path).
  if (!branchScoped && !dateFilter) return null;

  const filter = scopedFilter(req, { status: 'posted', ...(dateFilter || {}) });
  const entries = await JournalEntry.find(filter).lean();
  const movement = {};
  for (const entry of entries) {
    for (const line of (entry.lines || [])) {
      const id = String(line.account);
      movement[id] = (movement[id] || 0) + ((line.debit || 0) - (line.credit || 0));
    }
  }
  return movement;
}

/**
 * The signed balance for one account: from the movement map when present
 * (branch-scoped or dated), else the stored balance. Signed by the account's
 * normal side, so a branch/period figure is directly comparable to consolidated.
 */
function acctSignedBalance(acct, movement) {
  if (movement) {
    const raw = movement[String(acct._id)] || 0;
    const signed = acct.normalBalance === 'debit' ? raw : -raw;
    return Math.round(signed * 100) / 100;
  }
  return acct.balance || 0;
}

/**
 * Convenience: the absolute (unsigned) balance, matching how most statements
 * present figures. |signed|.
 */
function acctAbsBalance(acct, movement) {
  return Math.round(Math.abs(acctSignedBalance(acct, movement)) * 100) / 100;
}

module.exports = { ledgerMovement, acctSignedBalance, acctAbsBalance };