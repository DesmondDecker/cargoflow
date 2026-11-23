import { Router } from 'express';
import { registerAgency, joinAgency, login, refresh, me, changeAgencyPassword, changeMyPin, setPushToken, getNotificationPrefs, setNotificationPrefs } from '../controllers/authController';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register-agency', authRateLimiter, registerAgency);
router.post('/join', authRateLimiter, joinAgency);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refreshRateLimiter, refresh);
router.get('/me', requireAgencyAuth, me);
router.patch('/push-token', requireAgencyAuth, setPushToken);
router.get('/notification-prefs', requireAgencyAuth, getNotificationPrefs);
router.patch('/notification-prefs', requireAgencyAuth, setNotificationPrefs);
router.patch('/pin', requireAgencyAuth, changeMyPin);
router.patch('/agency-password', requireAgencyAuth, requireRole('owner', 'admin'), changeAgencyPassword);

export default router;
