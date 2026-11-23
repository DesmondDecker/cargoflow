import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { PlatformAdminModel } from '../models/PlatformAdmin';
import { adminCan, AdminArea, effectiveRole } from '../services/adminAccess';

export async function requirePlatformAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    if (payload.aud !== 'admin-app') throw AppError.unauthorized('Wrong token type for this endpoint');

    const admin = await PlatformAdminModel.findById(payload.sub);
    if (!admin || !admin.isActive) throw AppError.unauthorized('Admin account is inactive or no longer exists');

    req.auth = { platformAdminId: String(admin._id), platformAdminRole: effectiveRole(admin.role) };
    next();
  } catch (err) {
    next(err);
  }
}

// Role gate, placed after requirePlatformAdminAuth. Reads need no write
// permission; anything but GET/HEAD counts as a write for that area.
export function requireAdminAccess(area: AdminArea) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const isWrite = !(req.method === 'GET' || req.method === 'HEAD');
    if (!adminCan(req.auth?.platformAdminRole, area, isWrite)) {
      return next(AppError.forbidden('Your admin role does not allow this action.', 'ADMIN_ROLE_FORBIDDEN'));
    }
    next();
  };
}
