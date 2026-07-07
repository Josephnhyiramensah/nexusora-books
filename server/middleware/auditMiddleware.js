// server/middleware/auditMiddleware.js
// Auto-logs actions to AuditLog collection

const { getModel } = require('../utils/getModel');

/**
 * Log an action to the audit trail. Called directly from controllers.
 */
const logAudit = async (tenantDb, logData, req = null) => {
  try {
    const AuditLog = getModel(tenantDb, 'AuditLog');

    await AuditLog.create({
      user: logData.userId,
      action: logData.action,
      module: logData.module,
      entityId: logData.entityId,
      entityType: logData.entityType,
      description: logData.description,
      previousData: logData.previousData,
      newData: logData.newData,
      ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
      userAgent: req ? req.headers['user-agent'] : undefined,
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error.message);
  }
};

/**
 * Express middleware factory for auto-logging.
 */
const auditMiddleware = (action, module) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (data && data.success && req.user && req.tenantDb) {
        logAudit(req.tenantDb, {
          userId: req.user._id,
          action,
          module,
          entityId: data.data?._id || req.params?.id,
          entityType: module,
          description: `${action} operation on ${module}`,
        }, req).catch(() => {});
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = { logAudit, auditMiddleware };