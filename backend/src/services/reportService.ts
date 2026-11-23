// The numbers on an agency's reports. Pure functions over plain records so
// they can be tested without a database. Money is never added across
// currencies: each currency gets its own total, as everywhere else in the app.

export interface ReportContainer {
  status: string;
  shippingLine?: string;
  attentionLevel: string;
  createdAt: Date;
}

export interface ContainerReport {
  total: number;
  open: number;
  addedInPeriod: number;
  byStatus: { status: string; count: number }[];
  byCarrier: { carrier: string; count: number }[];
  attention: { urgent: number; attention: number; normal: number };
}

export function summarizeContainers(list: ReportContainer[], terminalStatuses: string[], since?: Date): ContainerReport {
  const status = new Map<string, number>();
  const carrier = new Map<string, number>();
  const attention = { urgent: 0, attention: 0, normal: 0 };
  let open = 0;
  let addedInPeriod = 0;

  for (const c of list) {
    status.set(c.status, (status.get(c.status) ?? 0) + 1);
    const line = c.shippingLine || 'Not set';
    carrier.set(line, (carrier.get(line) ?? 0) + 1);
    if (!terminalStatuses.includes(c.status)) {
      open += 1;
      if (c.attentionLevel === 'urgent') attention.urgent += 1;
      else if (c.attentionLevel === 'attention') attention.attention += 1;
      else attention.normal += 1;
    }
    if (!since || c.createdAt >= since) addedInPeriod += 1;
  }

  return {
    total: list.length,
    open,
    addedInPeriod,
    byStatus: Array.from(status, ([s, count]) => ({ status: s, count })).sort((a, b) => b.count - a.count),
    byCarrier: Array.from(carrier, ([c, count]) => ({ carrier: c, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    attention,
  };
}

export interface ReportExpense {
  category: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FinanceReport {
  byCurrency: { currency: string; approved: number; pending: number; rejected: number; count: number }[];
  approvedByCategory: { currency: string; category: string; total: number }[];
}

const money = (n: number) => Math.round(n * 100) / 100;

export function summarizeExpenses(list: ReportExpense[]): FinanceReport {
  const totals = new Map<string, { currency: string; approved: number; pending: number; rejected: number; count: number }>();
  const categories = new Map<string, { currency: string; category: string; total: number }>();

  for (const e of list) {
    const row = totals.get(e.currency) ?? { currency: e.currency, approved: 0, pending: 0, rejected: 0, count: 0 };
    row[e.status] += e.amount;
    row.count += 1;
    totals.set(e.currency, row);
    if (e.status === 'approved') {
      const key = `${e.currency}|${e.category}`;
      const cat = categories.get(key) ?? { currency: e.currency, category: e.category, total: 0 };
      cat.total += e.amount;
      categories.set(key, cat);
    }
  }

  return {
    byCurrency: Array.from(totals.values()).map((r) => ({ ...r, approved: money(r.approved), pending: money(r.pending), rejected: money(r.rejected) })),
    approvedByCategory: Array.from(categories.values()).map((c) => ({ ...c, total: money(c.total) })).sort((a, b) => b.total - a.total),
  };
}

// "7", "30", "90", "365" or "all" from the app; anything else means 30 days.
export function periodStart(days: unknown, now: Date = new Date()): Date | undefined {
  if (days === 'all') return undefined;
  const n = Number(days);
  const span = [7, 30, 90, 365].includes(n) ? n : 30;
  return new Date(now.getTime() - span * 86400000);
}
