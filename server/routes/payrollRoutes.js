const express = require('express');
const router = express.Router();
const { protect, authorise, allow } = require('../middleware/authMiddleware');
const { getEmployees, createEmployee, updateEmployee, runPayroll, getPayrollRuns, getPayrollRun, approvePayroll, getPayrollRates } = require('../controllers/payrollController');
const {
  getCasualWorkers, createCasualWorker, updateCasualWorker,
  getCasualSheets, getCasualSheet, createCasualSheet,
  approveCasualSheet, deleteCasualSheet,
} = require('../controllers/casualController');

router.use(protect);
// Payroll exposes salary data — finance roles only. The admin-only checks on
// create/update/approve below still apply on top of this.
router.use(allow('payroll.view', 'super_admin', 'admin', 'accountant'));

router.get('/employees', getEmployees);
router.post('/employees', authorise('super_admin', 'admin'), createEmployee);
router.put('/employees/:id', authorise('super_admin', 'admin'), updateEmployee);
router.get('/runs', getPayrollRuns);
router.get('/runs/:id', getPayrollRun);
router.get('/rates', getPayrollRates);
router.post('/run', authorise('super_admin', 'admin', 'accountant'), runPayroll);
router.post('/runs/:id/approve', authorise('super_admin', 'admin'), approvePayroll);

// --- Casual / day workers ---------------------------------------------------
// Same module, same payroll.view gate inherited from router.use above. Casual
// workers carry no SSNIT or PAYE, so they are kept separate from Employee.
router.get('/casual/workers', getCasualWorkers);
router.post('/casual/workers', authorise('super_admin', 'admin', 'accountant'), createCasualWorker);
router.put('/casual/workers/:id', authorise('super_admin', 'admin', 'accountant'), updateCasualWorker);

router.get('/casual/sheets', getCasualSheets);
router.get('/casual/sheets/:id', getCasualSheet);
router.post('/casual/sheets', authorise('super_admin', 'admin', 'accountant'), createCasualSheet);
router.post('/casual/sheets/:id/approve', authorise('super_admin', 'admin'), approveCasualSheet);
router.delete('/casual/sheets/:id', authorise('super_admin', 'admin'), deleteCasualSheet);

module.exports = router;