import { Request } from 'express';
import { InstitutionAuditLogModel, InstitutionAuditOutcome } from '../models/InstitutionAuditLog';

// What each portal route means in plain terms, for the supervisors' log.
// `log: false` skips routes the portal calls on a timer (lists, "who am I"),
// which would bury the entries that matter. A route not listed here is still
// logged, under "METHOD /path", so a new endpoint is covered automatically.
const ROUTES: Record<string, { action: string; log: boolean }> = {
  'GET /queue': { action: 'queue.list', log: false },
  'POST /queue': { action: 'record.create_assisted', log: true },
  'GET /queue/:id': { action: 'record.view', log: true },
  'POST /queue/:id/approve': { action: 'record.approve', log: true },
  'POST /queue/:id/return': { action: 'record.return', log: true },
  'POST /queue/:id/resend-email': { action: 'record.resend_email', log: true },
  'GET /approved.csv': { action: 'approved.export_csv', log: true },
  'GET /approved': { action: 'approved.list', log: false },
  'GET /approved/:id': { action: 'approved.view', log: true },
  'GET /reports/summary': { action: 'report.view', log: true },
  'GET /auth/me': { action: 'auth.me', log: false },
  'POST /auth/logout': { action: 'auth.logout', log: true },
  'PATCH /auth/password': { action: 'auth.change_password', log: true },
  'GET /oversight/log': { action: 'oversight.view_log', log: true },
  'GET /oversight/log.csv': { action: 'oversight.export_log', log: true },
  'GET /oversight/staff': { action: 'oversight.view_staff', log: false },
};

export function describeInstitutionRoute(method: string, routePath: string): { action: string; log: boolean } {
  return ROUTES[`${method} ${routePath}`] ?? { action: `${method} ${routePath}`, log: true };
}

const cut = (v: unknown, n = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

// A short readable note for the entry. Only whitelisted fields from the request
// are ever kept: the log never stores a password or the full body.
export function buildDetail(action: string, body: Record<string, unknown> | undefined, submission?: { approvalReference?: string } | null): string | undefined {
  const b = body ?? {};
  if (action === 'record.return') return cut(b.reason) ? `Reason: ${cut(b.reason)}` : undefined;
  if (action === 'record.approve') return submission?.approvalReference ? `Reference ${submission.approvalReference}` : undefined;
  if (action === 'record.create_assisted') {
    const parts = [cut(b.onBehalfOf, 80) && `for ${cut(b.onBehalfOf, 80)}`, cut(b.containerNumber, 30), cut(b.cvcNumber, 30) && `CVC ${cut(b.cvcNumber, 30)}`].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }
  return undefined;
}

export interface InstitutionEvent {
  institutionUserId?: string;
  userName: string;
  email?: string;
  institution?: 'customs' | 'agl';
  action: string;
  outcome: InstitutionAuditOutcome;
  statusCode?: number;
  method?: string;
  path?: string;
  targetId?: string;
  targetLabel?: string;
  detail?: string;
  req?: Request;
}

// Never throws: logging must not break the request it records.
export async function recordInstitutionEvent(e: InstitutionEvent): Promise<void> {
  try {
    await InstitutionAuditLogModel.create({
      institutionUserId: e.institutionUserId,
      userName: e.userName,
      email: cut(e.email),
      institution: e.institution,
      action: e.action,
      outcome: e.outcome,
      statusCode: e.statusCode,
      method: e.method,
      path: e.path,
      targetId: e.targetId,
      targetLabel: e.targetLabel,
      detail: e.detail,
      ip: e.req?.ip,
      userAgent: cut(e.req?.headers['user-agent']),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[institution-audit] could not write entry', err);
  }
}
