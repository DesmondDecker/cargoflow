import { describe, it, expect } from 'vitest';
import { checkPinStrength, afterFailure, afterSuccess, isLocked, canResetPin, MAX_PIN_ATTEMPTS } from './pinRules';

describe('checkPinStrength', () => {
  it('accepts a normal 6-digit PIN', () => expect(checkPinStrength('482913')).toBeNull());
  it('rejects wrong length and non-digits', () => {
    expect(checkPinStrength('1234')).not.toBeNull();
    expect(checkPinStrength('12345a')).not.toBeNull();
  });
  it('rejects common weak PINs', () => {
    expect(checkPinStrength('123456')).not.toBeNull();
    expect(checkPinStrength('000000')).not.toBeNull();
  });
});

describe('lockout', () => {
  it('locks on the fifth wrong attempt then resets the counter', () => {
    let state = afterSuccess();
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      state = afterFailure(state);
      expect(isLocked(state)).toBe(false);
    }
    state = afterFailure(state);
    expect(isLocked(state)).toBe(true);
    expect(state.failedAttempts).toBe(0);
  });
  it('unlocks after the lock time passes', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    let state = afterSuccess();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) state = afterFailure(state, now);
    expect(isLocked(state, new Date(now.getTime() + 10 * 60 * 1000))).toBe(true);
    expect(isLocked(state, new Date(now.getTime() + 16 * 60 * 1000))).toBe(false);
  });
});

describe('canResetPin', () => {
  it('owner resets anyone else, admin only staff, staff nobody', () => {
    expect(canResetPin({ id: 'a', role: 'owner' }, { id: 'b', role: 'admin' })).toBeNull();
    expect(canResetPin({ id: 'a', role: 'admin' }, { id: 'b', role: 'staff' })).toBeNull();
    expect(canResetPin({ id: 'a', role: 'admin' }, { id: 'b', role: 'owner' })).not.toBeNull();
    expect(canResetPin({ id: 'a', role: 'staff' }, { id: 'b', role: 'staff' })).not.toBeNull();
    expect(canResetPin({ id: 'a', role: 'owner' }, { id: 'a', role: 'owner' })).not.toBeNull();
  });
});
