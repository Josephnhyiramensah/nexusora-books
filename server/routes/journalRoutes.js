// server/routes/journalRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getJournals, getJournal, createJournal,
  updateJournal, postJournal, reverseJournal, deleteJournal,
} = require('../controllers/journalController');

router.use(protect);

router.get('/', getJournals);
router.get('/:id', getJournal);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createJournal);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateJournal);
router.post('/:id/post', authorise('super_admin', 'admin', 'accountant'), postJournal);
router.post('/:id/reverse', authorise('super_admin', 'admin', 'accountant'), reverseJournal);
router.delete('/:id', authorise('super_admin', 'admin'), deleteJournal);

module.exports = router;