import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { DriverModel } from '../models/Driver';

export async function requireDriverAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    if (payload.aud !== 'driver-app') throw AppError.unauthorized('Wrong token type for this endpoint');

    const driver = await DriverModel.findById(payload.sub);
    if (!driver || !driver.isActive) throw AppError.unauthorized('Driver account is inactive or no longer exists');

    req.auth = { driverId: String(driver._id) };
    next();
  } catch (err) {
    next(err);
  }
}
