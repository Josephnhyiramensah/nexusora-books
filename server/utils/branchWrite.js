// server/utils/branchWrite.js
//
// WRITE-TIME branch resolution — the companion to branchScope.js.
//
// branchScope.js decides what a request may READ, and never lets a client widen
// its own access. This module decides the single branch a NEW record is STAMPED
// with, and enforces the "Option B" rule across the whole app: the branch is an
// explicit FIELD on the transaction, chosen on the form — never a silent default
// inherited from the viewing context.
//
// The one rule, applied by every create path (voucher, invoice, bill, journal,
// stock movement, …): when a tenant runs 2+ active branches and the request
// names no branch the caller may write to, the create is REJECTED — never quietly
// filed under Head Office. That closes the UI, the REST API and the PHP gold-app
// integration with one function instead of a rule each controller could forget.
// Single-branch tenants are untouched: the sole branch resolves automatically and
// nothing is asked of the user or an integrator.
//
// The server is the authority. A branch id sent by the client is validated
// against the caller's own access before it is trusted: a user restricted to
// Accra cannot stamp Takoradi by posting its id, exactly as they cannot read it.

const { getModel } = require('./getModel');
const { resolveBranchScope } = require('./branchScope');

// Active branches for the tenant, as lean docs (one query).
async function getActiveBranches(req) {
  const Branch = getModel(req.tenantDb, 'Branch');
  return Branch.find({ isActive: true }).select('_id code name isHeadOffice').lean();
}

// The set of active-branch ids (as strings) this caller may WRITE to.
//   • branchAccess 'all' (or missing) → every active branch.
//   • branchAccess 'specific'         → only granted branches that are also active.
function writableIds(req, activeBranches) {
  const user = (req && req.user) || {};
  const activeIds = activeBranches.map((b) => String(b._id));
  if ((user.branchAccess || 'all') !== 'specific') return new Set(activeIds);
  const granted = new Set((Array.isArray(user.branches) ? user.branches : []).map(String));
  return new Set(activeIds.filter((id) => granted.has(id)));
}

/**
 * Resolve the branch to stamp on a new record, enforcing Option B.
 *
 * @param {object} req            request (carries req.user, req.tenantDb, headers)
 * @param {string|null} requestedId  the branch id the client chose on the form
 *                                    (typically req.body.branch); null/'' if none
 * @returns {Promise<{branch: any} | {error: string, status: number}>}
 *   { branch }        → the resolved branch id to stamp (may be null only for a
 *                       tenant with no branches configured — legacy/pre-branch).
 *   { error, status } → reject the create with this message and HTTP status.
 *
 * Resolution order:
 *   1. An explicit, valid choice wins. A chosen branch the caller may not write
 *      to is refused (403 outside their grant, 400 if inactive/unknown).
 *   2. No choice, but the request is already narrowed to one writable branch (a
 *      single-branch clerk, or a full-access user who picked a branch in the top
 *      bar) → that branch. resolveBranchScope enforces the access rules.
 *   3. No choice and exactly one active branch company-wide → that branch
 *      (single-branch tenant: the field is hidden and nothing need be sent).
 *   4. No choice and 2+ active branches → REJECT. This is the case Option B
 *      exists to catch: an "All branches" create with no branch named.
 */
async function resolveWriteBranch(req, requestedId) {
  const active = await getActiveBranches(req);

  // No branches configured at all — leave unstamped (legacy / pre-branch tenant).
  if (active.length === 0) return { branch: null };

  const writable = writableIds(req, active);

  // A restricted user with no active branch in their grant can write nowhere.
  if (writable.size === 0) {
    return { error: 'You do not have write access to any active branch.', status: 403 };
  }

  const asked = requestedId == null ? '' : String(requestedId).trim();

  // 1. Explicit choice.
  if (asked) {
    const isActive = active.some((b) => String(b._id) === asked);
    if (!isActive) return { error: 'The selected branch was not found or is inactive.', status: 400 };
    if (!writable.has(asked)) return { error: 'You do not have access to the selected branch.', status: 403 };
    return { branch: asked };
  }

  // 2. Request already narrowed to a single writable branch.
  const scope = resolveBranchScope(req);
  if (scope.activeBranch && writable.has(String(scope.activeBranch))) {
    return { branch: scope.activeBranch };
  }

  // 3. Single-branch tenant — resolve it without asking.
  if (active.length === 1) return { branch: active[0]._id };

  // 4. Ambiguous: multiple branches, none chosen. Reject rather than default.
  return {
    error: 'This company has more than one branch. Choose the branch this transaction belongs to.',
    status: 400,
  };
}

module.exports = { getActiveBranches, writableIds, resolveWriteBranch };