// server/routes/tenantRoutes.js

const express = require('express');
const router = express.Router();
const {
  provisionTenant, listTenants, getTenant, getTenantPublic, updateTenantSettings,
  getPricing, suspendTenant, reactivateTenant, getAdminStats,
  changeTenantPlan, getTenantUsers, resetTenantUserPassword,
  getTenantDetailStats, deleteTenant, broadcastNotification,
  listBroadcasts, updateBroadcast, deleteBroadcast,
  unlockTenantUser, changeTenantUserRole, changeTenantUserIdentity, setTenantUserActive,
} = require('../controllers/tenantController');
const { platformProtect, platformOwnerOnly } = require('../middleware/platformMiddleware');

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
// Self-service signup and the pricing table.
router.post('/provision', provisionTenant);
router.get('/pricing', getPricing);

// Minimal public tenant info for the login page branding (companyName, plan,
// whiteLabel colours ONLY). The full record — owner details, subscription,
// databaseName — is NEVER exposed here.
router.get('/:subdomain/public', getTenantPublic);

// ─── PLATFORM ADMIN ONLY ──────────────────────────────────────────────────────
// Every route below requires a valid PLATFORM token. A tenant user's token —
// even KGR's super_admin — is signed with a different secret and cannot pass.
router.use(platformProtect);

router.get('/', listTenants);
router.get('/admin/stats', getAdminStats);

// Declared BEFORE '/:subdomain' -- otherwise Express matches 'broadcasts' as a
// subdomain and these never fire.
router.get('/broadcasts', listBroadcasts);
router.put('/broadcasts/:broadcastId', updateBroadcast);
router.delete('/broadcasts/:broadcastId', deleteBroadcast);
router.get('/:subdomain', getTenant);
router.put('/:subdomain/settings', updateTenantSettings);
router.post('/:subdomain/suspend', suspendTenant);
router.post('/:subdomain/reactivate', reactivateTenant);
router.put('/:subdomain/plan', changeTenantPlan);
router.get('/:subdomain/users', getTenantUsers);
router.post('/:subdomain/reset-password', resetTenantUserPassword);
router.get('/:subdomain/detail-stats', getTenantDetailStats);

// Console broadcast. Writes a real Notification document into every targeted
// tenant database -- the old client-side loop posted N copies of a Note into
// whichever single tenant the hostname resolved to, and never reached the bell.
router.post('/broadcast', broadcastNotification);

// Per-user operator controls (all inherit platformProtect from router.use above).
router.post('/:subdomain/users/:userId/unlock', unlockTenantUser);
router.put('/:subdomain/users/:userId/role', changeTenantUserRole);
router.put('/:subdomain/users/:userId/identity', changeTenantUserIdentity);
router.put('/:subdomain/users/:userId/active', setTenantUserActive);
// Destructive — platform OWNER only.
router.delete('/:subdomain', platformOwnerOnly, deleteTenant);

module.exports = router;