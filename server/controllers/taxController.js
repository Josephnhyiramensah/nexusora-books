const { getModel } = require('../utils/getModel');

// Helper: absolute balance of an account by code (0 if missing).
async function acctBal(Account, code) {
  const a = await Account.findOne({ code }).lean();
  return a ? Math.round(Math.abs(a.balance || 0) * 100) / 100 : 0;
}

const getTaxSummary = async (req, res) => {
  try {
    const Account = getModel(req.tenantDb, 'Account');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Bill = getModel(req.tenantDb, 'Bill');
    const PayrollRun = getModel(req.tenantDb, 'PayrollRun');

    // ── VAT ── (from documents + account balances)
    const sentInvoices = await Invoice.find({ status: { $ne: 'draft' } }).lean();
    const totalVATCollected = sentInvoices.reduce((s, inv) => s + (inv.taxAmount || 0), 0);
    const approvedBills = await Bill.find({ status: { $ne: 'draft' } }).lean();
    const totalVATPaid = approvedBills.reduce((s, bill) => s + (bill.taxAmount || 0), 0);
    const netVAT = Math.round((totalVATCollected - totalVATPaid) * 100) / 100;

    // Granular VAT accounts (new chart), fall back to the old 2400 if empty.
    const outputVAT = await acctBal(Account, '2410');   // VAT Payable (Output)
    const inputVAT = await acctBal(Account, '1310');    // Input VAT Recoverable
    const vatPayableAcct = outputVAT || await acctBal(Account, '2400');

    // ── PAYE ──
    const payrollRuns = await PayrollRun.find({ status: { $in: ['approved', 'paid'] } }).lean();
    const totalPAYE = Math.round(payrollRuns.reduce((s, pr) => s + (pr.totalPaye || 0), 0) * 100) / 100;
    const payePayable = await acctBal(Account, '2420');

    // ── SSNIT (tiers) ──
    const totalSSNIT = Math.round(payrollRuns.reduce((s, pr) => s + (pr.totalEmployeeSsnit || 0) + (pr.totalEmployerSsnit || 0), 0) * 100) / 100;
    const ssnitTier1 = await acctBal(Account, '2510');
    const ssnitTier2 = await acctBal(Account, '2520');
    const ssnitTier3 = await acctBal(Account, '2530');
    const ssnitPayableAcct = (ssnitTier1 + ssnitTier2 + ssnitTier3) || await acctBal(Account, '2500');

    // ── Withholding Tax ──
    const whtPayable = await acctBal(Account, '2430');
    const whtReceivable = await acctBal(Account, '1320');

    // ── Corporate Tax ──
    const corpTaxPayable = await acctBal(Account, '2440');
    const corpTaxExpense = await acctBal(Account, '7900');

    res.json({
      success: true,
      data: {
        vat: {
          collected: Math.round(totalVATCollected * 100) / 100,
          paid: Math.round(totalVATPaid * 100) / 100,
          net: netVAT,
          outputVAT, inputVAT,
          payable: vatPayableAcct,
        },
        paye: { total: totalPAYE, payable: payePayable },
        ssnit: {
          total: totalSSNIT,
          tier1: ssnitTier1, tier2: ssnitTier2, tier3: ssnitTier3,
          payable: ssnitPayableAcct,
        },
        wht: { payable: whtPayable, receivable: whtReceivable },
        corporateTax: { payable: corpTaxPayable, expense: corpTaxExpense },
        payrollRunCount: payrollRuns.length,
      },
    });
  } catch (error) {
    console.error('[Tax] Summary error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate tax summary.' });
  }
};

module.exports = { getTaxSummary };