import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { resolveCode, trackCodes, globalSearch } from '../controllers/searchController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/resolve/:code', resolveCode);
router.get('/track', trackCodes);
router.post('/track', trackCodes);
router.get('/', globalSearch);

export default router;
