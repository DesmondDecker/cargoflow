import { describe, it, expect, afterEach } from 'vitest';
import { approvalReference, canTransition, checkSubmission, csvCell, normalizeSubmission, summarize, toCsv } from './customsRules';
import { buildApprovalEmail } from './approvalEmail';
import { isEmailConfigured, sendMail, setMailSenderForTests } from '../emailService';

const good = {
  cvcNumber: 'cvc-2026/0412', billOfLadingNumber: ' maeu 2721 05777 ', shippingAgency: 'Maersk Line  Sierra Leone',
  containerNumber: 'msku 1234565', documentName: 'Customs Valuation Certificate', itsNumber: 'its-00981',
};

describe('normalizeSubmission', () => {
  it('upper-cases identifiers, collapses spaces, keeps names as typed', () => {
    expect(normalizeSubmission(good)).toEqual({
      cvcNumber: 'CVC-2026/0412', billOfLadingNumber: 'MAEU 2721 05777', shippingAgency: 'Maersk Line Sierra Leone',
      containerNumber: 'MSKU1234565', documentName: 'Customs Valuation Certificate', itsNumber: 'ITS-00981',
    });
  });
  it('turns missing and non-string values into empty strings', () => {
    expect(normalizeSubmission({ cvcNumber: 5 as unknown as string }).cvcNumber).toBe('');
  });
});

describe('checkSubmission', () => {
  it('accepts a complete record', () => {
    const r = checkSubmission(normalizeSubmission(good));
    expect(r.errors).toEqual({});
    expect(r.warnings).toEqual([]);
  });
  it('names every missing field', () => {
    const r = checkSubmission(normalizeSubmission({}));
    expect(Object.keys(r.errors).sort()).toEqual(['billOfLadingNumber', 'containerNumber', 'cvcNumber', 'documentName', 'itsNumber', 'shippingAgency']);
  });
  it('refuses a container number in the wrong format', () => {
    expect(checkSubmission(normalizeSubmission({ ...good, containerNumber: '12345' })).errors.containerNumber).toContain('Expected format');
  });
  it('warns, without blocking, when the container check digit is wrong', () => {
    const r = checkSubmission(normalizeSubmission({ ...good, containerNumber: 'MSKU1234560' }));
    expect(r.errors.containerNumber).toBeUndefined();
    expect(r.warnings[0]).toContain('check digit');
  });
  it('refuses odd characters in reference numbers', () => {
    expect(checkSubmission(normalizeSubmission({ ...good, cvcNumber: '12;DROP' })).errors.cvcNumber).toContain('unexpected characters');
  });
});

describe('approvalReference and transitions', () => {
  it('formats the reference with the year and a padded sequence', () => {
    expect(approvalReference(new Date('2026-10-30T00:00:00Z'), 42)).toBe('CV-2026-000042');
  });
  it('lets a record be decided once, and only a returned one be corrected', () => {
    expect(canTransition('pending', 'approve')).toBe(true);
    expect(canTransition('pending', 'return')).toBe(true);
    expect(canTransition('approved', 'approve')).toBe(false);
    expect(canTransition('approved', 'return')).toBe(false);
    expect(canTransition('returned', 'approve')).toBe(false);
    expect(canTransition('returned', 'resubmit')).toBe(true);
    expect(canTransition('pending', 'edit')).toBe(false);
    expect(canTransition('approved', 'resubmit')).toBe(false);
  });
});

describe('summarize', () => {
  const t = (iso: string) => new Date(`2026-10-30T${iso}Z`);
  it('measures review time, return rate and email delay', () => {
    const s = summarize([
      { status: 'approved', submittedAt: t('09:00:00'), reviewedAt: t('09:05:00'), emailSentAt: t('09:05:04') },
      { status: 'approved', submittedAt: t('10:00:00'), reviewedAt: t('10:20:00'), emailSentAt: t('10:20:08') },
      { status: 'returned', submittedAt: t('11:00:00'), reviewedAt: t('11:03:00') },
      { status: 'pending', submittedAt: t('12:00:00') },
    ]);
    expect(s).toMatchObject({ total: 4, pending: 1, approved: 2, returned: 1, returnRate: 33.3, withinTenMinutesPct: 50 });
    expect(s.reviewMinutes).toEqual({ median: 5, p90: 20, average: 12.5 });
    expect(s.emailDelaySeconds.median).toBe(4);
  });
  it('reports nothing rather than zero when there is nothing to measure', () => {
    const s = summarize([]);
    expect(s.returnRate).toBeNull();
    expect(s.reviewMinutes.median).toBeNull();
  });
});

describe('CSV', () => {
  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(toCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2\r\n');
  });
});

describe('approval email and sending', () => {
  const details = {
    fields: normalizeSubmission(good), approvalReference: 'CV-2026-000042', approvedAt: new Date('2026-10-30T09:05:00Z'),
    approvedByName: 'Officer <A>', submittedByName: 'Agent & Co', portalUrl: 'https://portal.example/approved/1',
  };
  afterEach(() => setMailSenderForTests(null));

  it('carries the six fields, reference, approver and time, and escapes HTML', () => {
    const m = buildApprovalEmail(['agl@example.com'], details);
    expect(m.subject).toBe('Customs approval CV-2026-000042: container MSKU1234565');
    for (const v of ['CVC-2026/0412', 'MAEU 2721 05777', 'Maersk Line Sierra Leone', 'MSKU1234565', 'Customs Valuation Certificate', 'ITS-00981']) expect(m.text).toContain(v);
    expect(m.text).toContain('Approved at: 2026-10-30 09:05 UTC');
    expect(m.html).toContain('Officer &lt;A&gt;');
    expect(m.html).toContain('Agent &amp; Co');
  });

  it('does not claim to have sent when email is not configured', async () => {
    delete process.env.SMTP_HOST;
    expect(isEmailConfigured()).toBe(false);
    expect(await sendMail(buildApprovalEmail(['a@b.c'], details))).toEqual({ status: 'not_configured' });
  });

  it('reports a send failure instead of hiding it', async () => {
    setMailSenderForTests(async () => { throw new Error('connection refused'); });
    expect(await sendMail(buildApprovalEmail(['a@b.c'], details))).toEqual({ status: 'failed', error: 'connection refused' });
  });

  it('sends to every recipient when it works', async () => {
    let seen: string[] = [];
    setMailSenderForTests(async (m) => { seen = m.to; });
    expect(await sendMail(buildApprovalEmail(['a@b.c', 'd@e.f'], details))).toEqual({ status: 'sent' });
    expect(seen).toEqual(['a@b.c', 'd@e.f']);
  });
});
