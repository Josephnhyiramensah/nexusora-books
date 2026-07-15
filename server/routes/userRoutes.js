const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getUsers, createUser, updateUser, deactivateUser, unlockUser } = require('../controllers/userController');

router.use(protect);
router.use(authorise('super_admin', 'admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-active', deactivateUser);
router.post('/:id/unlock', unlockUser);

module.exports = router;