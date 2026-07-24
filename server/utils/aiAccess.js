// server/utils/aiAccess.js
// Single source of truth for what an AI session may see.
//
// Replaces the old hardcoded ladder in aiController (viewer:0 ... super_admin:4)
// which never consulted req.user.permissions -- so a viewer explicitly granted
// reports.view was still refused. Access now resolves through the same
// PERMISSIONS catalogue the route guards use.
const { PERMISSIONS } = require('../config/permissions');

// Role implications + explicit grants. Grants are additive and never subtract.
function effectivePermissions(user) {
  const role = user && user.role;
  const grants = Array.isArray(user && user.permissions) ? user.permissions : [];
  const set = new Set(grants);
  PERMISSIONS.forEach((p) => {
    if (Array.isArray(p.impliedBy) && p.impliedBy.includes(role)) set.add(p.key);
  });
  return set;
}

function can(user, key) {
  return effectivePermissions(user).has(key);
}

module.exports = { effectivePermissions, can };
