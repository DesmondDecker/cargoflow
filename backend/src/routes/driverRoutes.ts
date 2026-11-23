import { Router } from 'express';
import { requireDriverAuth } from '../middleware/driverAuth';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimit';
import { driverSignup, driverLogin, driverRefresh, driverMe } from '../controllers/driverAuthController';
import * as ctrl from '../controllers/driverController';

const router = Router();

router.post('/auth/signup', authRateLimiter, driverSignup);
router.post('/auth/login', authRateLimiter, driverLogin);
router.post('/auth/refresh', refreshRateLimiter, driverRefresh);

router.get('/me', requireDriverAuth, driverMe);
router.get('/profile', requireDriverAuth, ctrl.getMyProfile);
router.patch('/availability', requireDriverAuth, ctrl.setAvailability);
router.post('/vehicles', requireDriverAuth, ctrl.addVehicle);
router.post('/verification/request', requireDriverAuth, ctrl.requestVerification);
router.patch('/push-token', requireDriverAuth, ctrl.setDriverPushToken);
router.get('/notification-prefs', requireDriverAuth, ctrl.getDriverNotificationPrefs);
router.patch('/notification-prefs', requireDriverAuth, ctrl.setDriverNotificationPrefs);
router.get('/earnings', requireDriverAuth, ctrl.getEarnings);

router.get('/jobs', requireDriverAuth, ctrl.getMyJobs);
router.get('/jobs/history', requireDriverAuth, ctrl.getJobHistory);
router.get('/jobs/:id', requireDriverAuth, ctrl.getJobDetail);
router.post('/jobs/:id/respond', requireDriverAuth, ctrl.respondToJob);
router.patch('/jobs/:id/status', requireDriverAuth, ctrl.updateJobStatus);
router.post('/jobs/:id/complete', requireDriverAuth, ctrl.completeJob);

router.post('/upload-url', requireDriverAuth, ctrl.getDriverUploadUrl);

export default router;
