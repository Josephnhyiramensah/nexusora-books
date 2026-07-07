// server/config/tenantResolver.js
// Extracts subdomain from request hostname and resolves to tenant record

const Tenant = require('../models/Tenant');

/**
 * Extract the subdomain from the request hostname.
 * Production: kgr.nexusorabooks.com → 'kgr'
 * Development: kgr.localhost → 'kgr'
 * Fallback: ?tenant=kgr or X-Tenant-ID header
 */
const extractSubdomain = (req) => {
  const hostname = req.hostname || req.headers.host?.split(':')[0] || '';

  // Development: kgr.localhost
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      return parts[0].toLowerCase();
    }
  }

  // Production: kgr.nexusorabooks.com
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'api') {
    return parts[0].toLowerCase();
  }

  // Fallback: query parameter (?tenant=kgr)
  if (req.query && req.query.tenant) {
    return req.query.tenant.toLowerCase();
  }

  // Fallback: X-Tenant-ID header (for API testing tools)
  const tenantHeader = req.headers['x-tenant-id'];
  if (tenantHeader) {
    return tenantHeader.toLowerCase();
  }

  return null;
};

/**
 * Look up tenant record by subdomain in master database.
 */
const resolveTenant = async (subdomain) => {
  if (!subdomain) return null;

  try {
    const tenant = await Tenant.findOne({
      subdomain,
      status: { $in: ['active', 'founding'] },
    });
    return tenant;
  } catch (error) {
    console.error(`[Tenant] Resolve error for "${subdomain}": ${error.message}`);
    return null;
  }
};

module.exports = { extractSubdomain, resolveTenant };