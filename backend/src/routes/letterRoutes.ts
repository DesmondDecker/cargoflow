import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/letterController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/templates', ctrl.listTemplates);
router.get('/:id', ctrl.getLetter);
router.patch('/:id', ctrl.updateLetter);
router.delete('/:id', ctrl.deleteLetter);
router.get('/:id/download', ctrl.downloadLetter);

export default router;
