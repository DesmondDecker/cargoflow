import { describe, it, expect } from 'vitest';
import { summarizeEarnings } from './earningsService';

const NOW = new Date('2026-10-22T12:00:00Z');
const job = (id: string, fee: number | undefined, daysAgo: number, currency?: string) => ({
  id,
  containerNumber: `C${id}`,
  fee,
  currency,
  completedAt: new Date(NOW.getTime() - daysAgo * 86400000),
});

describe('summarizeEarnings', () => {
  it('totals by period and keeps currencies apart', () => {
    const r = summarizeEarnings(
      [job('1', 100, 1), job('2', 50, 5), job('3', 200, 15), job('4', 300, 40), job('5', 20, 2, 'USD')],
      NOW
    );
    const sle = r.totals.find((t) => t.currency === 'SLE')!;
    expect(sle).toEqual({ currency: 'SLE', week: 150, month: 350, allTime: 650, jobs: 4 });
    expect(r.totals.find((t) => t.currency === 'USD')).toEqual({ currency: 'USD', week: 20, month: 20, allTime: 20, jobs: 1 });
  });

  it('counts delivered jobs with no fee separately', () => {
    const r = summarizeEarnings([job('1', undefined, 1), job('2', 0, 1), job('3', 80, 1)], NOW);
    expect(r.deliveredWithoutFee).toBe(2);
    expect(r.recent).toHaveLength(1);
  });

  it('returns nothing for no jobs', () => {
    expect(summarizeEarnings([], NOW)).toEqual({ totals: [], recent: [], deliveredWithoutFee: 0 });
  });
});
