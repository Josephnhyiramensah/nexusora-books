// server/models/Customer.js

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Customer name is required'], trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    taxId: { type: String, trim: true },
    creditLimit: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    receivableAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ isActive: 1 });

module.exports = customerSchema;