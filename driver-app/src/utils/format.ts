import { JobStatus } from '../types';
import { colors } from '../theme/theme';

export function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'New job',
  accepted: 'Accepted',
  declined: 'Declined',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function statusColors(status: JobStatus): { fg: string; bg: string } {
  switch (status) {
    case 'pending':
      return { fg: colors.attention, bg: colors.attentionBg };
    case 'delivered':
      return { fg: colors.normal, bg: colors.normalBg };
    case 'declined':
    case 'cancelled':
      return { fg: colors.urgent, bg: colors.urgentBg };
    default:
      return { fg: colors.info, bg: colors.infoBg };
  }
}
