import { Router } from 'express';
import authRoutes from './authRoutes';
import platformAdminRoutes from './platformAdminRoutes';
import driverRoutes from './driverRoutes';
import transportRoutes from './transportRoutes';
import warehouseRoutes from './warehouseRoutes';
import storageRoutes from './storageRoutes';
import containerRoutes from './containerRoutes';
import documentRoutes from './documentRoutes';
import importerRoutes from './importerRoutes';
import reportRoutes from './reportRoutes';
import agencyRoutes from './agencyRoutes';
import searchRoutes from './searchRoutes';
import billOfLadingRoutes from './billOfLadingRoutes';
import paymentRoutes from './paymentRoutes';
import gatewayRoutes from './gatewayRoutes';
import expenseRoutes from './expenseRoutes';
import shipmentPaymentRoutes from './shipmentPaymentRoutes';
import receiptRoutes from './receiptRoutes';

const router = Router();

// Agency-app (cargoflow-mobile)
router.use('/auth', authRoutes);
router.use('/containers', containerRoutes);
router.use('/documents', documentRoutes);
router.use('/importers', importerRoutes);
router.use('/reports', reportRoutes);
router.use('/agency', agencyRoutes);
router.use('/search', searchRoutes);
router.use('/bills-of-lading', billOfLadingRoutes);
router.use('/payments', paymentRoutes);
router.use('/transport', transportRoutes);
router.use('/storage', storageRoutes);
// CargoFlow Finance — deliberately NOT under /payments, which is agency
// subscription billing (see ShipmentPayment's own comment on why these stay
// separate models and separate routes).
router.use('/finance/expenses', expenseRoutes);
router.use('/finance/payments', shipmentPaymentRoutes);
router.use('/finance/receipts', receiptRoutes);

// Driver-app (cargoflow-driver)
router.use('/driver', driverRoutes);

// Warehouse-owner-app (reuses driver-app's shape; no separate mobile app yet)
router.use('/warehouse', warehouseRoutes);

// Admin-app (cargoflow-admin)
router.use('/platform-admin', platformAdminRoutes);

// Unattended gateway devices (SMS forwarding)
router.use('/gateway', gatewayRoutes);

export default router;
