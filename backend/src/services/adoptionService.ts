// Usage figures for judging adoption. "Registered" and "active" are kept
// apart on purpose: a sign-up is not use. Active means someone from the
// agency actually signed in during the period.

export interface WeekCount {
  weekStart: string; // Monday, YYYY-MM-DD (UTC)
  count: number;
}

const DAY = 86400000;

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7; // days since Monday
  return new Date(d.getTime() - offset * DAY);
}

// Counts per week for the last `weeks` weeks, oldest first, including empty
// weeks so a chart has no gaps. The current (partial) week is last.
export function weeklyCounts(dates: Date[], weeks: number, now: Date = new Date()): WeekCount[] {
  const thisMonday = mondayOf(now).getTime();
  const starts = Array.from({ length: weeks }, (_, i) => thisMonday - (weeks - 1 - i) * 7 * DAY);
  const counts = new Map<number, number>(starts.map((s) => [s, 0]));
  for (const d of dates) {
    const key = mondayOf(d).getTime();
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return starts.map((s) => ({ weekStart: new Date(s).toISOString().slice(0, 10), count: counts.get(s)! }));
}

export function activeSince(daysBack: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - daysBack * DAY);
}
