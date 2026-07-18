const { getModel } = require('../utils/getModel');

const getAuditLogs = async (req, res) => {
  try {
    const AuditLog = getModel(req.tenantDb, 'AuditLog');
    const { module, action, startDate, endDate, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(filter);

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Enrich with user names from User model.
    // NOTE: the actor is stored on the log as `user` (an ObjectId ref), NOT
    // `userId`. Reading the wrong key here is what made every row render as
    // "System" in the UI — the lookup always missed and returned user: null.
    const User = getModel(req.tenantDb, 'User');
    const enriched = await Promise.all(logs.map(async (log) => {
      try {
        // log.user is the stored ObjectId; resolve it to a name object. We
        // overwrite the same `user` key because that is what the frontend reads.
        if (log.user) {
          const u = await User.findById(log.user).select('firstName lastName email role').lean();
          return { ...log, user: u || null };
        }
        return { ...log, user: null };
      } catch { return { ...log, user: null }; }
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('[Audit] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

const getAuditStats = async (req, res) => {
  try {
    const AuditLog = getModel(req.tenantDb, 'AuditLog');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalLogs, recentLogs, byModule, byAction] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      AuditLog.aggregate([{ $group: { _id: '$module', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);

    res.json({
      success: true,
      data: { totalLogs, recentLogs, byModule, byAction },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit stats.' });
  }
};
const deleteAuditLog = async (req, res) => {
  try {
    const AuditLog = getModel(req.tenantDb, 'AuditLog');
    await AuditLog.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Audit log entry deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete audit log entry.' });
  }
};

const clearAuditLogs = async (req, res) => {
  try {
    const AuditLog = getModel(req.tenantDb, 'AuditLog');
    const { before } = req.body; // optional: delete logs before a certain date
    const filter = before ? { createdAt: { $lt: new Date(before) } } : {};
    const result = await AuditLog.deleteMany(filter);
    res.json({ success: true, message: `${result.deletedCount} audit log entries deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear audit logs.' });
  }
};
module.exports = { getAuditLogs, getAuditStats, deleteAuditLog, clearAuditLogs };