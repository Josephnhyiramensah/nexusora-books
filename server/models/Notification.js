const mongoose = require('mongoose');

// Tenant-scoped notification. Lives in each tenant database, exactly like Note.
// Exports a RAW SCHEMA (not a model) because getModel compiles it per tenant
// connection.
const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },

    // platform = broadcast from the Developer Console (no tenant User exists to
    // attribute it to). tenant = sent in-house by an admin.
    source: { type: String, enum: ['platform', 'tenant'], default: 'tenant' },

    // all   = everyone in the workspace
    // roles = only users holding one of `roles`
    // users = only the user ids listed in `users`
    audience: { type: String, enum: ['all', 'roles', 'users'], default: 'all' },
    roles: [String],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByLabel: { type: String, default: 'System' },
    link: { type: String, default: '' },

    // Read state is PER USER, so one person reading does not clear the badge
    // for everyone else.
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],

    expiresAt: { type: Date, default: null },

    // Links every tenant copy of a single console broadcast, so the operator
    // can edit or withdraw it everywhere at once.
    broadcastId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ audience: 1 });
notificationSchema.index({ 'readBy.user': 1 });

module.exports = notificationSchema;
