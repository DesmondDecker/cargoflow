import { UserRole } from '../models/User';

// Augments Express's Request with whichever identity a route's auth
// middleware attached — at most one of these is set per request, matching
// which of the three token audiences (agency-app/driver-app/admin-app)
// verified it.
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId?: string;
        agencyId?: string;
        role?: UserRole;
        driverId?: string;
        warehouseId?: string;
        platformAdminId?: string;
      };
    }
  }
}

export {};
