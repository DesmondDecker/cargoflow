import { Router } from 'express';
import { requireWarehouseAuth } from '../middleware/warehouseAuth';
import { authRateLimiter } from '../middleware/rateLimit';
import { warehouseSignup, warehouseLogin, warehouseRefresh, warehouseMe } from '../controllers/warehouseAuthController';
import * as ctrl from '../controllers/warehouseController';

const router = Router();

router.post('/auth/signup', authRateLimiter, warehouseSignup);
router.post('/auth/login', authRateLimiter, warehouseLogin);
router.post('/auth/refresh', warehouseRefresh);

router.get('/me', requireWarehouseAuth, warehouseMe);
router.get('/profile', requireWarehouseAuth, ctrl.getMyProfile);
router.patch('/listing', requireWarehouseAuth, ctrl.updateListing);
router.patch('/capacity', requireWarehouseAuth, ctrl.updateCapacity);
router.post('/photos', requireWarehouseAuth, ctrl.addPhotos);
router.post('/upload-url', requireWarehouseAuth, ctrl.getWarehouseUploadUrl);

router.get('/bookings', requireWarehouseAuth, ctrl.getMyBookings);
router.get('/bookings/:id', requireWarehouseAuth, ctrl.getBookingDetail);
router.post('/bookings/:id/respond', requireWarehouseAuth, ctrl.respondToBooking);
router.post('/bookings/:id/check-in', requireWarehouseAuth, ctrl.checkInBooking);
router.post('/bookings/:id/check-out', requireWarehouseAuth, ctrl.checkOutBooking);

export default router;
