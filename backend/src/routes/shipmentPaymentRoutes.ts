import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/shipmentPaymentController';

const router = Router();
router.use(requireAgencyAuth);

router.post('/', ctrl.recordPayment);
router.get('/', ctrl.listPayments);
router.get('/:id', ctrl.getPayment);

export default router;
