import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/importerController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/', ctrl.fetchImporters);
router.post('/', ctrl.createImporter);
router.get('/:id', ctrl.fetchImporterProfile);

export default router;
