import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import * as ctrl from '../controllers/containerController';
import * as transportCtrl from '../controllers/driverController';
import * as storageCtrl from '../controllers/warehouseController';

const router = Router();

router.use(requireAgencyAuth);

router.get('/dashboard', ctrl.fetchDashboardStats);
router.get('/', ctrl.fetchContainers);
router.post('/', ctrl.createContainer);
router.get('/:id', ctrl.fetchContainerCaseFile);
router.patch('/:id/details', ctrl.updateContainerDetails);
router.patch('/:id/status', ctrl.changeContainerStatus);
router.patch('/:id/dates', ctrl.updateContainerDates);
router.patch('/:id/shipping-line', ctrl.setShippingLine);
router.post('/:id/refresh-tracking', ctrl.refreshContainerTracking);

router.get('/:id/transport/candidates', transportCtrl.fetchCandidateDrivers);
router.post('/:id/transport/assign', transportCtrl.assignDriver);

router.get('/:id/storage/candidates', storageCtrl.fetchCandidateWarehouses);
router.post('/:id/storage/book', storageCtrl.bookWarehouse);

export default router;
