const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { uploadLogo, uploadLetterhead } = require('../controllers/uploadController');

router.use(protect);
router.post('/logo', authorise('super_admin', 'admin'), uploadLogo);
router.post('/letterhead', authorise('super_admin', 'admin'), uploadLetterhead);

module.exports = router;