const express = require('express');
const router = express.Router();
const {
  provisionTenant, listTenants, getTenant, updateTenantSettings,
  getPricing, suspendTenant, reactivateTenant, getAdminStats,
  changeTenantPlan, getTenantUsers, resetTenantUserPassword,
  getTenantDetailStats, deleteTenant,
} = require('../controllers/tenantController');
// Public
router.post('/provision', provisionTenant);
router.get('/pricing', getPricing);

// Admin (protect in production with admin auth)
router.get('/', listTenants);
router.get('/admin/stats', getAdminStats);
router.get('/:subdomain', getTenant);
router.put('/:subdomain/settings', updateTenantSettings);
router.post('/:subdomain/suspend', suspendTenant);
router.post('/:subdomain/reactivate', reactivateTenant);
router.put('/:subdomain/plan', changeTenantPlan);
router.delete('/:subdomain', deleteTenant);
router.get('/:subdomain/users', getTenantUsers);
router.post('/:subdomain/reset-password', resetTenantUserPassword);
router.get('/:subdomain/detail-stats', getTenantDetailStats);

router.get('/:subdomain/users', getTenantUsers);
router.post('/:subdomain/reset-password', resetTenantUserPassword);
router.get('/:subdomain/detail-stats', getTenantDetailStats);
module.exports = router;