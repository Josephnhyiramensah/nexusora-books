// server/routes/branchRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const {
  getBranches, getBranch, createBranch, updateBranch, setBranchStatus, deleteBranch,
} = require('../controllers/branchController');

router.use(protect);

// Any authenticated user can READ the branch list (the switcher needs it, and
// scoping already limits what a branch-restricted user actually sees elsewhere).
router.get('/', getBranches);
router.get('/:id', getBranch);

// Writes are company-structure changes — admins only.
router.post('/', authorise('super_admin', 'admin'), createBranch);
router.put('/:id', authorise('super_admin', 'admin'), updateBranch);
router.patch('/:id/status', authorise('super_admin', 'admin'), setBranchStatus);
router.delete('/:id', authorise('super_admin', 'admin'), deleteBranch);

module.exports = router;