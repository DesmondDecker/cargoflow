import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { UserModel, UserRole } from '../models/User';
import { AgencyModel } from '../models/Agency';

function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }
  return header.slice('Bearer '.length);
}

// Verifies an agency-app access token, confirms the user + agency are still
// active (a deactivated staff member or suspended agency loses access
// immediately, not just at next token expiry), and attaches req.auth.
export async function requireAgencyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    const payload = verifyAccessToken(token);
    if (payload.aud !== 'agency-app') throw AppError.unauthorized('Wrong token type for this endpoint');

    const user = await UserModel.findById(payload.sub);
    if (!user || !user.isActive) throw AppError.unauthorized('Account is inactive or no longer exists');

    const agency = await AgencyModel.findById(user.agencyId);
    if (!agency || !agency.isActive) throw AppError.forbidden('Agency account is suspended', 'AGENCY_SUSPENDED');
    if (agency.subscription.status === 'expired' || agency.subscription.status === 'canceled') {
      throw AppError.forbidden('Agency subscription is inactive', 'SUBSCRIPTION_INACTIVE');
    }

    req.auth = { userId: String(user._id), agencyId: String(user.agencyId), role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) {
      return next(AppError.forbidden('You do not have permission to do this'));
    }
    next();
  };
}
