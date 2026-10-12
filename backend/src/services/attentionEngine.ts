import { ContainerDoc } from '../models/Container';

export interface AttentionResult {
  attentionLevel: 'urgent' | 'attention' | 'normal';
  attentionReasons: string[];
  attentionRank: number;
}

// Real, deterministic rules — not a placeholder scorer. Every reason string
// here is exactly what the mobile app's ContainerListItem.attentionReasons
// renders to the user, so wording changes here are user-facing changes.
export function computeAttention(
  container: Pick<ContainerDoc, 'status' | 'deadlines' | 'requiredDocumentTypes'>,
  documentTypesPresent: Set<string>,
  now = new Date()
): AttentionResult {
  const reasons: string[] = [];
  let level: 'urgent' | 'attention' | 'normal' = 'normal';

  const expiredDeadline = container.deadlines?.find((d) => d.status === 'expired');
  if (expiredDeadline) {
    reasons.push(`${expiredDeadline.ruleName} has expired`);
    level = 'urgent';
  }

  const dueSoon = container.deadlines?.find((d) => d.status === 'pending' && d.dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000);
  if (dueSoon && level !== 'urgent') {
    reasons.push(`${dueSoon.ruleName} due within 3 days`);
    level = 'attention';
  }

  const missingDocs = (container.requiredDocumentTypes || []).filter((t) => !documentTypesPresent.has(t));
  if (missingDocs.length > 0) {
    reasons.push(`Missing documents: ${missingDocs.join(', ')}`);
    if (level === 'normal') level = 'attention';
  }

  if (container.status === 'Pending Documents' && missingDocs.length === 0 && reasons.length === 0) {
    // Documents are all in but status was never advanced — worth a nudge, not an alarm.
    reasons.push('All documents received — ready to move to Under Clearance');
    if (level === 'normal') level = 'attention';
  }

  const attentionRank = level === 'urgent' ? 0 : level === 'attention' ? 1 : 2;
  return { attentionLevel: level, attentionReasons: reasons, attentionRank };
}
