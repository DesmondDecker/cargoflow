// Platform-admin roles. Every admin used to have every power; now each role
// only changes what it needs to.
//   super_admin  everything, including other admins, the audit log and gateway phones
//   finance      verifies/rejects payments, approves expenses, edits plans, subscriptions, sponsorships
//   support      agency status/resets, driver and warehouse verification, customs/AGL staff accounts
//   viewer       read-only
// Admins created before roles existed have no role and are treated as super_admin,
// so nobody is locked out by the upgrade.
export const ADMIN_ROLES = ['super_admin', 'finance', 'support', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminArea = 'admins' | 'audit' | 'devices' | 'finance' | 'support' | 'general';

// Missing role (an account from before roles existed) = super_admin. A role
// that is present but unrecognised = viewer, the least privilege.
export function effectiveRole(role?: string | null): AdminRole {
  if (role === undefined || role === null) return 'super_admin';
  return (ADMIN_ROLES as readonly string[]).includes(role) ? (role as AdminRole) : 'viewer';
}

export function adminCan(roleInput: string | null | undefined, area: AdminArea, isWrite: boolean): boolean {
  const role = effectiveRole(roleInput);
  if (role === 'super_admin') return true;
  if (area === 'admins' || area === 'audit' || area === 'devices') return false;
  if (!isWrite) return true;
  if (area === 'finance') return role === 'finance';
  if (area === 'support') return role === 'support';
  return false;
}

// The last active super_admin can be neither demoted nor deactivated.
export function checkAdminChange(
  actorId: string,
  target: { id: string; role: string; isActive: boolean },
  change: { role?: AdminRole; isActive?: boolean },
  activeSuperAdmins: number
): string | null {
  if (actorId === target.id) return 'You cannot change your own role or access.';
  const losesSuper = effectiveRole(target.role) === 'super_admin' && target.isActive && ((change.role !== undefined && change.role !== 'super_admin') || change.isActive === false);
  if (losesSuper && activeSuperAdmins <= 1) return 'There must always be at least one active super admin.';
  return null;
}
