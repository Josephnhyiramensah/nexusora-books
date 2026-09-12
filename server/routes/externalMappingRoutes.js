// server/routes/externalMappingRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { listMappings, getMapping, saveMapping, deleteMapping } = require('../controllers/externalMappingController');

router.use(protect);
// Managing integration mappings is an admin action.
router.use(authorise('super_admin', 'admin'));

router.get('/', listMappings);
router.get('/:id', getMapping);
router.post('/', saveMapping);
router.delete('/:id', deleteMapping);

module.exports = router;
