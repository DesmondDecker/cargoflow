import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { GatewayDeviceModel } from '../models/GatewayDevice';

declare global {
  namespace Express {
    interface Request {
      gatewayDeviceId?: string;
    }
  }
}

// A gateway device authenticates with its own long-lived API key (header),
// not a user/admin JWT — it's an unattended phone/script forwarding SMS, not
// someone logging in interactively.
export async function requireGatewayApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') throw AppError.unauthorized('Missing X-API-Key header');

    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const device = await GatewayDeviceModel.findOne({ apiKeyHash });
    if (!device || !device.isActive) throw AppError.unauthorized('Invalid or deactivated gateway device key');

    device.lastSeenAt = new Date();
    await device.save();

    req.gatewayDeviceId = String(device._id);
    next();
  } catch (err) {
    next(err);
  }
}
