const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getAuditLogs, getAuditStats, deleteAuditLog, clearAuditLogs } = require('../controllers/auditController');

router.use(protect);
router.use(authorise('super_admin', 'admin'));

router.get('/', getAuditLogs);
router.get('/stats', getAuditStats);
router.delete('/clear', clearAuditLogs);      // bulk clear
router.delete('/:id', deleteAuditLog);         // single delete

module.exports = router;