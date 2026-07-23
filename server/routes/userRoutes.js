const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getUsers, createUser, updateUser, deactivateUser, unlockUser, updatePermissions } = require('../controllers/userController');
const { PERMISSIONS } = require('../config/permissions');

router.use(protect);

// The catalogue is needed by any signed-in user's client to know what exists;
// it contains no user data, only the list of grantable areas.
router.get('/permissions/catalogue', (req, res) => {
  res.json({ success: true, data: PERMISSIONS });
});

router.use(authorise('super_admin', 'admin'));
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-active', deactivateUser);
router.post('/:id/unlock', unlockUser);
router.put('/:id/permissions', updatePermissions);

module.exports = router;