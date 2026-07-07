const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTaxSummary } = require('../controllers/taxController');

router.use(protect);
router.get('/summary', getTaxSummary);

module.exports = router;