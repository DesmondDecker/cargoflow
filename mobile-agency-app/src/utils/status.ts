import { colors } from '../theme/theme';

// Pipeline order (matches backend/src/constants/containerPipeline.ts STATUS_KEYS).
export const STATUS_ORDER = [
  'Pending Documents',
  'In Transit',
  'Arrived',
  'Under Clearance',
  'Cleared',
  'Transport Required',
  'Driver Assigned',
  'Picked Up',
  'In Transit To Destination',
  'Delivered',
  'Closed',
] as const;

export function statusTone(status: string): { fg: string; bg: string } {
  switch (status) {
    case 'In Transit':
    case 'In Transit To Destination':
    case 'Driver Assigned':
    case 'Picked Up':
      return { fg: colors.info, bg: colors.infoBg };
    case 'Arrived':
    case 'Cleared':
    case 'Delivered':
      return { fg: colors.normal, bg: colors.normalBg };
    case 'Under Clearance':
    case 'Pending Documents':
    case 'Transport Required':
      return { fg: colors.attention, bg: colors.attentionBg };
    default:
      return { fg: colors.textSecondary, bg: colors.border };
  }
}

export function formatShortDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Whole days from today to a date: positive = in the future, negative = past.
export function daysFromNow(value?: string): number | null {
  if (!value) return null;
  const target = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
