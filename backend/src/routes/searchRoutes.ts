import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { resolveCode, trackCodes, trackUnregisteredContainer, saveUnregisteredTracking, listSavedTracking, deleteSavedTracking, globalSearch } from '../controllers/searchController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/resolve/:code', resolveCode);
router.get('/track', trackCodes);
router.post('/track', trackCodes);
router.get('/track-live', trackUnregisteredContainer);
router.get('/saved-tracking', listSavedTracking);
router.post('/saved-tracking', saveUnregisteredTracking);
router.delete('/saved-tracking/:containerNumber', deleteSavedTracking);
router.get('/', globalSearch);

export default router;
