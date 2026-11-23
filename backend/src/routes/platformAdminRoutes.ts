import { Router } from 'express';
import { auditAdminActions } from '../middleware/auditAdmin';
import { requirePlatformAdminAuth, requireAdminAccess } from '../middleware/platformAdminAuth';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimit';
import * as ctrl from '../controllers/platformAdminController';

const router = Router();
// Every successful change an authenticated admin makes is written to the audit log.
router.use(auditAdminActions);

router.post('/login', authRateLimiter, ctrl.adminLogin);
router.post('/refresh', refreshRateLimiter, ctrl.adminRefresh);
router.post('/logout', requirePlatformAdminAuth, ctrl.adminLogout);

router.get('/me', requirePlatformAdminAuth, ctrl.getOwnProfile);
router.patch('/me/password', requirePlatformAdminAuth, ctrl.changeOwnPassword);

router.get('/admins', requirePlatformAdminAuth, requireAdminAccess('admins'), ctrl.listPlatformAdmins);
router.post('/admins', requirePlatformAdminAuth, requireAdminAccess('admins'), ctrl.createPlatformAdmin);
router.patch('/admins/:id/role', requirePlatformAdminAuth, requireAdminAccess('admins'), ctrl.setPlatformAdminRole);
router.patch('/admins/:id/deactivate', requirePlatformAdminAuth, requireAdminAccess('admins'), ctrl.deactivatePlatformAdmin);

router.get('/analytics', requirePlatformAdminAuth, requireAdminAccess('general'), ctrl.getAnalytics);

// Customs and AGL staff accounts for the customs-verification workflow.
router.get('/institution-users', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.listInstitutionUsers);
router.post('/institution-users', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.createInstitutionUser);
router.patch('/institution-users/:id', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.updateInstitutionUser);
router.patch('/institution-users/:id/reset-password', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.resetInstitutionUserPassword);

router.get('/agencies', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.listAgencies);
router.patch('/agencies/:id/subscription', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.updateAgencySubscription);
router.patch('/agencies/:id/status', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.updateAgencyActive);
router.patch('/agencies/:id/reset-owner-pin', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.resetAgencyOwnerPin);
router.patch('/agencies/:id/reset-password', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.resetAgencyPassword);

router.get('/payments', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.listPayments);
router.post('/payments/:id/verify', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.verifyPayment);
router.post('/payments/:id/reject', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.rejectPayment);

router.get('/expenses', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.listExpensesForAdmin);
router.post('/expenses/:id/approve', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.approveExpenseForAdmin);
router.post('/expenses/:id/reject', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.rejectExpenseForAdmin);

router.get('/gateway-devices', requirePlatformAdminAuth, requireAdminAccess('devices'), ctrl.listGatewayDevices);
router.post('/gateway-devices', requirePlatformAdminAuth, requireAdminAccess('devices'), ctrl.createGatewayDevice);
router.patch('/gateway-devices/:id/deactivate', requirePlatformAdminAuth, requireAdminAccess('devices'), ctrl.deactivateGatewayDevice);

router.get('/plans', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.listPlans);
router.post('/plans', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.createPlan);
router.patch('/plans/:planId', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.updatePlan);
router.get('/institution-audit', requirePlatformAdminAuth, requireAdminAccess('audit'), ctrl.listInstitutionAudit);
router.get('/audit-log', requirePlatformAdminAuth, requireAdminAccess('audit'), ctrl.listAuditLog);
router.get('/adoption', requirePlatformAdminAuth, requireAdminAccess('general'), ctrl.getAdoption);

router.get('/drivers', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.listDriversForAdmin);
router.patch('/drivers/:id/verification', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.setDriverVerification);
router.patch('/drivers/:id/reset-password', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.resetDriverPassword);

router.get('/warehouses', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.listWarehousesForAdmin);
router.patch('/warehouses/:id/verification', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.setWarehouseVerification);
router.patch('/warehouses/:id/reset-password', requirePlatformAdminAuth, requireAdminAccess('support'), ctrl.resetWarehousePassword);
router.patch('/warehouses/:id/sponsorship', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.setWarehouseSponsorship);
router.patch('/drivers/:id/sponsorship', requirePlatformAdminAuth, requireAdminAccess('finance'), ctrl.setDriverSponsorship);

export default router;
