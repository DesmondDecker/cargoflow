import { Router } from 'express';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimit';
import { requireInstitutionAuth, requireSupervisor } from '../middleware/institutionAuth';
import { auditInstitutionActions } from '../middleware/auditInstitution';
import * as oversight from '../controllers/institutionOversightController';
import * as auth from '../controllers/institutionAuthController';

// Sign-in for Customs and AGL staff (the institution portal).
const router = Router();
router.use(auditInstitutionActions);

router.post('/auth/login', authRateLimiter, auth.institutionLogin);
router.post('/auth/refresh', refreshRateLimiter, auth.institutionRefresh);
router.get('/auth/me', requireInstitutionAuth(), auth.institutionMe);
router.post('/auth/logout', requireInstitutionAuth(), auth.institutionLogout);
router.patch('/auth/password', requireInstitutionAuth(), auth.institutionChangePassword);

// Supervisors' oversight of their own institution's staff (read-only).
router.get('/oversight/log', requireSupervisor, oversight.listLog);
router.get('/oversight/log.csv', requireSupervisor, oversight.exportLogCsv);
router.get('/oversight/staff', requireSupervisor, oversight.staffSummary);

export default router;
