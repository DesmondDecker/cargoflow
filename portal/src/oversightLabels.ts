export const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.change_password': 'Changed password',
  'access.denied': 'Tried something not allowed',
  'record.view': 'Opened a record',
  'record.approve': 'Approved a record',
  'record.return': 'Returned a record',
  'record.create_assisted': 'Entered a record for an agent',
  'record.resend_email': 'Resent the approval email',
  'approved.view': 'Opened an approved record',
  'approved.export_csv': 'Downloaded the approved-records CSV',
  'report.view': 'Viewed reports',
  'oversight.view_log': 'Viewed this activity log',
  'oversight.export_log': 'Downloaded this activity log',
};
export const actionLabel = (a: string): string => ACTION_LABEL[a] ?? a;
export const OUTCOME_LABEL = { ok: 'Done', denied: 'Refused', failed: 'Failed' } as const;
export const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Everything' },
  { value: 'auth.', label: 'Sign-ins and passwords' },
  { value: 'record.approve', label: 'Approvals' },
  { value: 'record.return', label: 'Returns' },
  { value: 'record.', label: 'All record actions' },
  { value: 'approved.export_csv', label: 'CSV downloads' },
  { value: 'access.denied', label: 'Refused attempts' },
];
