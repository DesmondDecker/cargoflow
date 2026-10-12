import { Router } from 'express';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import { createPayment, submitPaymentTransaction, fetchMyPayments } from '../controllers/paymentController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/', fetchMyPayments);
router.post('/', requireRole('owner', 'admin'), createPayment);
router.post('/:id/submit', requireRole('owner', 'admin'), submitPaymentTransaction);

export default router;
