const mongoose = require('mongoose');

const payrollRunSchema = new mongoose.Schema({
  payrollNumber: { type: String, required: true, unique: true },
  period: { month: Number, year: Number },
  runDate: Date,
  entries: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: String,
    basicSalary: Number, totalAllowances: Number, grossPay: Number,
    employeeSsnit: Number, employerSsnit: Number,
    providentFund: Number,
    deductionBeforeTax: Number,
    taxableIncome: Number,
    paye: Number,
    loanDeduction: Number,
    totalDeduction: Number,
    otherDeductions: Number, netPay: Number,
  }],
  totalGross: Number, totalNet: Number, totalPaye: Number,
  totalEmployeeSsnit: Number, totalEmployerSsnit: Number,
  totalProvidentFund: Number, totalLoanDeduction: Number, totalDeduction: Number,
  // Snapshot of the PAYE schedule this run used, so a historical sheet always
  // reprints with the rates that produced it. Top band stored as null.
  payeBands: [{ upTo: Number, rate: Number }],
  payeBandsLabel: String,
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = payrollRunSchema;
