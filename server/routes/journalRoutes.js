// server/routes/journalRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getJournals, getJournal, createJournal,
  updateJournal, postJournal, reverseJournal, deleteJournal,
  approveJournal, rejectJournal,
} = require('../controllers/journalController');
const validate = require('../middleware/validate');
const { createJournalRules, updateJournalRules } = require('../validators/journalValidators');

router.use(protect);
router.get('/', getJournals);
router.get('/:id', getJournal);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createJournalRules, validate, createJournal);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateJournalRules, validate, updateJournal);
router.post('/:id/post', authorise('super_admin', 'admin', 'accountant'), postJournal);
router.post('/:id/approve', authorise('super_admin', 'admin'), approveJournal);
router.post('/:id/reject', authorise('super_admin', 'admin'), rejectJournal);
router.post('/:id/reverse', authorise('super_admin', 'admin', 'accountant'), reverseJournal);
router.delete('/:id', authorise('super_admin', 'admin'), deleteJournal);

module.exports = router;
