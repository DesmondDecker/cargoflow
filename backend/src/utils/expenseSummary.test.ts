import { describe, expect, it } from 'vitest';
import { summarizeExpenseStatuses } from './expenseSummary';

describe('summarizeExpenseStatuses', () => {
  it('groups expense claims by status and totals the submitted amount for each bucket', () => {
    const summary = summarizeExpenseStatuses([
      { status: 'pending', amount: 200 },
      { status: 'pending', amount: 150 },
      { status: 'approved', amount: 500 },
      { status: 'rejected', amount: 75 },
      { status: 'approved', amount: 125 },
    ]);

    expect(summary).toEqual({
      pending: { count: 2, total: 350 },
      approved: { count: 2, total: 625 },
      rejected: { count: 1, total: 75 },
      total: 5,
    });
  });
});
