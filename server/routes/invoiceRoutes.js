const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, sendInvoice, deleteInvoice, downloadInvoicePDF,
  markRecurring, getRecurringTemplates, stopRecurring, runDueRecurring,
  approveInvoice, rejectInvoice,
} = require('../controllers/invoiceController');
const validate = require('../middleware/validate');
const { createInvoiceRules, updateInvoiceRules } = require('../validators/invoiceValidators');

router.use(protect);

router.get('/', getInvoices);
// Recurring — declared before '/:id' so 'recurring' is not read as an id.
router.get('/recurring/templates', getRecurringTemplates);
router.post('/recurring/run', authorise('super_admin', 'admin', 'accountant'), runDueRecurring);
router.post('/:id/recurring', authorise('super_admin', 'admin', 'accountant'), markRecurring);
router.post('/:id/recurring/stop', authorise('super_admin', 'admin', 'accountant'), stopRecurring);
router.get('/:id', getInvoice);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createInvoiceRules, validate, createInvoice);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateInvoiceRules, validate, updateInvoice);
router.post('/:id/send', authorise('super_admin', 'admin', 'accountant'), sendInvoice);
router.post('/:id/approve', authorise('super_admin', 'admin'), approveInvoice);
router.post('/:id/reject', authorise('super_admin', 'admin'), rejectInvoice);
router.delete('/:id', authorise('super_admin', 'admin'), deleteInvoice);
router.get('/:id/pdf', downloadInvoicePDF);
module.exports = router;
