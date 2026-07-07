const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getInvoices, getInvoice, createInvoice, updateInvoice, sendInvoice, deleteInvoice, downloadInvoicePDF,
} = require('../controllers/invoiceController');
router.use(protect);

router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createInvoice);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateInvoice);
router.post('/:id/send', authorise('super_admin', 'admin', 'accountant'), sendInvoice);
router.delete('/:id', authorise('super_admin', 'admin'), deleteInvoice);
router.get('/:id/pdf', downloadInvoicePDF);
module.exports = router;