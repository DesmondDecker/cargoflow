import { describe, it, expect } from 'vitest';
import { computeDeadlines } from './deadlineEngine';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeDeadlines', () => {
  it('returns nothing when neither discharged nor arrival date is known', () => {
    const result = computeDeadlines({});
    expect(result).toEqual([]);
  });

  it('prefers the discharged date over arrival as the start event when both are present', () => {
    const discharged = new Date('2026-01-10T00:00:00Z');
    const arrival = new Date('2026-01-05T00:00:00Z'); // earlier, but discharged should still win
    const [freeStorage] = computeDeadlines({ discharged, arrival }, new Date('2026-01-11T00:00:00Z'));
    expect(freeStorage.startEvent).toBe('discharged');
    expect(freeStorage.startDate).toEqual(discharged);
  });

  it('falls back to arrival as the start event when discharged is not yet known', () => {
    const arrival = new Date('2026-01-05T00:00:00Z');
    const [freeStorage] = computeDeadlines({ arrival }, new Date('2026-01-06T00:00:00Z'));
    expect(freeStorage.startEvent).toBe('arrival');
  });

  it('uses the global 4-day / 7-day default when no agency override is given', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z'); // well before either deadline
    const [freeStorage, demurrage] = computeDeadlines({ discharged: start }, now);
    expect(freeStorage.dueDate.getTime()).toBe(start.getTime() + 4 * DAY_MS);
    expect(demurrage.dueDate.getTime()).toBe(start.getTime() + 7 * DAY_MS);
  });

  it('uses the agency override instead of the default when one is given', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z');
    const [freeStorage, demurrage] = computeDeadlines({ discharged: start }, now, { freeStorageDays: 10, demurrageGraceDays: 21 });
    expect(freeStorage.dueDate.getTime()).toBe(start.getTime() + 10 * DAY_MS);
    expect(demurrage.dueDate.getTime()).toBe(start.getTime() + 21 * DAY_MS);
  });

  it('falls back to the default for whichever single field the override omits', () => {
    // A real bug shape this guards against: an agency sets only
    // freeStorageDays for a carrier and leaves demurrageGraceDays unset —
    // that should fall back to the 7-day default, not silently become 0.
    const start = new Date('2026-01-01T00:00:00Z');
    const [, demurrage] = computeDeadlines({ discharged: start }, new Date('2026-01-02T00:00:00Z'), { freeStorageDays: 10 });
    expect(demurrage.dueDate.getTime()).toBe(start.getTime() + 7 * DAY_MS);
  });

  it('marks a deadline expired once "now" has passed it, and pending before', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const justBefore = new Date(start.getTime() + 4 * DAY_MS - 1000);
    const justAfter = new Date(start.getTime() + 4 * DAY_MS + 1000);

    const [beforeFreeStorage] = computeDeadlines({ discharged: start }, justBefore);
    expect(beforeFreeStorage.status).toBe('pending');

    const [afterFreeStorage] = computeDeadlines({ discharged: start }, justAfter);
    expect(afterFreeStorage.status).toBe('expired');
  });
});
