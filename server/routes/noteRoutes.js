const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotes, getNote, createNote, updateNote, deleteNote, pinNote, addComment } = require('../controllers/noteController');

router.use(protect);
router.get('/', getNotes);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.patch('/:id/pin', pinNote);
router.post('/:id/comments', addComment);

module.exports = router;