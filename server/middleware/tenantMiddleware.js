// server/middleware/tenantMiddleware.js
// Runs on EVERY request (except master-level admin routes)
// Extracts subdomain → looks up tenant → attaches DB connection to req.tenantDb

const { extractSubdomain, resolveTenant } = require('../config/tenantResolver');
const { getTenantConnection } = require('../config/db');

const tenantMiddleware = async (req, res, next) => {
  try {
    const subdomain = extractSubdomain(req);

    if (!subdomain) {
      return res.status(400).json({
        success: false,
        message: 'No tenant identified. Access via your company subdomain (e.g., kgr.nexusorabooks.com) or pass ?tenant=kgr',
      });
    }

    const tenant = await resolveTenant(subdomain);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: `Tenant "${subdomain}" not found or is not active.`,
      });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact support.',
      });
    }

    if (tenant.status === 'archived') {
      return res.status(403).json({
        success: false,
        message: 'This account has been archived.',
      });
    }

    const tenantDb = await getTenantConnection(tenant.databaseName);

    req.tenantDb = tenantDb;
    req.tenant = {
      id: tenant._id,
      subdomain: tenant.subdomain,
      companyName: tenant.companyName,
      databaseName: tenant.databaseName,
      plan: tenant.plan,
      settings: tenant.settings,
    };

    next();
  } catch (error) {
    console.error('[TenantMiddleware] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve tenant. Please try again.',
    });
  }
};

module.exports = tenantMiddleware;