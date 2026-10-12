import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { PlatformAdminModel } from '../models/PlatformAdmin';

export async function requirePlatformAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    if (payload.aud !== 'admin-app') throw AppError.unauthorized('Wrong token type for this endpoint');

    const admin = await PlatformAdminModel.findById(payload.sub);
    if (!admin || !admin.isActive) throw AppError.unauthorized('Admin account is inactive or no longer exists');

    req.auth = { platformAdminId: String(admin._id) };
    next();
  } catch (err) {
    next(err);
  }
}
