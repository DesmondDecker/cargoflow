import { FIELD_LABELS, SUBMISSION_FIELDS, SubmissionInput } from './customsRules';
import { MailMessage } from '../emailService';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ApprovalDetails {
  fields: SubmissionInput;
  approvalReference: string;
  approvedAt: Date;
  approvedByName: string;
  submittedByName: string;
  portalUrl?: string;
}

const stamp = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// The notice AGL receives when Customs approves a record. It carries the six
// agreed fields, the approval reference and who approved it and when, and
// nothing more.
export function buildApprovalEmail(to: string[], d: ApprovalDetails): MailMessage {
  const subject = `Customs approval ${d.approvalReference}: container ${d.fields.containerNumber}`;
  const lines = SUBMISSION_FIELDS.map((f) => `${FIELD_LABELS[f]}: ${d.fields[f]}`);
  const text = [
    'Customs has approved the following record.',
    '',
    ...lines,
    '',
    `Approval reference: ${d.approvalReference}`,
    `Approved by: ${d.approvedByName} (Customs)`,
    `Approved at: ${stamp(d.approvedAt)}`,
    `Submitted by: ${d.submittedByName}`,
    ...(d.portalUrl ? ['', `View it in Cargo Flow: ${d.portalUrl}`] : []),
    '',
    'This message was sent automatically by Cargo Flow. Cargo Flow records Customs\u2019 approval; it does not replace Customs\u2019 verification or AGL\u2019s own procedures.',
  ].join('\n');

  const rows = SUBMISSION_FIELDS.map((f) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${esc(FIELD_LABELS[f])}</td><td style="padding:4px 0"><strong>${esc(d.fields[f])}</strong></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<p>Customs has approved the following record.</p>
<table style="border-collapse:collapse">${rows}</table>
<p>Approval reference: <strong>${esc(d.approvalReference)}</strong><br>Approved by: ${esc(d.approvedByName)} (Customs)<br>Approved at: ${esc(stamp(d.approvedAt))}<br>Submitted by: ${esc(d.submittedByName)}</p>
${d.portalUrl ? `<p><a href="${esc(d.portalUrl)}">View it in Cargo Flow</a></p>` : ''}
<p style="color:#777;font-size:12px">Sent automatically by Cargo Flow. Cargo Flow records Customs\u2019 approval; it does not replace Customs\u2019 verification or AGL\u2019s own procedures.</p></div>`;

  return { to, subject, text, html };
}
