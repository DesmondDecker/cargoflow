import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/warehouseController';

// GET /storage?status&containerId, POST /storage/:id/cancel, POST /storage/:id/rate.
// Container-scoped candidate search + booking creation live under
// containerRoutes (mounted at /containers/:id/storage/...), matching the
// /containers/:id/transport/... pattern used for drivers.
const router = Router();

router.get('/', requireAgencyAuth, ctrl.fetchAgencyWarehouseBookings);
router.post('/:id/cancel', requireAgencyAuth, ctrl.cancelBooking);
router.post('/:id/rate', requireAgencyAuth, ctrl.rateWarehouse);

export default router;
