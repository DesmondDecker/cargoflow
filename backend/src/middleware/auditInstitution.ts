import { Request, Response, NextFunction } from 'express';
import { CustomsSubmissionModel } from '../models/CustomsSubmission';
import { InstitutionUserModel } from '../models/InstitutionUser';
import { buildDetail, describeInstitutionRoute, recordInstitutionEvent } from '../services/institutionAudit';

// Mounted at the top of the customs and institution routers. Once the response
// has gone out, every request by a signed-in Customs/AGL user is written to the
// supervisors' log, including ones that failed (a refused approve, a bad
// request). Requests from agents or with no valid institution login have no
// institution user and are skipped here; sign-in attempts and refused access are
// recorded where they happen.
export function auditInstitutionActions(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const userId = req.auth?.institutionUserId;
    if (!userId || !req.route) return;
    const { action, log } = describeInstitutionRoute(req.method, req.route.path);
    if (!log) return;
    (async () => {
      const [user, submission] = await Promise.all([
        InstitutionUserModel.findById(userId).select('name email'),
        /^(record|approved)\./.test(action) && /^[a-f0-9]{24}$/i.test(req.params.id ?? '')
          ? CustomsSubmissionModel.findById(req.params.id).select('containerNumber cvcNumber approvalReference')
          : null,
      ]);
      await recordInstitutionEvent({
        institutionUserId: userId,
        userName: user?.name ?? 'Unknown',
        email: user?.email,
        institution: req.auth?.institution,
        action,
        outcome: res.statusCode < 400 ? 'ok' : res.statusCode === 403 ? 'denied' : 'failed',
        statusCode: res.statusCode,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        targetId: req.params.id,
        targetLabel: submission ? `${submission.containerNumber} · CVC ${submission.cvcNumber}` : undefined,
        detail: buildDetail(action, req.body, submission),
        req,
      });
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[institution-audit] failed', err);
    });
  });
  next();
}
