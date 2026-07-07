const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../middleware/authMiddleware');
const { getFixedAssets, getFixedAsset, createFixedAsset, updateFixedAsset, depreciateAsset, disposeAsset } = require('../controllers/fixedAssetController');

router.use(protect);
router.get('/', getFixedAssets);
router.get('/:id', getFixedAsset);
router.post('/', authorise('super_admin', 'admin', 'accountant'), createFixedAsset);
router.put('/:id', authorise('super_admin', 'admin', 'accountant'), updateFixedAsset);
router.post('/:id/depreciate', authorise('super_admin', 'admin', 'accountant'), depreciateAsset);
router.post('/:id/dispose', authorise('super_admin', 'admin'), disposeAsset);

module.exports = router;