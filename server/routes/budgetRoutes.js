const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getBudgets, getBudget, createBudget, approveBudget } = require('../controllers/budgetController');

router.use(protect);
router.get('/', getBudgets);
router.get('/:id', getBudget);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createBudget);
router.post('/:id/approve', authorise('super_admin', 'admin'), approveBudget);

module.exports = router;