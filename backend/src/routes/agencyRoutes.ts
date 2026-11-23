import { Router } from 'express';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import { listAgencyUsers, updateAgencyUser } from '../controllers/agencyUsersController';
import { resetUserPin } from '../controllers/authController';
import { getAgencySettings, updateAgencyProfile, updateAgencyLabels, updateAgencyRules, listKnownCarriers, listDemurrageTerms, upsertDemurrageTerm, deleteDemurrageTerm, listFeaturedListings } from '../controllers/agencyController';

const router = Router();
router.get('/', requireAgencyAuth, getAgencySettings);
router.patch('/rules', requireAgencyAuth, requireRole('owner', 'admin'), updateAgencyRules);
router.patch('/profile', requireAgencyAuth, updateAgencyProfile);
router.patch('/labels', requireAgencyAuth, updateAgencyLabels);
router.get('/featured-listings', requireAgencyAuth, listFeaturedListings);

// Team management: owners and admins; the rules for who can change whom are in services/agencyUserRules.ts.
router.get('/users', requireAgencyAuth, requireRole('owner', 'admin'), listAgencyUsers);
router.patch('/users/:id/pin', requireAgencyAuth, requireRole('owner', 'admin'), resetUserPin);
router.patch('/users/:id', requireAgencyAuth, requireRole('owner', 'admin'), updateAgencyUser);

router.get('/known-carriers', requireAgencyAuth, listKnownCarriers);
router.get('/demurrage-terms', requireAgencyAuth, listDemurrageTerms);
router.put('/demurrage-terms', requireAgencyAuth, upsertDemurrageTerm);
router.delete('/demurrage-terms/:id', requireAgencyAuth, deleteDemurrageTerm);

export default router;
