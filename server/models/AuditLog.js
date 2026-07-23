// server/models/AuditLog.js
// Collection: auditlogs (per-tenant database)
// IMMUTABLE — insert only, no update or delete operations allowed

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorLabel: { type: String },
    action: {
      type: String,
      enum: [
        'create', 'read', 'update', 'delete',
        'login', 'logout',
        'post_journal', 'reverse_journal',
        'approve_bill', 'approve_payroll',
        'reconcile_bank', 'export_report',
      ],
      required: true,
    },
    module: {
      type: String,
      enum: [
        'auth', 'accounts', 'journals', 'invoices', 'bills', 'payments',
        'customers', 'vendors', 'inventory', 'fixed_assets', 'payroll',
        'bank', 'budget', 'tax', 'reports', 'notes', 'todos', 'settings',
      ],
      required: true,
    },
    entityId: mongoose.Schema.Types.ObjectId,
    entityType: String,
    description: String,
    previousData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

module.exports = auditLogSchema;