const { getModel } = require('../utils/getModel');

const getTaxSummary = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Bill = getModel(req.tenantDb, 'Bill');
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');

    // VAT collected (from invoices)
    const sentInvoices = await Invoice.find({ status: { $ne: 'draft' } }).lean();
    const totalVATCollected = sentInvoices.reduce((s, inv) => s + (inv.taxAmount || 0), 0);

    // VAT paid (from bills)
    const approvedBills = await Bill.find({ status: { $ne: 'draft' } }).lean();
    const totalVATPaid = approvedBills.reduce((s, bill) => s + (bill.taxAmount || 0), 0);

    const netVAT = Math.round((totalVATCollected - totalVATPaid) * 100) / 100;

    // PAYE from payroll
    const payrollRuns = await PayrollRun.find({ status: { $in: ['approved', 'paid'] } }).lean();
    const totalPAYE = Math.round(payrollRuns.reduce((s, pr) => s + (pr.totalPaye || 0), 0) * 100) / 100;
    const totalSSNIT = Math.round(payrollRuns.reduce((s, pr) => s + (pr.totalEmployeeSsnit || 0) + (pr.totalEmployerSsnit || 0), 0) * 100) / 100;

    // Tax account balance
    const taxAccount = await Account.findOne({ code: '2400' }).lean();
    const ssnitAccount = await Account.findOne({ code: '2500' }).lean();

    res.json({
      success: true,
      data: {
        vat: {
          collected: Math.round(totalVATCollected * 100) / 100,
          paid: Math.round(totalVATPaid * 100) / 100,
          net: netVAT,
          payable: taxAccount?.balance || 0,
        },
        paye: { total: totalPAYE },
        ssnit: { total: totalSSNIT, payable: ssnitAccount?.balance || 0 },
        payrollRunCount: payrollRuns.length,
      },
    });
  } catch (error) {
    console.error('[Tax] Summary error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate tax summary.' });
  }
};

module.exports = { getTaxSummary };