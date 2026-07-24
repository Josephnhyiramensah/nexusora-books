const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: String,
  phone: String,
  position: String,
  department: String,
  hireDate: Date,
  basicSalary: { type: Number, required: true },
  allowances: [{ name: String, amount: Number }],
  // Tier-3 provident fund: flat cedi amount OR percent of basic.
  providentFund: {
    mode: { type: String, enum: ['none', 'fixed', 'percent'], default: 'none' },
    value: { type: Number, default: 0 },
  },
  // Staff loan recovered monthly; stops on its own at zero balance.
  loan: {
    balance: { type: Number, default: 0 },
    deductPerMonth: { type: Number, default: 0 },
  },
  ssnitNumber: String,
  taxId: String,
  bankName: String,
  bankAccountNumber: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = employeeSchema;
