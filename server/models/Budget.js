const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fiscalYear: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'approved', 'active', 'closed'], default: 'draft' },
  lines: [{
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    accountCode: String, accountName: String,
    monthlyAmounts: {
      jan: Number, feb: Number, mar: Number, apr: Number,
      may: Number, jun: Number, jul: Number, aug: Number,
      sep: Number, oct: Number, nov: Number, dec: Number,
    },
    annualTotal: Number,
  }],
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = budgetSchema;