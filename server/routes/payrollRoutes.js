const express = require('express');
const router = express.Router();
const { protect, authorise, allow } = require('../middleware/authMiddleware');
const { getEmployees, createEmployee, updateEmployee, runPayroll, getPayrollRuns, getPayrollRun, approvePayroll } = require('../controllers/payrollController');

router.use(protect);
// Payroll exposes salary data — finance roles only. The admin-only checks on
// create/update/approve below still apply on top of this.
router.use(allow('payroll.view', 'super_admin', 'admin', 'accountant'));

router.get('/employees', getEmployees);
router.post('/employees', authorise('super_admin', 'admin'), createEmployee);
router.put('/employees/:id', authorise('super_admin', 'admin'), updateEmployee);
router.get('/runs', getPayrollRuns);
router.get('/runs/:id', getPayrollRun);
router.post('/run', authorise('super_admin', 'admin', 'accountant'), runPayroll);
router.post('/runs/:id/approve', authorise('super_admin', 'admin'), approvePayroll);

module.exports = router;