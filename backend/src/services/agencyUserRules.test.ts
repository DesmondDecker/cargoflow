import { describe, it, expect } from 'vitest';
import { checkUserChange } from './agencyUserRules';

const owner = { id: 'o1', role: 'owner' as const };
const admin = { id: 'a1', role: 'admin' as const };
const staff = (id = 's1', isActive = true) => ({ id, role: 'staff' as const, isActive });

describe('checkUserChange', () => {
  it('lets an owner change a staff member\'s role and access', () => {
    expect(checkUserChange(owner, staff(), { role: 'admin' }, 1)).toBeNull();
    expect(checkUserChange(owner, staff(), { isActive: false }, 1)).toBeNull();
  });
  it('stops anyone changing themselves', () => {
    expect(checkUserChange(owner, { id: 'o1', role: 'owner', isActive: true }, { isActive: false }, 2)).toContain('your own');
  });
  it('only owners change roles', () => {
    expect(checkUserChange(admin, staff(), { role: 'admin' }, 1)).toContain('Only an owner');
  });
  it('lets admins deactivate staff but not admins or owners', () => {
    expect(checkUserChange(admin, staff(), { isActive: false }, 1)).toBeNull();
    expect(checkUserChange(admin, { id: 'a2', role: 'admin', isActive: true }, { isActive: false }, 1)).toContain('only change access for staff');
    expect(checkUserChange(admin, { id: 'o2', role: 'owner', isActive: true }, { isActive: false }, 2)).toContain('only change access for staff');
  });
  it('keeps at least one active owner', () => {
    const other = { id: 'o2', role: 'owner' as const, isActive: true };
    expect(checkUserChange(owner, other, { role: 'admin' }, 1)).toContain('at least one active owner');
    expect(checkUserChange(owner, other, { isActive: false }, 1)).toContain('at least one active owner');
    expect(checkUserChange(owner, other, { role: 'admin' }, 2)).toBeNull();
  });
  it('lets staff change nothing', () => {
    expect(checkUserChange({ id: 's9', role: 'staff' }, staff(), { isActive: false }, 1)).toContain('cannot change access');
  });
  it('rejects an empty change', () => {
    expect(checkUserChange(owner, staff(), {}, 1)).toBe('Nothing to change');
  });
});
