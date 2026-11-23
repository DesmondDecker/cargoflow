import { validateContainerNumber } from '../carrierDetection';

// The rules of the customs-verification handoff, kept free of the database so
// they can be tested on their own. The workflow handles exactly six fields;
// nothing in this module (or the module that uses it) widens that.

export const SUBMISSION_FIELDS = ['cvcNumber', 'billOfLadingNumber', 'shippingAgency', 'containerNumber', 'documentName', 'itsNumber'] as const;
export type SubmissionField = (typeof SUBMISSION_FIELDS)[number];
export type SubmissionInput = Record<SubmissionField, string>;

export const FIELD_LABELS: Record<SubmissionField, string> = {
  cvcNumber: 'CVC number',
  billOfLadingNumber: 'Bill of lading number',
  shippingAgency: 'Shipping agency',
  containerNumber: 'Container number',
  documentName: 'Document name',
  itsNumber: 'ITS number',
};

const MAX_LENGTH = 120;
// Reference-style numbers: letters, digits and the separators these numbers use.
const REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9 ./\-]{1,38}[A-Z0-9]$/;

const collapse = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

// Identifiers are upper-cased so "msku 1234565" and "MSKU1234565" are one
// container; names are left as typed.
export function normalizeSubmission(input: Partial<Record<SubmissionField, unknown>>): SubmissionInput {
  return {
    cvcNumber: collapse(input.cvcNumber).toUpperCase(),
    billOfLadingNumber: collapse(input.billOfLadingNumber).toUpperCase(),
    shippingAgency: collapse(input.shippingAgency),
    containerNumber: collapse(input.containerNumber).toUpperCase().replace(/\s+/g, ''),
    documentName: collapse(input.documentName),
    itsNumber: collapse(input.itsNumber).toUpperCase(),
  };
}

export interface SubmissionCheck {
  errors: Partial<Record<SubmissionField, string>>;
  warnings: string[];
}

// Errors block a submission. Warnings do not: a container number whose check
// digit does not match is flagged for the officer rather than refused, since
// Customs, not this system, decides what is acceptable.
export function checkSubmission(s: SubmissionInput): SubmissionCheck {
  const errors: SubmissionCheck['errors'] = {};
  const warnings: string[] = [];

  for (const field of SUBMISSION_FIELDS) {
    if (!s[field]) errors[field] = `${FIELD_LABELS[field]} is required`;
    else if (s[field].length > MAX_LENGTH) errors[field] = `${FIELD_LABELS[field]} is too long`;
  }

  for (const field of ['cvcNumber', 'billOfLadingNumber', 'itsNumber'] as const) {
    if (!errors[field] && !REFERENCE_PATTERN.test(s[field])) {
      errors[field] = `${FIELD_LABELS[field]} has unexpected characters (use letters, digits, / - . only)`;
    }
  }

  if (!errors.containerNumber) {
    const v = validateContainerNumber(s.containerNumber);
    if (!v.formatValid) errors.containerNumber = v.issue || 'Container number is not valid';
    else if (v.checkDigitValid === false) warnings.push(`Container number check digit does not match (${v.issue}). Check for a typing error.`);
  }

  return { errors, warnings };
}

export function approvalReference(date: Date, sequence: number): string {
  return `CV-${date.getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
}

export type SubmissionStatus = 'pending' | 'approved' | 'returned';
export type SubmissionAction = 'approve' | 'return' | 'resubmit' | 'edit';

// Approval is a final, single-level decision: once approved or returned a
// record is never decided again. A returned record goes back to the agent,
// who corrects and resubmits it (a new pass through the queue); only the
// agent edits it, and only while it is returned.
export function canTransition(from: SubmissionStatus, action: SubmissionAction): boolean {
  switch (action) {
    case 'approve':
    case 'return':
      return from === 'pending';
    case 'resubmit':
    case 'edit':
      return from === 'returned';
  }
}

export interface TimedRecord {
  status: SubmissionStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  emailSentAt?: Date;
}

export interface Summary {
  total: number;
  pending: number;
  approved: number;
  returned: number;
  returnRate: number | null; // returned / (approved + returned)
  reviewMinutes: { median: number | null; p90: number | null; average: number | null }; // submitted -> decision, for approved
  withinTenMinutesPct: number | null; // share of approvals decided within 10 minutes of submission
  emailDelaySeconds: { median: number | null }; // approval -> email sent
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

// Turnaround figures for the pilot's evaluation. These are measured, not
// promised: review time depends on officer availability, and the 10-minute
// share is reported exactly as measured.
export function summarize(records: TimedRecord[]): Summary {
  const approved = records.filter((r) => r.status === 'approved' && r.reviewedAt);
  const minutes = approved.map((r) => (r.reviewedAt!.getTime() - r.submittedAt.getTime()) / 60000).sort((a, b) => a - b);
  const delays = approved
    .filter((r) => r.emailSentAt)
    .map((r) => (r.emailSentAt!.getTime() - r.reviewedAt!.getTime()) / 1000)
    .sort((a, b) => a - b);
  const returned = records.filter((r) => r.status === 'returned').length;
  const decided = approved.length + returned;

  return {
    total: records.length,
    pending: records.filter((r) => r.status === 'pending').length,
    approved: approved.length,
    returned,
    returnRate: decided === 0 ? null : round1((returned / decided) * 100),
    reviewMinutes: {
      median: round1(percentile(minutes, 50)),
      p90: round1(percentile(minutes, 90)),
      average: minutes.length ? round1(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
    },
    withinTenMinutesPct: minutes.length ? round1((minutes.filter((m) => m <= 10).length / minutes.length) * 100) : null,
    emailDelaySeconds: { median: round1(percentile(delays, 50)) },
  };
}

// CSV for Excel, which is how this data is handled today. A cell that starts
// with = + - @ would be run as a formula when the file is opened, so those
// are prefixed with an apostrophe.
export function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
