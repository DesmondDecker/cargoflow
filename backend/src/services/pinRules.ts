export const PIN_REGEX = /^\d{6}$/;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

// Weak PINs people pick first. Rejected so a stolen phone is not one guess away.
const WEAK = new Set(['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '012345', '123123', '121212']);

export function checkPinStrength(pin: string): string | null {
  if (!PIN_REGEX.test(pin)) return 'PIN must be exactly 6 digits.';
  if (WEAK.has(pin)) return 'That PIN is too easy to guess. Choose a different one.';
  return null;
}

export interface LockState {
  failedAttempts: number;
  lockedUntil?: Date;
}

export function isLocked(state: LockState, now = new Date()): boolean {
  return !!state.lockedUntil && state.lockedUntil.getTime() > now.getTime();
}

// Returns the state after one wrong PIN. The fifth wrong try locks the account
// for PIN_LOCK_MINUTES and resets the counter.
export function afterFailure(state: LockState, now = new Date()): LockState {
  const failedAttempts = (state.failedAttempts || 0) + 1;
  if (failedAttempts >= MAX_PIN_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000) };
  }
  return { failedAttempts, lockedUntil: undefined };
}

export const afterSuccess = (): LockState => ({ failedAttempts: 0, lockedUntil: undefined });

// Who may reset whose PIN: never your own through this route (use change-PIN),
// owners reset anyone, admins reset staff only.
export function canResetPin(actor: { id: string; role: string }, target: { id: string; role: string }): string | null {
  if (actor.id === target.id) return 'Use "Change my PIN" for your own PIN.';
  if (actor.role === 'owner') return null;
  if (actor.role === 'admin' && target.role === 'staff') return null;
  return 'You cannot reset this person\'s PIN.';
}
