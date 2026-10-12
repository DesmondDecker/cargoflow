import { Router } from 'express';
import { registerAgency, joinAgency, login, refresh, me, changeAgencyPassword, setPushToken } from '../controllers/authController';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register-agency', authRateLimiter, registerAgency);
router.post('/join', authRateLimiter, joinAgency);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refresh);
router.get('/me', requireAgencyAuth, me);
router.patch('/push-token', requireAgencyAuth, setPushToken);
router.patch('/agency-password', requireAgencyAuth, requireRole('owner', 'admin'), changeAgencyPassword);

export default router;
