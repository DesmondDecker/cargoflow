import { Router } from 'express';
import { requirePlatformAdminAuth } from '../middleware/platformAdminAuth';
import { authRateLimiter } from '../middleware/rateLimit';
import * as ctrl from '../controllers/platformAdminController';

const router = Router();

router.post('/login', authRateLimiter, ctrl.adminLogin);
router.post('/refresh', ctrl.adminRefresh);
router.post('/logout', requirePlatformAdminAuth, ctrl.adminLogout);

router.get('/me', requirePlatformAdminAuth, ctrl.getOwnProfile);
router.patch('/me/password', requirePlatformAdminAuth, ctrl.changeOwnPassword);

router.get('/admins', requirePlatformAdminAuth, ctrl.listPlatformAdmins);
router.post('/admins', requirePlatformAdminAuth, ctrl.createPlatformAdmin);
router.patch('/admins/:id/deactivate', requirePlatformAdminAuth, ctrl.deactivatePlatformAdmin);

router.get('/analytics', requirePlatformAdminAuth, ctrl.getAnalytics);

router.get('/agencies', requirePlatformAdminAuth, ctrl.listAgencies);
router.patch('/agencies/:id/subscription', requirePlatformAdminAuth, ctrl.updateAgencySubscription);
router.patch('/agencies/:id/status', requirePlatformAdminAuth, ctrl.updateAgencyActive);
router.patch('/agencies/:id/reset-password', requirePlatformAdminAuth, ctrl.resetAgencyPassword);

router.get('/payments', requirePlatformAdminAuth, ctrl.listPayments);
router.post('/payments/:id/verify', requirePlatformAdminAuth, ctrl.verifyPayment);
router.post('/payments/:id/reject', requirePlatformAdminAuth, ctrl.rejectPayment);

router.get('/expenses', requirePlatformAdminAuth, ctrl.listExpensesForAdmin);
router.post('/expenses/:id/approve', requirePlatformAdminAuth, ctrl.approveExpenseForAdmin);
router.post('/expenses/:id/reject', requirePlatformAdminAuth, ctrl.rejectExpenseForAdmin);

router.get('/gateway-devices', requirePlatformAdminAuth, ctrl.listGatewayDevices);
router.post('/gateway-devices', requirePlatformAdminAuth, ctrl.createGatewayDevice);
router.patch('/gateway-devices/:id/deactivate', requirePlatformAdminAuth, ctrl.deactivateGatewayDevice);

router.get('/plans', requirePlatformAdminAuth, ctrl.listPlans);

router.get('/drivers', requirePlatformAdminAuth, ctrl.listDriversForAdmin);
router.patch('/drivers/:id/reset-password', requirePlatformAdminAuth, ctrl.resetDriverPassword);

router.get('/warehouses', requirePlatformAdminAuth, ctrl.listWarehousesForAdmin);
router.patch('/warehouses/:id/verification', requirePlatformAdminAuth, ctrl.setWarehouseVerification);
router.patch('/warehouses/:id/reset-password', requirePlatformAdminAuth, ctrl.resetWarehousePassword);
router.patch('/warehouses/:id/sponsorship', requirePlatformAdminAuth, ctrl.setWarehouseSponsorship);
router.patch('/drivers/:id/sponsorship', requirePlatformAdminAuth, ctrl.setDriverSponsorship);

export default router;
