const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { uploadLogo, uploadLetterhead, uploadDocument, deleteDocument } = require('../controllers/uploadController');

router.use(protect);
router.post('/logo', authorise('super_admin', 'admin'), uploadLogo);
router.post('/letterhead', authorise('super_admin', 'admin'), uploadLetterhead);

router.post('/document', uploadDocument);
router.post('/document/delete', authorise('super_admin', 'admin', 'accountant'), deleteDocument);

module.exports = router;