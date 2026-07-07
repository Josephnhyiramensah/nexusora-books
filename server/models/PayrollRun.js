const mongoose = require('mongoose');

const payrollRunSchema = new mongoose.Schema({
  payrollNumber: { type: String, required: true, unique: true },
  period: { month: Number, year: Number },
  runDate: Date,
  entries: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    basicSalary: Number, totalAllowances: Number, grossPay: Number,
    paye: Number, employeeSsnit: Number, employerSsnit: Number,
    otherDeductions: Number, netPay: Number,
  }],
  totalGross: Number, totalNet: Number, totalPaye: Number,
  totalEmployeeSsnit: Number, totalEmployerSsnit: Number,
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = payrollRunSchema;