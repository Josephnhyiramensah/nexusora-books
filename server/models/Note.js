const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    content: { type: String, required: [true, 'Content is required'] },
    type: {
      type: String,
      enum: ['personal', 'company', 'announcement'],
      default: 'personal',
    },
    isPinned: { type: Boolean, default: false },
    tags: [String],
    visibleToRoles: [String],
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],
    scheduledDate: Date,
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

noteSchema.index({ type: 1 });
noteSchema.index({ createdBy: 1 });
noteSchema.index({ isPinned: -1, createdAt: -1 });

module.exports = noteSchema;