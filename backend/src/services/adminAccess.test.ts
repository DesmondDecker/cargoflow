import { describe, it, expect } from 'vitest';
import { adminCan, effectiveRole, checkAdminChange } from './adminAccess';

describe('adminCan', () => {
  it('treats a missing role as super_admin so old accounts keep working', () => {
    expect(effectiveRole(undefined)).toBe('super_admin');
    expect(adminCan(undefined, 'admins', true)).toBe(true);
  });
  it('only super_admin touches admins, audit log and gateway devices', () => {
    for (const area of ['admins', 'audit', 'devices'] as const) {
      expect(adminCan('super_admin', area, true)).toBe(true);
      for (const r of ['finance', 'support', 'viewer']) {
        expect(adminCan(r, area, false)).toBe(false);
        expect(adminCan(r, area, true)).toBe(false);
      }
    }
  });
  it('finance writes finance, support writes support, nobody else crosses over', () => {
    expect(adminCan('finance', 'finance', true)).toBe(true);
    expect(adminCan('finance', 'support', true)).toBe(false);
    expect(adminCan('support', 'support', true)).toBe(true);
    expect(adminCan('support', 'finance', true)).toBe(false);
    expect(adminCan('viewer', 'finance', true)).toBe(false);
    expect(adminCan('viewer', 'support', true)).toBe(false);
  });
  it('every role can read the general, finance and support areas', () => {
    for (const r of ['finance', 'support', 'viewer']) {
      for (const area of ['general', 'finance', 'support'] as const) expect(adminCan(r, area, false)).toBe(true);
    }
  });
  it('an unrecognised role string gets the least privilege', () => {
    expect(effectiveRole('root')).toBe('viewer');
    expect(adminCan('root', 'finance', true)).toBe(false);
  });
});

describe('checkAdminChange', () => {
  const target = { id: 't', role: 'super_admin', isActive: true };
  it('blocks self changes', () => expect(checkAdminChange('t', target, { role: 'viewer' }, 2)).not.toBeNull());
  it('blocks demoting or deactivating the last super admin', () => {
    expect(checkAdminChange('a', target, { role: 'viewer' }, 1)).not.toBeNull();
    expect(checkAdminChange('a', target, { isActive: false }, 1)).not.toBeNull();
  });
  it('allows it when another super admin remains', () => expect(checkAdminChange('a', target, { role: 'viewer' }, 2)).toBeNull());
});
