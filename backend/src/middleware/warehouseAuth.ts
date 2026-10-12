import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { WarehouseModel } from '../models/Warehouse';

export async function requireWarehouseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    if (payload.aud !== 'warehouse-app') throw AppError.unauthorized('Wrong token type for this endpoint');

    const warehouse = await WarehouseModel.findById(payload.sub);
    if (!warehouse || !warehouse.isActive) throw AppError.unauthorized('Warehouse account is inactive or no longer exists');

    req.auth = { warehouseId: String(warehouse._id) };
    next();
  } catch (err) {
    next(err);
  }
}
