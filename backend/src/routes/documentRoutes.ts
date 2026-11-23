import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/documentController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/', ctrl.fetchDocuments);
router.post('/upload-url', ctrl.requestUploadUrl);
router.post('/', ctrl.registerDocument);
router.get('/:id', ctrl.fetchDocument);
router.post('/:id/review', ctrl.reviewDocument);
router.delete('/:id', ctrl.deleteDocument);

export default router;
