import { Router } from 'express';
import { requireGatewayApiKey } from '../middleware/gatewayAuth';
import { ingestSmsNotification } from '../controllers/gatewayController';

const router = Router();
router.post('/sms-notifications', requireGatewayApiKey, ingestSmsNotification);

export default router;
