import { describe, it, expect } from 'vitest';
import { describeInstitutionRoute, buildDetail } from './institutionAudit';

describe('describeInstitutionRoute', () => {
  it('names decisions and exports, and keeps them logged', () => {
    expect(describeInstitutionRoute('POST', '/queue/:id/approve')).toEqual({ action: 'record.approve', log: true });
    expect(describeInstitutionRoute('POST', '/queue/:id/return')).toEqual({ action: 'record.return', log: true });
    expect(describeInstitutionRoute('GET', '/approved.csv')).toEqual({ action: 'approved.export_csv', log: true });
    expect(describeInstitutionRoute('GET', '/queue/:id')).toEqual({ action: 'record.view', log: true });
  });
  it('skips timer-driven lists but not individual views', () => {
    expect(describeInstitutionRoute('GET', '/queue').log).toBe(false);
    expect(describeInstitutionRoute('GET', '/approved').log).toBe(false);
    expect(describeInstitutionRoute('GET', '/approved/:id').log).toBe(true);
  });
  it('logs a route nobody listed, so new endpoints are covered', () => {
    expect(describeInstitutionRoute('DELETE', '/queue/:id')).toEqual({ action: 'DELETE /queue/:id', log: true });
  });
});

describe('buildDetail', () => {
  it('keeps the return reason, trimmed and capped', () => {
    expect(buildDetail('record.return', { reason: '  Wrong ITS number  ' })).toBe('Reason: Wrong ITS number');
    expect(buildDetail('record.return', { reason: 'x'.repeat(500) })!.length).toBeLessThanOrEqual(210);
  });
  it('records the approval reference', () => {
    expect(buildDetail('record.approve', {}, { approvalReference: 'APR-1' })).toBe('Reference APR-1');
  });
  it('never copies a password or other fields', () => {
    expect(buildDetail('auth.change_password', { currentPassword: 'a', newPassword: 'b' })).toBeUndefined();
    expect(buildDetail('record.create_assisted', { onBehalfOf: 'Kamara', containerNumber: 'MSKU1234567', itsNumber: 'secret-ish' })).toBe('for Kamara · MSKU1234567');
  });
});
