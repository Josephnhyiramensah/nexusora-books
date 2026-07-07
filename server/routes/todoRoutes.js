const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTodos, getTodo, createTodo, updateTodo, completeTodo, deleteTodo, addComment } = require('../controllers/todoController');

router.use(protect);
router.get('/', getTodos);
router.get('/:id', getTodo);
router.post('/', createTodo);
router.put('/:id', updateTodo);
router.patch('/:id/complete', completeTodo);
router.delete('/:id', deleteTodo);
router.post('/:id/comments', addComment);

module.exports = router;