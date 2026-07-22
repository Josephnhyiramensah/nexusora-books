const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getBudgets, getBudget, createBudget, approveBudget } = require('../controllers/budgetController');

router.use(protect);
// Budgets are finance-only. Stricter per-route checks below still apply.
router.use(authorise('super_admin', 'admin', 'accountant'));

router.get('/', getBudgets);
router.get('/:id', getBudget);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBudget);
router.post('/:id/approve', authorise('super_admin', 'admin'), approveBudget);

module.exports = router;