import { DeadlineEntry } from '../models/Container';

// Global fallback only — used when an agency hasn't told the system a
// specific carrier's actual terms yet. Not a claim that every carrier gives
// 4 free days and a 7-day grace period; it's just what a container falls
// back to until someone enters the real number (see AgencyDemurrageTerm).
const FREE_STORAGE_DAYS = 4;
const DEMURRAGE_GRACE_DAYS = 7;

export function computeDeadlines(
  dates: { discharged?: Date | null; arrival?: Date | null },
  now = new Date(),
  overrides?: { freeStorageDays?: number; demurrageGraceDays?: number }
): DeadlineEntry[] {
  const deadlines: DeadlineEntry[] = [];
  const startDate = dates.discharged || dates.arrival;
  if (!startDate) return deadlines;

  const freeStorageDays = overrides?.freeStorageDays ?? FREE_STORAGE_DAYS;
  const demurrageGraceDays = overrides?.demurrageGraceDays ?? DEMURRAGE_GRACE_DAYS;

  const freeStorageDue = new Date(startDate.getTime() + freeStorageDays * 24 * 60 * 60 * 1000);
  deadlines.push({
    ruleName: 'Free Storage Expiry',
    startEvent: dates.discharged ? 'discharged' : 'arrival',
    startDate,
    dueDate: freeStorageDue,
    status: freeStorageDue < now ? 'expired' : 'pending',
  });

  const demurrageDue = new Date(startDate.getTime() + demurrageGraceDays * 24 * 60 * 60 * 1000);
  deadlines.push({
    ruleName: 'Demurrage Grace Period',
    startEvent: dates.discharged ? 'discharged' : 'arrival',
    startDate,
    dueDate: demurrageDue,
    status: demurrageDue < now ? 'expired' : 'pending',
  });

  return deadlines;
}
