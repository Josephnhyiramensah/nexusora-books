const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getItems, createItem, updateItem, deleteItem } = require('../controllers/inventoryController');

router.use(protect);
router.get('/', getItems);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createItem);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateItem);
router.delete('/:id', authorise('super_admin', 'admin'), deleteItem);

module.exports = router;