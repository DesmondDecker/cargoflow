import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { InstitutionUserModel, Institution } from '../models/InstitutionUser';
import { recordInstitutionEvent } from '../services/institutionAudit';

// Customs and AGL staff signed in to the institution portal. `allowed` limits
// a route to one institution: the Customs review queue is closed to AGL, and
// AGL's view is read-only. The account is re-checked on every request, so a
// deactivated officer loses access at once, not when the token expires.
export function requireInstitutionAuth(...allowed: Institution[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or malformed Authorization header');
      const payload = verifyAccessToken(header.slice('Bearer '.length));
      if (payload.aud !== 'institution-portal') throw AppError.unauthorized('Wrong token type for this endpoint');

      const user = await InstitutionUserModel.findById(payload.sub);
      if (!user || !user.isActive) throw AppError.unauthorized('Account is inactive or no longer exists');
      if (allowed.length > 0 && !allowed.includes(user.institution)) {
        // Signed in, but reaching for something that belongs to the other institution: supervisors want to see this.
        await recordInstitutionEvent({
          institutionUserId: String(user._id),
          userName: user.name,
          email: user.email,
          institution: user.institution,
          action: 'access.denied',
          outcome: 'denied',
          statusCode: 403,
          method: req.method,
          path: req.originalUrl.split('?')[0],
          req,
        });
        throw AppError.forbidden('Your institution does not have access to this');
      }

      req.auth = { institutionUserId: String(user._id), institution: user.institution, institutionSupervisor: !!user.isSupervisor };
      next();
    } catch (err) {
      next(err);
    }
  };
}

// For the oversight routes: a signed-in institution user who a platform admin has made a supervisor.
export async function requireSupervisor(req: Request, res: Response, next: NextFunction) {
  await requireInstitutionAuth()(req, res, async (err?: unknown) => {
    if (err) return next(err);
    // The refused attempt is logged by auditInstitutionActions (outcome 'denied'), so it is not written twice here.
    if (!req.auth?.institutionSupervisor) return next(AppError.forbidden('Supervisor access only', 'SUPERVISOR_ONLY'));
    next();
  });
}
