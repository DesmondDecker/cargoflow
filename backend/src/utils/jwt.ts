import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './AppError';

// `aud` (audience) is the anti-token-confusion guard: an agency-staff access
// token must not work against a driver-only or platform-admin-only route
// even though all three are signed with the same secret. Every auth
// middleware below verifies `aud` explicitly rather than trusting `scope`
// alone.
export type TokenAudience = 'agency-app' | 'driver-app' | 'admin-app' | 'warehouse-app';

export interface AccessTokenPayload {
  sub: string; // user/driver/admin id
  aud: TokenAudience;
  agencyId?: string; // agency-app only
  role?: string; // agency-app: owner/admin/staff
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.accessTokenSecret, { expiresIn: env.accessTokenTtl } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.accessTokenSecret) as AccessTokenPayload;
  } catch (err) {
    const anyErr = err as { name?: string; message?: string };
    if (anyErr?.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Session expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid or expired session token', 'INVALID_TOKEN');
  }
}
