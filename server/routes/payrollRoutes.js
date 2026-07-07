const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getEmployees, createEmployee, updateEmployee, runPayroll, getPayrollRuns, getPayrollRun, approvePayroll } = require('../controllers/payrollController');

router.use(protect);
router.get('/employees', getEmployees);
router.post('/employees', authorise('super_admin', 'admin'), createEmployee);
router.put('/employees/:id', authorise('super_admin', 'admin'), updateEmployee);
router.get('/runs', getPayrollRuns);
router.get('/runs/:id', getPayrollRun);
router.post('/run', authorise('super_admin', 'admin', 'accountant'), runPayroll);
router.post('/runs/:id/approve', authorise('super_admin', 'admin'), approvePayroll);

module.exports = router;