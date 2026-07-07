const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getApiKeys, createApiKey, revokeApiKey } = require('../controllers/apiKeyController');

router.use(protect);
router.use(authorise('super_admin', 'admin'));

router.get('/', getApiKeys);
router.post('/', createApiKey);
router.delete('/:id/revoke', revokeApiKey);

module.exports = router;