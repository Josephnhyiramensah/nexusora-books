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
    const { firstName, lastName, email, phone, position, department, hireDate, basicSalary, allowances, ssnitNumber, taxId, bankName, bankAccountNumber } = req.body;

    if (!firstName || !lastName || !basicSalary) {
      return res.status(400).json({ success: false, message: 'Required: firstName, lastName, basicSalary.' });
    }

    const count = await Employee.countDocuments({});
    const employeeId = `EMP-${(count + 1).toString().padStart(3, '0')}`;

    const employee = await Employee.create({
      employeeId, firstName, lastName, email, phone, position, department,
      hireDate, basicSalary: Number(basicSalary),
      allowances: allowances || [], ssnitNumber, taxId,
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

    const fields = ['firstName', 'lastName', 'email', 'phone', 'position', 'department', 'basicSalary', 'allowances', 'ssnitNumber', 'taxId', 'bankName', 'bankAccountNumber'];
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

    const entries = employees.map((emp) => {
      const totalAllowances = (emp.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
      const grossPay = emp.basicSalary + totalAllowances;
      const employeeSsnit = Math.round(emp.basicSalary * 0.055 * 100) / 100;
      const employerSsnit = Math.round(emp.basicSalary * 0.13 * 100) / 100;
      const taxableIncome = grossPay - employeeSsnit;
      const paye = calculatePAYE(taxableIncome);
      const netPay = Math.round((grossPay - employeeSsnit - paye) * 100) / 100;

      return {
        employee: emp._id, basicSalary: emp.basicSalary,
        totalAllowances, grossPay, paye, employeeSsnit, employerSsnit,
        otherDeductions: 0, netPay,
      };
    });

    const totalGross = Math.round(entries.reduce((s, e) => s + e.grossPay, 0) * 100) / 100;
    const totalNet = Math.round(entries.reduce((s, e) => s + e.netPay, 0) * 100) / 100;
    const totalPaye = Math.round(entries.reduce((s, e) => s + e.paye, 0) * 100) / 100;
    const totalEmployeeSsnit = Math.round(entries.reduce((s, e) => s + e.employeeSsnit, 0) * 100) / 100;
    const totalEmployerSsnit = Math.round(entries.reduce((s, e) => s + e.employerSsnit, 0) * 100) / 100;

    const payrollNumber = `PR-${year}-${String(month).padStart(2, '0')}`;

    const payroll = await PayrollRun.create({
      payrollNumber, period: { month: Number(month), year: Number(year) },
      runDate: new Date(), entries,
      totalGross, totalNet, totalPaye, totalEmployeeSsnit, totalEmployerSsnit,
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