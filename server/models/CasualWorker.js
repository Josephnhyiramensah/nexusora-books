const mongoose = require('mongoose');

// A casual/day worker. Deliberately NOT an Employee: no SSNIT, no PAYE, no
// monthly run — they are paid per day worked on an ad-hoc sheet.
const casualWorkerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  phone: String,
  idNumber: String,
  defaultRate: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

casualWorkerSchema.index({ name: 1 });

module.exports = casualWorkerSchema;
