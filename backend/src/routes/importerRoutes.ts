import { Router } from 'express';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/importerController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/', ctrl.fetchImporters);
router.post('/', ctrl.createImporter);
router.get('/:id', ctrl.fetchImporterProfile);
router.patch('/:id', ctrl.updateImporter);

// ID card photos: anyone on the team can add one, only owners and admins can view or remove one.
router.post('/:id/id-card/upload-url', ctrl.createIdCardUploadUrl);
router.post('/:id/id-card', ctrl.saveIdCard);
router.get('/:id/id-card/:side', requireRole('owner', 'admin'), ctrl.getIdCardLink);
router.delete('/:id/id-card/:side', requireRole('owner', 'admin'), ctrl.removeIdCard);

export default router;
