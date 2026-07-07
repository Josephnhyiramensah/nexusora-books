const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: String,
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    dueDate: Date,
    completedAt: Date,
    type: {
      type: String,
      enum: ['personal', 'assigned', 'checklist'],
      default: 'personal',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cycleType: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] },
    cycleDate: Date,
    linkedEntity: {
      entityType: String,
      entityId: { type: mongoose.Schema.Types.ObjectId },
    },
    comments: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: { type: Date, default: Date.now },
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

todoSchema.index({ status: 1 });
todoSchema.index({ priority: 1 });
todoSchema.index({ dueDate: 1 });
todoSchema.index({ createdBy: 1 });
todoSchema.index({ assignedTo: 1 });

module.exports = todoSchema;