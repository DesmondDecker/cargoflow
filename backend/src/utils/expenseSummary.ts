export type ExpenseStatusKey = 'pending' | 'approved' | 'rejected';

export function summarizeExpenseStatuses(items: Array<{ status?: string; amount?: number }>) {
  const buckets: Record<ExpenseStatusKey, { count: number; total: number }> = {
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
  };

  for (const item of items) {
    const status = (item.status as ExpenseStatusKey | undefined) ?? 'pending';
    if (!(status in buckets)) continue;

    const bucket = buckets[status];
    const amount = Number(item.amount ?? 0);
    bucket.count += 1;
    bucket.total += Number.isFinite(amount) ? amount : 0;
  }

  return {
    pending: buckets.pending,
    approved: buckets.approved,
    rejected: buckets.rejected,
    total: items.length,
  };
}
