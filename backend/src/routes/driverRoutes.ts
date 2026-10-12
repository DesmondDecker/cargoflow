import { Router } from 'express';
import { requireDriverAuth } from '../middleware/driverAuth';
import { authRateLimiter } from '../middleware/rateLimit';
import { driverSignup, driverLogin, driverRefresh, driverMe } from '../controllers/driverAuthController';
import * as ctrl from '../controllers/driverController';

const router = Router();

router.post('/auth/signup', authRateLimiter, driverSignup);
router.post('/auth/login', authRateLimiter, driverLogin);
router.post('/auth/refresh', driverRefresh);

router.get('/me', requireDriverAuth, driverMe);
router.get('/profile', requireDriverAuth, ctrl.getMyProfile);
router.patch('/availability', requireDriverAuth, ctrl.setAvailability);
router.post('/vehicles', requireDriverAuth, ctrl.addVehicle);

router.get('/jobs', requireDriverAuth, ctrl.getMyJobs);
router.get('/jobs/:id', requireDriverAuth, ctrl.getJobDetail);
router.post('/jobs/:id/respond', requireDriverAuth, ctrl.respondToJob);
router.patch('/jobs/:id/status', requireDriverAuth, ctrl.updateJobStatus);
router.post('/jobs/:id/complete', requireDriverAuth, ctrl.completeJob);

router.post('/upload-url', requireDriverAuth, ctrl.getDriverUploadUrl);

export default router;
