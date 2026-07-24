const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const VALID_TYPES = ['info', 'success', 'warning', 'danger'];
const VALID_ROLES = ['super_admin', 'admin', 'accountant', 'staff', 'viewer'];

// A user may see a notification only if it has not expired AND it is addressed
// to everyone, to their role, or to them by id. Enforced in the QUERY, never in
// the response mapping, so a recipient can never be handed a document they were
// not addressed in.
const visibleTo = (user) => ({
  $and: [
    { $or: [
      { expiresAt: null },
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ] },
    { $or: [
      { audience: 'all' },
      { audience: 'roles', roles: user.role },
      { audience: 'users', users: user._id },
    ] },
  ],
});

const getNotifications = async (req, res) => {
  try {
    const Notification = getModel(req.tenantDb, 'Notification');
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const docs = await Notification.find(visibleTo(req.user))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const uid = req.user._id.toString();
    const data = docs.map((d) => ({
      _id: d._id,
      title: d.title,
      message: d.message,
      type: d.type,
      source: d.source,
      link: d.link || '',
      createdByLabel: d.createdByLabel || 'System',
      createdAt: d.createdAt,
      read: (d.readBy || []).some((r) => r.user && r.user.toString() === uid),
    }));

    // serverNow lets the client measure ages against OUR clock. A device with a
    // wrong timezone would otherwise show a fresh notification as hours old.
    res.json({ success: true, data, count: data.length, unread: data.filter((d) => !d.read).length, serverNow: Date.now() });
  } catch (error) {
    console.error('[Notifications] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const Notification = getModel(req.tenantDb, 'Notification');
    const count = await Notification.countDocuments({
      $and: [visibleTo(req.user), { 'readBy.user': { $ne: req.user._id } }],
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('[Notifications] Count error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to count notifications.' });
  }
};

const createNotification = async (req, res) => {
  try {
    const {
      title, message, type = 'info', audience = 'all',
      roles = [], users = [], link = '', expiresAt = null,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
    if (!['all', 'roles', 'users'].includes(audience)) {
      return res.status(400).json({ success: false, message: 'Invalid audience.' });
    }
    if (audience === 'roles') {
      const bad = (roles || []).filter((r) => !VALID_ROLES.includes(r));
      if (!roles.length || bad.length) {
        return res.status(400).json({ success: false, message: 'Select at least one valid role.' });
      }
    }
    if (audience === 'users' && !(users || []).length) {
      return res.status(400).json({ success: false, message: 'Select at least one recipient.' });
    }

    const Notification = getModel(req.tenantDb, 'Notification');
    const doc = await Notification.create({
      title: String(title).trim(),
      message: String(message).trim(),
      type: VALID_TYPES.includes(type) ? type : 'info',
      source: 'tenant',
      audience,
      roles: audience === 'roles' ? roles : [],
      users: audience === 'users' ? users : [],
      link: link || '',
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
      createdByLabel: req.user.fullName || req.user.email,
    });

    const who = audience === 'all'
      ? 'all staff'
      : audience === 'roles' ? roles.join(', ') : users.length + ' user(s)';

    await logAudit(req.tenantDb, {
      userId: req.user._id,
      action: 'create',
      module: 'settings',
      entityId: doc._id,
      entityType: 'Notification',
      description: 'Notification sent to ' + who + ': ' + doc.title,
    }, req);

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('[Notifications] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send notification.' });
  }
};

const markRead = async (req, res) => {
  try {
    const Notification = getModel(req.tenantDb, 'Notification');
    await Notification.updateOne(
      { $and: [visibleTo(req.user), { _id: req.params.id, 'readBy.user': { $ne: req.user._id } }] },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Mark read error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to mark as read.' });
  }
};

const markAllRead = async (req, res) => {
  try {
    const Notification = getModel(req.tenantDb, 'Notification');
    await Notification.updateMany(
      { $and: [visibleTo(req.user), { 'readBy.user': { $ne: req.user._id } }] },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Mark all read error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const Notification = getModel(req.tenantDb, 'Notification');
    const doc = await Notification.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Notification not found.' });

    // A tenant admin must not be able to erase a platform announcement from
    // their own workspace.
    if (doc.source === 'platform') {
      return res.status(403).json({ success: false, message: 'Platform announcements cannot be deleted here.' });
    }

    await doc.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
};

module.exports = {
  getNotifications, getUnreadCount, createNotification,
  markRead, markAllRead, deleteNotification,
};
