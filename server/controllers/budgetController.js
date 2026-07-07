const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getBudgets = async (req, res) => {
  try {
    const Budget = getModel(req.tenantDb, 'Budget');
    const budgets = await Budget.find({}).sort({ fiscalYear: -1 }).lean();
    res.json({ success: true, data: budgets, count: budgets.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch budgets.' });
  }
};

const getBudget = async (req, res) => {
  try {
    const Budget = getModel(req.tenantDb, 'Budget');
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch budget.' });
  }
};

const createBudget = async (req, res) => {
  try {
    const Budget = getModel(req.tenantDb, 'Budget');
    const { name, fiscalYear, lines } = req.body;

    if (!name || !fiscalYear) return res.status(400).json({ success: false, message: 'Name and fiscal year required.' });

    const processedLines = (lines || []).map((l) => {
      const months = l.monthlyAmounts || {};
      const annualTotal = Object.values(months).reduce((s, v) => s + (Number(v) || 0), 0);
      return { ...l, monthlyAmounts: months, annualTotal: Math.round(annualTotal * 100) / 100 };
    });

    const budget = await Budget.create({
      name, fiscalYear: Number(fiscalYear), lines: processedLines,
      status: 'draft', createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Budget created.', data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create budget.' });
  }
};

const approveBudget = async (req, res) => {
  try {
    const Budget = getModel(req.tenantDb, 'Budget');
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });

    budget.status = 'approved';
    budget.approvedBy = req.user._id;
    await budget.save();

    res.json({ success: true, message: 'Budget approved.', data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to approve budget.' });
  }
};

module.exports = { getBudgets, getBudget, createBudget, approveBudget };