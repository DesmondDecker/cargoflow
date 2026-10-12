import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { fetchLatestDigest, runDigestNow } from '../controllers/reportController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/daily-digest', fetchLatestDigest);
router.post('/daily-digest/run', runDigestNow);

export default router;
