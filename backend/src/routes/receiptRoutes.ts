import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/receiptController';

const router = Router();
router.use(requireAgencyAuth);

router.post('/', ctrl.generateReceipt);
router.get('/', ctrl.listReceipts);
router.get('/:id', ctrl.getReceipt);

export default router;
