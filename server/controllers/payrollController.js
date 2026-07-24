const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

// GRA 2026 PAYE Tax Bands (monthly)
const PAYE_BANDS = [
  { upTo: 490, rate: 0 },
  { upTo: 600, rate: 0.05 },
  { upTo: 730, rate: 0.10 },
  { upTo: 3896.67, rate: 0.175 },
  { upTo: 20000, rate: 0.25 },
  { upTo: 50000, rate: 0.30 },
  { upTo: Infinity, rate: 0.35 },
];

function calculatePAYE(taxableIncome) {
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const band of PAYE_BANDS) {
    const bandWidth = band.upTo - prevLimit;
    const taxable = Math.min(remaining, bandWidth);
    tax += taxable * band.rate;
    remaining -= taxable;
    prevLimit = band.upTo;
    if (remaining <= 0) break;
  }
  return Math.round(tax * 100) / 100;
}

// Employee CRUD
const getEmployees = async (req, res) => {
  try {
    const Employee = getModel(req.tenantDb, 'Employee');
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const employees = await Employee.find(filter).sort({ employeeId: 1 }).lean();
    res.json({ success: true, data: employees, count: employees.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch employees.' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const Employee = getModel(req.tenantDb, 'Employee');
    const { firstName, lastName, email, phone, position, department, hireDate, basicSalary, allowances, ssnitNumber, taxId, bankName, bankAccountNumber, providentFund, loan } = req.body;

    if (!firstName || !lastName || !basicSalary) {
      return res.status(400).json({ success: false, message: 'Required: firstName, lastName, basicSalary.' });
    }

    const count = await Employee.countDocuments({});
    const employeeId = `EMP-${(count + 1).toString().padStart(3, '0')}`;

    const employee = await Employee.create({
      employeeId, firstName, lastName, email, phone, position, department,
      hireDate, basicSalary: Number(basicSalary),
      allowances: allowances || [], ssnitNumber, taxId,
      providentFund: providentFund || { mode: 'none', value: 0 },
      loan: loan || { balance: 0, deductPerMonth: 0 },
      bankName, bankAccountNumber, createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: `Employee ${employeeId} created.`, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create employee.' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const Employee = getModel(req.tenantDb, 'Employee');
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const fields = ['firstName', 'lastName', 'email', 'phone', 'position', 'department', 'basicSalary', 'allowances', 'ssnitNumber', 'taxId', 'bankName', 'bankAccountNumber', 'providentFund', 'loan'];
    fields.forEach((f) => { if (req.body[f] !== undefined) employee[f] = req.body[f]; });
    await employee.save();

    res.json({ success: true, message: 'Employee updated.', data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update employee.' });
  }
};

// Payroll Run
const runPayroll = async (req, res) => {
  try {
    const Employee = getModel(req.tenantDb, 'Employee');
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');

    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Required: month, year.' });

    // Check for existing payroll
    const existing = await PayrollRun.findOne({ 'period.month': month, 'period.year': year });
    if (existing) return res.status(409).json({ success: false, message: `Payroll for ${month}/${year} already exists.` });

    const employees = await Employee.find({ isActive: true }).lean();
    if (employees.length === 0) return res.status(400).json({ success: false, message: 'No active employees.' });

    const r2 = (n) => Math.round(n * 100) / 100;

    const entries = employees.map((emp) => {
      const totalAllowances = (emp.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
      const grossPay = r2(emp.basicSalary + totalAllowances);
      const employeeSsnit = r2(emp.basicSalary * 0.055);
      const employerSsnit = r2(emp.basicSalary * 0.13);

      const pf = emp.providentFund || {};
      const providentFund = pf.mode === 'fixed' ? r2(pf.value || 0)
        : pf.mode === 'percent' ? r2(emp.basicSalary * ((pf.value || 0) / 100)) : 0;

      // SSNIT and provident fund both come off BEFORE tax.
      const deductionBeforeTax = r2(employeeSsnit + providentFund);
      const taxableIncome = r2(grossPay - deductionBeforeTax);
      const paye = calculatePAYE(taxableIncome);

      // Never recover more loan than is still outstanding.
      const loan = emp.loan || {};
      const loanDeduction = r2(Math.min(loan.deductPerMonth || 0, loan.balance || 0));

      const totalDeduction = r2(paye + loanDeduction);
      const netPay = r2(taxableIncome - totalDeduction);

      return {
        employee: emp._id,
        employeeName: (emp.firstName || '') + ' ' + (emp.lastName || ''),
        basicSalary: emp.basicSalary,
        totalAllowances, grossPay, employeeSsnit, employerSsnit,
        providentFund, deductionBeforeTax, taxableIncome, paye,
        loanDeduction, totalDeduction,
        otherDeductions: 0, netPay,
      };
    });

    const totalGross = Math.round(entries.reduce((s, e) => s + e.grossPay, 0) * 100) / 100;
    const totalNet = Math.round(entries.reduce((s, e) => s + e.netPay, 0) * 100) / 100;
    const totalPaye = Math.round(entries.reduce((s, e) => s + e.paye, 0) * 100) / 100;
    const totalEmployeeSsnit = Math.round(entries.reduce((s, e) => s + e.employeeSsnit, 0) * 100) / 100;
    const totalEmployerSsnit = Math.round(entries.reduce((s, e) => s + e.employerSsnit, 0) * 100) / 100;
    const totalProvidentFund = r2(entries.reduce((s, e) => s + e.providentFund, 0));
    const totalLoanDeduction = r2(entries.reduce((s, e) => s + e.loanDeduction, 0));
    const totalDeduction = r2(entries.reduce((s, e) => s + e.totalDeduction, 0));

    const payrollNumber = `PR-${year}-${String(month).padStart(2, '0')}`;

    const payroll = await PayrollRun.create({
      payrollNumber, period: { month: Number(month), year: Number(year) },
      runDate: new Date(), entries,
      totalGross, totalNet, totalPaye, totalEmployeeSsnit, totalEmployerSsnit,
      totalProvidentFund, totalLoanDeduction, totalDeduction,
      payeBands: PAYE_BANDS.map((b) => ({ upTo: Number.isFinite(b.upTo) ? b.upTo : null, rate: b.rate })),
      payeBandsLabel: 'GRA 2026 monthly bands',
      status: 'draft', createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: `Payroll ${payrollNumber} calculated.`, data: payroll });
  } catch (error) {
    console.error('[Payroll] Run error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to run payroll.' });
  }
};

const getPayrollRuns = async (req, res) => {
  try {
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');
    const runs = await PayrollRun.find({}).sort({ 'period.year': -1, 'period.month': -1 }).lean();
    res.json({ success: true, data: runs, count: runs.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payroll runs.' });
  }
};

const getPayrollRun = async (req, res) => {
  try {
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');
    const run = await PayrollRun.findById(req.params.id).populate('entries.employee', 'employeeId firstName lastName position');
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' });
    res.json({ success: true, data: run });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payroll run.' });
  }
};

const approvePayroll = async (req, res) => {
  try {
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const payroll = await PayrollRun.findById(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found.' });
    if (payroll.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft payroll can be approved.' });

    // Journal: DR Salaries (6000), DR Employer SSNIT (6000), CR PAYE Payable (2400), CR SSNIT Payable (2500), CR Cash (1020)
    const salaryAcct = await Account.findOne({ code: '6000' });
    const payeAcct = await Account.findOne({ code: '2400' });
    const ssnitAcct = await Account.findOne({ code: '2500' });
    const cashAcct = await Account.findOne({ code: '1020' });

    if (!salaryAcct || !payeAcct || !ssnitAcct || !cashAcct) {
      return res.status(500).json({ success: false, message: 'Payroll accounts not found (6000, 2400, 2500, 1020).' });
    }

    const totalDebit = Math.round((payroll.totalGross + payroll.totalEmployerSsnit) * 100) / 100;

    const journalLines = [
      { account: salaryAcct._id, accountCode: '6000', accountName: salaryAcct.name, debit: payroll.totalGross, credit: 0, description: `Salaries ${payroll.payrollNumber}` },
      { account: salaryAcct._id, accountCode: '6000', accountName: salaryAcct.name, debit: payroll.totalEmployerSsnit, credit: 0, description: `Employer SSNIT ${payroll.payrollNumber}` },
      { account: payeAcct._id, accountCode: '2400', accountName: payeAcct.name, debit: 0, credit: payroll.totalPaye, description: `PAYE Payable ${payroll.payrollNumber}` },
      { account: ssnitAcct._id, accountCode: '2500', accountName: ssnitAcct.name, debit: 0, credit: Math.round((payroll.totalEmployeeSsnit + payroll.totalEmployerSsnit) * 100) / 100, description: `SSNIT Payable ${payroll.payrollNumber}` },
      { account: cashAcct._id, accountCode: '1020', accountName: cashAcct.name, debit: 0, credit: payroll.totalNet, description: `Net Pay ${payroll.payrollNumber}` },
    ];

    // PF and staff loan need their own accounts; created on first use so
    // existing charts need no re-seeding.
    const mkAcct = async (code, name, type, cat, nb, desc) => {
      let a = await Account.findOne({ code });
      if (!a) a = await Account.create({ code, name, type, category: cat, normalBalance: nb, isSystemAccount: true, isActive: true, balance: 0, description: desc });
      return a;
    };
    if (payroll.totalProvidentFund > 0) {
      const pf = await mkAcct('2510', 'Provident Fund Payable', 'liability', 'Current Liability', 'credit', 'Tier-3 provident fund withheld from staff');
      journalLines.push({ account: pf._id, accountCode: '2510', accountName: pf.name, debit: 0, credit: payroll.totalProvidentFund, description: `Provident Fund ${payroll.payrollNumber}` });
    }
    if (payroll.totalLoanDeduction > 0) {
      const la = await mkAcct('1150', 'Staff Loan Receivable', 'asset', 'Current Asset', 'debit', 'Loans to staff recovered via payroll');
      journalLines.push({ account: la._id, accountCode: '1150', accountName: la.name, debit: 0, credit: payroll.totalLoanDeduction, description: `Loan recovery ${payroll.payrollNumber}` });
    }

    const entryNumber = await generateEntryNumber(JournalEntry);
    await JournalEntry.create({
      entryNumber, date: new Date(), journalType: 'general',
      description: `Payroll ${payroll.payrollNumber}`,
      reference: payroll.payrollNumber, lines: journalLines,
      totalDebit, totalCredit: totalDebit,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = Math.round((acct.balance + change) * 100) / 100;
        await acct.save();
      }
    }

    if (payroll.totalLoanDeduction > 0) {
      const Emp = getModel(req.tenantDb, 'Employee');
      for (const e of payroll.entries) {
        if (e.loanDeduction > 0 && e.employee) {
          const emp = await Emp.findById(e.employee);
          if (emp && emp.loan) {
            emp.loan.balance = Math.max(0, Math.round((emp.loan.balance - e.loanDeduction) * 100) / 100);
            await emp.save();
          }
        }
      }
    }

    payroll.status = 'approved';
    payroll.approvedBy = req.user._id;
    await payroll.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'approve_payroll', module: 'payroll',
      entityId: payroll._id, entityType: 'PayrollRun',
      description: `Approved payroll ${payroll.payrollNumber} — Journal ${entryNumber}`,
    }, req);

    res.json({ success: true, message: `Payroll ${payroll.payrollNumber} approved. Journal ${entryNumber} posted.`, data: payroll });
  } catch (error) {
    console.error('[Payroll] Approve error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to approve payroll.' });
  }
};

module.exports = { getEmployees, createEmployee, updateEmployee, runPayroll, getPayrollRuns, getPayrollRun, approvePayroll };