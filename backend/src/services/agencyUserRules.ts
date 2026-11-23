export type Role = 'owner' | 'admin' | 'staff';

export interface Actor {
  id: string;
  role: Role;
}

export interface Target {
  id: string;
  role: Role;
  isActive: boolean;
}

export interface Change {
  role?: Role;
  isActive?: boolean;
}

// Who can change whom in an agency. Returns a message when the change is not
// allowed, or null when it is. Written to make two things impossible: locking
// yourself out, and leaving an agency with no active owner.
//   - Nobody changes their own role or active state.
//   - Only an owner changes roles.
//   - Owners can deactivate or reactivate anyone; admins only staff.
//   - The last active owner can be neither demoted nor deactivated.
export function checkUserChange(actor: Actor, target: Target, change: Change, activeOwners: number): string | null {
  if (change.role === undefined && change.isActive === undefined) return 'Nothing to change';
  if (actor.id === target.id) return 'You cannot change your own role or access. Ask another owner or admin.';

  if (change.role !== undefined && change.role !== target.role) {
    if (actor.role !== 'owner') return 'Only an owner can change roles.';
    if (target.role === 'owner' && target.isActive && activeOwners <= 1) return 'The agency must keep at least one active owner.';
  }

  if (change.isActive !== undefined && change.isActive !== target.isActive) {
    if (actor.role === 'staff') return 'Staff cannot change access.';
    if (actor.role === 'admin' && target.role !== 'staff') return 'Admins can only change access for staff.';
    if (!change.isActive && target.role === 'owner' && target.isActive && activeOwners <= 1) return 'The agency must keep at least one active owner.';
  }

  return null;
}
