import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { getAgencySettings, updateAgencyProfile, updateAgencyLabels, listKnownCarriers, listDemurrageTerms, upsertDemurrageTerm, deleteDemurrageTerm, listFeaturedListings } from '../controllers/agencyController';

const router = Router();
router.get('/', requireAgencyAuth, getAgencySettings);
router.patch('/profile', requireAgencyAuth, updateAgencyProfile);
router.patch('/labels', requireAgencyAuth, updateAgencyLabels);
router.get('/featured-listings', requireAgencyAuth, listFeaturedListings);

router.get('/known-carriers', requireAgencyAuth, listKnownCarriers);
router.get('/demurrage-terms', requireAgencyAuth, listDemurrageTerms);
router.put('/demurrage-terms', requireAgencyAuth, upsertDemurrageTerm);
router.delete('/demurrage-terms/:id', requireAgencyAuth, deleteDemurrageTerm);

export default router;
