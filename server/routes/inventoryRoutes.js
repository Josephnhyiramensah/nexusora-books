const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getItems, createItem, updateItem, deleteItem,
  receiveStock, issueStock, adjustStock, transferStock,
  getMovements, getItemStock, getValuation,
} = require('../controllers/inventoryController');

router.use(protect);

// Item catalogue
router.get('/', getItems);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createItem);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateItem);
router.delete('/:id', authorise('super_admin', 'admin'), deleteItem);

// Stock movements (branch-scoped via X-Branch). Finance roles record stock.
router.get('/movements', getMovements);
router.get('/valuation', getValuation);
router.post('/receive',  authorise('super_admin', 'admin', 'accountant'), receiveStock);
router.post('/issue',    authorise('super_admin', 'admin', 'accountant'), issueStock);
router.post('/adjust',   authorise('super_admin', 'admin', 'accountant'), adjustStock);
router.post('/transfer', authorise('super_admin', 'admin', 'accountant'), transferStock);

// Per-item stock (keep AFTER the static routes above so they aren't shadowed).
router.get('/:id/stock', getItemStock);

module.exports = router;