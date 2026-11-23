import { describe, it, expect } from 'vitest';
import { periodStart, summarizeContainers, summarizeExpenses } from './reportService';

const d = (iso: string) => new Date(iso);

describe('summarizeContainers', () => {
  const list = [
    { status: 'In Transit', shippingLine: 'Maersk', attentionLevel: 'normal', createdAt: d('2026-10-20') },
    { status: 'Arrived', shippingLine: 'Maersk', attentionLevel: 'urgent', createdAt: d('2026-09-01') },
    { status: 'Under Clearance', shippingLine: 'MSC', attentionLevel: 'attention', createdAt: d('2026-10-25') },
    { status: 'Delivered', shippingLine: undefined, attentionLevel: 'normal', createdAt: d('2026-08-01') },
  ];
  it('counts open containers, attention levels (open only), statuses and carriers', () => {
    const r = summarizeContainers(list, ['Delivered', 'Closed'], d('2026-10-01'));
    expect(r).toMatchObject({ total: 4, open: 3, addedInPeriod: 2, attention: { urgent: 1, attention: 1, normal: 1 } });
    expect(r.byCarrier[0]).toEqual({ carrier: 'Maersk', count: 2 });
    expect(r.byCarrier.find((c) => c.carrier === 'Not set')?.count).toBe(1);
    expect(r.byStatus.find((s) => s.status === 'Delivered')?.count).toBe(1);
  });
  it('counts everything as added when there is no period', () => {
    expect(summarizeContainers(list, ['Delivered'], undefined).addedInPeriod).toBe(4);
  });
});

describe('summarizeExpenses', () => {
  it('totals each currency on its own and never mixes them', () => {
    const r = summarizeExpenses([
      { category: 'Transport', amount: 100.1, currency: 'SLE', status: 'approved' },
      { category: 'Transport', amount: 50.2, currency: 'SLE', status: 'approved' },
      { category: 'Storage', amount: 30, currency: 'SLE', status: 'pending' },
      { category: 'Transport', amount: 20, currency: 'USD', status: 'approved' },
      { category: 'Storage', amount: 5, currency: 'USD', status: 'rejected' },
    ]);
    expect(r.byCurrency.find((c) => c.currency === 'SLE')).toEqual({ currency: 'SLE', approved: 150.3, pending: 30, rejected: 0, count: 3 });
    expect(r.byCurrency.find((c) => c.currency === 'USD')).toMatchObject({ approved: 20, rejected: 5 });
    expect(r.approvedByCategory[0]).toEqual({ currency: 'SLE', category: 'Transport', total: 150.3 });
  });
});

describe('periodStart', () => {
  const now = d('2026-10-30T00:00:00Z');
  it('maps the app\'s choices to a start date', () => {
    expect(periodStart('7', now)?.toISOString()).toBe('2026-10-23T00:00:00.000Z');
    expect(periodStart('all', now)).toBeUndefined();
    expect(periodStart('999', now)?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });
});
