import React from 'react';
import { Status } from '../api/portalApi';

const LABEL: Record<Status, string> = { pending: 'Pending', approved: 'Approved', returned: 'Returned' };

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" style={{ background: 'currentColor' }} />
      {LABEL[status]}
    </span>
  );
}
