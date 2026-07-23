// server/utils/errorTracker.js
// In-memory per-tenant error tracker for the operator console. Records a rolling
// count and the most recent error per tenant since the last restart. Kept
// deliberately small and dependency-free; resets on restart (acceptable for a
// live-ops dashboard — persistence can be added later if history is needed).

const MAX_TENANTS = 200;      // safety cap so a runaway can't grow unbounded
const tenantErrors = new Map(); // subdomain -> { count, lastMessage, lastAt, lastPath }

function recordError(subdomain, message, path) {
  const key = subdomain || 'unknown';
  const existing = tenantErrors.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastMessage = message;
    existing.lastAt = new Date().toISOString();
    existing.lastPath = path;
  } else {
    if (tenantErrors.size >= MAX_TENANTS) {
      // Drop the oldest entry to stay bounded.
      const oldest = tenantErrors.keys().next().value;
      if (oldest) tenantErrors.delete(oldest);
    }
    tenantErrors.set(key, {
      count: 1,
      lastMessage: message,
      lastAt: new Date().toISOString(),
      lastPath: path,
    });
  }
}

function getErrorSummary() {
  const tenants = Array.from(tenantErrors.entries())
    .map(([subdomain, v]) => ({ subdomain, ...v }))
    .sort((a, b) => b.count - a.count);
  const totalErrors = tenants.reduce((s, t) => s + t.count, 0);
  return { totalErrors, tenantsWithErrors: tenants.length, tenants: tenants.slice(0, 25) };
}

function clearErrors() {
  tenantErrors.clear();
}

module.exports = { recordError, getErrorSummary, clearErrors };