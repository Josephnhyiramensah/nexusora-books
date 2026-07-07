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
  ssnitNumber: String,
  taxId: String,
  bankName: String,
  bankAccountNumber: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = employeeSchema;