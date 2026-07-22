const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getTaxSummary } = require('../controllers/taxController');

router.use(protect);
// Tax summary is finance-only.
router.use(authorise('super_admin', 'admin', 'accountant'));

router.get('/summary', getTaxSummary);
module.exports = router;