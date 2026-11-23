import { Request, Response, NextFunction } from 'express';
import { AdminAuditLogModel } from '../models/AdminAuditLog';
import { PlatformAdminModel } from '../models/PlatformAdmin';
import { sanitizeForAudit } from '../services/adminAudit';

// Mounted at the top of the admin router. Once the response has gone out, every
// successful change (anything but GET) by an authenticated admin is written to
// the audit log. Unauthenticated calls (login) have no admin and are skipped.
// Logging never delays or breaks the request it records.
export function auditAdminActions(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.auth?.platformAdminId) return;
    (async () => {
      const admin = await PlatformAdminModel.findById(req.auth!.platformAdminId).select('name');
      await AdminAuditLogModel.create({
        adminId: req.auth!.platformAdminId,
        adminName: admin?.name || 'Admin',
        method: req.method,
        route: `${req.baseUrl}${req.route?.path ?? ''}`,
        path: req.originalUrl.split('?')[0],
        summary: sanitizeForAudit(req.body ?? {}) as Record<string, unknown>,
        statusCode: res.statusCode,
      });
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[audit] could not write admin audit entry', err);
    });
  });
  next();
}
