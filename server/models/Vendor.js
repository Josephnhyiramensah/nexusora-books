// server/models/Vendor.js

const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Vendor name is required'], trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    taxId: { type: String, trim: true },
    outstandingBalance: { type: Number, default: 0 },
    payableAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

vendorSchema.index({ name: 1 });
vendorSchema.index({ isActive: 1 });

module.exports = vendorSchema;