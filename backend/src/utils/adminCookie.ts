import { Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from './AppError';

// The platform-admin refresh token lives in an httpOnly cookie so a script
// injected into the admin page (XSS) cannot read it. The short-lived access
// token stays in page memory only (nothing in localStorage).
export const REFRESH_COOKIE = 'cf_admin_rt';
const CSRF_HEADER = 'x-cargoflow-admin';

export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === REFRESH_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function cookieOptions() {
  const production = env.nodeEnv === 'production';
  const sameSite = (process.env.ADMIN_COOKIE_SAMESITE || 'strict').toLowerCase() as 'strict' | 'lax' | 'none';
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers together with Secure.
    secure: production || sameSite === 'none',
    sameSite,
    path: '/',
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000 });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

// A cookie is sent automatically by the browser, so cookie-based endpoints
// also require a custom header. A custom header forces a CORS preflight,
// which only the allowed admin origin passes, so another website cannot
// trigger these calls with the admin's cookie.
export function requireCookieCsrfHeader(req: Request): void {
  if (req.headers[CSRF_HEADER] !== '1') throw AppError.forbidden('Missing request header', 'CSRF_HEADER_MISSING');
}
