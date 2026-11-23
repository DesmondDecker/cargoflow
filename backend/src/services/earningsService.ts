export interface EarningsJob {
  id: string;
  containerNumber: string;
  fee?: number;
  currency?: string;
  completedAt: Date;
}

export interface EarningsTotals {
  currency: string;
  week: number;
  month: number;
  allTime: number;
  jobs: number;
}

export interface EarningsSummary {
  totals: EarningsTotals[];
  recent: { jobId: string; containerNumber: string; fee: number; currency: string; completedAt: Date }[];
  deliveredWithoutFee: number;
}

// Totals of the fees agencies agreed for delivered jobs, per currency (never
// converted between currencies). "week" is the last 7 days, "month" is the
// current calendar month in UTC. Jobs with no fee are counted separately so
// the driver can see why a delivery isn't in the totals. `jobs` must already
// be sorted newest first; `recent` keeps the first 30 with a fee.
export function summarizeEarnings(jobs: EarningsJob[], now: Date = new Date()): EarningsSummary {
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const byCurrency = new Map<string, EarningsTotals>();
  const recent: EarningsSummary['recent'] = [];
  let deliveredWithoutFee = 0;

  for (const job of jobs) {
    if (!job.fee || job.fee <= 0) {
      deliveredWithoutFee += 1;
      continue;
    }
    const currency = job.currency || 'SLE';
    const row = byCurrency.get(currency) || { currency, week: 0, month: 0, allTime: 0, jobs: 0 };
    row.allTime += job.fee;
    row.jobs += 1;
    if (job.completedAt >= weekStart) row.week += job.fee;
    if (job.completedAt >= monthStart) row.month += job.fee;
    byCurrency.set(currency, row);
    if (recent.length < 30) recent.push({ jobId: job.id, containerNumber: job.containerNumber, fee: job.fee, currency, completedAt: job.completedAt });
  }

  return { totals: Array.from(byCurrency.values()), recent, deliveredWithoutFee };
}
