import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/driverController';

// GET /transport?status&containerId and POST /transport/:id/rate —
// container-scoped candidate search + assign live under containerRoutes
// (mounted at /containers/:id/transport/...) to match cargoflow-mobile's
// transportApi.ts exactly.
const router = Router();

router.get('/', requireAgencyAuth, ctrl.fetchAgencyTransportJobs);
router.post('/:id/rate', requireAgencyAuth, ctrl.rateDriver);

export default router;
