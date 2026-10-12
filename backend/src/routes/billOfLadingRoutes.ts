import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { createBillOfLading, fetchBillsOfLading } from '../controllers/billOfLadingController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/', fetchBillsOfLading);
router.post('/', createBillOfLading);

export default router;
