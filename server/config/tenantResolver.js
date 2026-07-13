
const Tenant = require('../models/Tenant');

const IS_PROD = process.env.NODE_ENV === 'production';


const RESERVED = ['www', 'api', 'admin', 'app', 'mail', 'static', 'assets'];


const extractSubdomain = (req) => {
  const hostname = (req.hostname || req.headers.host?.split(':')[0] || '').toLowerCase();

  // Bare IP address — never a tenant.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return IS_PROD ? null : devFallback(req);
  }

  // Development: kgr.localhost
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[0] !== 'localhost' && !RESERVED.includes(parts[0])) {
      return parts[0];
    }
  }

  // Production: kgr.nexusorabooks.com → 'kgr'
  // Apex (nexusorabooks.com) has only 2 parts → falls through → null.
  const parts = hostname.split('.');
  if (parts.length >= 3 && !RESERVED.includes(parts[0])) {
    return parts[0];
  }

  return IS_PROD ? null : devFallback(req);
};

/**
 * Development-only fallbacks. Compiled out of the production path above.
 */
const devFallback = (req) => {
  if (req.query && req.query.tenant) {
    return String(req.query.tenant).toLowerCase();
  }
  const tenantHeader = req.headers['x-tenant-id'];
  if (tenantHeader) {
    return String(tenantHeader).toLowerCase();
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