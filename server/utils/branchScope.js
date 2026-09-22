// server/utils/branchScope.js
//
// The ONE place branch access is decided and applied. Every branch-aware read
// filters through scopedFilter(); every branch-aware create stamps through
// stampBranch(). Keeping the rule in one function is the whole safety strategy —
// no individual controller can forget it or get it subtly wrong.
//
// The server is the sole authority on what a user may see. A client may ask to
// narrow to one branch (via the X-Branch header) but can NEVER widen beyond what
// their branchAccess allows. A user restricted to Accra cannot see Takoradi no
// matter what header they send.
//
// Backward-compatible by design: a user with branchAccess 'all' (or missing —
// e.g. an old session minted before the field existed) gets the consolidated,
// unfiltered view, which is exactly today's behaviour. So dropping this into a
// controller that passes no header changes nothing until branches are actually
// used.

const HEADER = 'x-branch'; // Express lower-cases header names on req.headers

// Read the requested branch id from the request header, if any. Returns a
// trimmed string or null. (We do not trust it yet — resolveBranchScope decides
// whether it is allowed.)
function requestedBranch(req) {
  const raw = req && req.headers ? req.headers[HEADER] : null;
  if (raw == null) return null;
  const s = String(Array.isArray(raw) ? raw[0] : raw).trim();
  return s.length ? s : null;
}

// Normalise a user's granted branch list to an array of strings for comparison.
function grantedIds(user) {
  const list = user && Array.isArray(user.branches) ? user.branches : [];
  return list.map((b) => String(b));
}

/**
 * Decide the effective branch scope for this request.
 *
 * @returns {{ mode: 'all' | 'list', branchIds: string[], activeBranch: string|null }}
 *   mode 'all'  → no branch filter (consolidated / whole company).
 *   mode 'list' → restrict to branchIds (one or more). activeBranch is the single
 *                 branch to STAMP new records with when creating (the narrowed-to
 *                 branch, or the sole granted branch).
 *
 * Rules:
 *   • branchAccess 'all' (or missing):
 *       - valid X-Branch header  → { mode:'list', branchIds:[that], activeBranch:that }
 *       - no header              → { mode:'all',  branchIds:[],      activeBranch:null }
 *   • branchAccess 'specific':
 *       - forced to the user's granted branches.
 *       - X-Branch may only NARROW within the grant. A header outside the grant
 *         is ignored (never widens). No header → the full granted list.
 *       - activeBranch = the narrowed branch, else the sole granted branch, else
 *         null (can't stamp unambiguously when several are granted and none chosen).
 */
function resolveBranchScope(req) {
  const user = (req && req.user) || {};
  const access = user.branchAccess || 'all'; // missing => 'all' (backward compatible)
  const asked = requestedBranch(req);

  if (access !== 'specific') {
    // Full-access user (head office). May narrow to one branch on request.
    if (asked) return { mode: 'list', branchIds: [asked], activeBranch: asked };
    return { mode: 'all', branchIds: [], activeBranch: null };
  }

  // Restricted user: server forces the granted set.
  const granted = grantedIds(user);
  if (granted.length === 0) {
    // Restricted but granted nothing — see nothing, and cannot stamp.
    return { mode: 'list', branchIds: [], activeBranch: null };
  }

  // A header may only narrow to a branch the user actually holds.
  if (asked && granted.includes(asked)) {
    return { mode: 'list', branchIds: [asked], activeBranch: asked };
  }

  // No (valid) narrowing → their full granted list. Stamp only if unambiguous.
  return {
    mode: 'list',
    branchIds: granted,
    activeBranch: granted.length === 1 ? granted[0] : null,
  };
}

/**
 * Merge the branch condition into a Mongoose filter. Pass your normal query as
 * `extra`; get back the same query, branch-scoped when appropriate.
 *
 *   const filter = scopedFilter(req, { status: 'posted' });
 *   const rows   = await Voucher.find(filter);
 *
 * mode 'all' → returns `extra` unchanged (no branch clause = consolidated).
 * mode 'list'→ adds { branch: { $in: branchIds } }.
 */
function scopedFilter(req, extra = {}) {
  const scope = resolveBranchScope(req);
  if (scope.mode === 'all') return { ...extra };
  return { ...extra, branch: { $in: scope.branchIds } };
}

/**
 * Stamp the active branch onto a new document before saving. Returns the same
 * doc for chaining. If the scope can't name a single branch (a full-access user
 * with no header, or a multi-branch user who didn't narrow), the doc is left
 * unstamped — the caller decides the default (typically the tenant's Head
 * Office) in a later slice; today nothing calls this yet.
 */
function stampBranch(req, doc) {
  const scope = resolveBranchScope(req);
  if (doc && scope.activeBranch) doc.branch = scope.activeBranch;
  return doc;
}

module.exports = { resolveBranchScope, scopedFilter, stampBranch, requestedBranch, HEADER };