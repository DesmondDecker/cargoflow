import { describe, it, expect } from 'vitest';
import { weeklyCounts } from './adoptionService';

describe('weeklyCounts', () => {
  const now = new Date('2026-10-30T12:00:00Z'); // a Friday; its Monday is 2026-10-26
  it('buckets by Monday-start week, oldest first, including empty weeks', () => {
    const r = weeklyCounts([new Date('2026-10-26T00:00:00Z'), new Date('2026-10-30T10:00:00Z'), new Date('2026-10-19T08:00:00Z'), new Date('2026-10-05T08:00:00Z')], 4, now);
    expect(r).toEqual([
      { weekStart: '2026-10-05', count: 1 },
      { weekStart: '2026-10-12', count: 0 },
      { weekStart: '2026-10-19', count: 1 },
      { weekStart: '2026-10-26', count: 2 },
    ]);
  });
  it('ignores dates outside the window', () => {
    expect(weeklyCounts([new Date('2025-01-01T00:00:00Z')], 3, now).every((w) => w.count === 0)).toBe(true);
  });
  it('puts a Sunday in the week that started the Monday before', () => {
    expect(weeklyCounts([new Date('2026-10-25T23:00:00Z')], 2, now)[0]).toEqual({ weekStart: '2026-10-19', count: 1 });
  });
});
