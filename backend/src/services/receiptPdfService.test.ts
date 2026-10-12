import { describe, it, expect } from 'vitest';
import { formatAmount, buildReceiptPdf } from './receiptPdfService';

describe('formatAmount', () => {
  it('formats a whole-number amount with two decimal places', () => {
    expect(formatAmount(3500, 'SLE')).toBe('SLE 3,500.00');
  });

  it('formats a fractional amount without rounding error', () => {
    expect(formatAmount(1234.5, 'USD')).toBe('USD 1,234.50');
  });

  it('handles the currency code SLE specifically without throwing', () => {
    // The actual reason this function exists rather than using
    // Intl.NumberFormat directly: SLE isn't guaranteed to be in every ICU
    // locale data build, which can throw a RangeError. This is the
    // regression test for that exact failure mode.
    expect(() => formatAmount(100, 'SLE')).not.toThrow();
  });

  it('adds thousands separators for large amounts', () => {
    expect(formatAmount(1000000, 'SLE')).toBe('SLE 1,000,000.00');
  });
});

describe('buildReceiptPdf', () => {
  const sampleData = {
    agencyName: 'Test Freight Agency',
    agencyContactEmail: 'ops@testfreight.example',
    agencyContactPhone: '+232 00 000000',
    agencyAddress: '12 Wharf Road, Freetown',
    receiptNumber: 'TFA-2026-000001',
    issuedAt: new Date('2026-01-15T12:00:00Z'),
    importerName: 'Acme Imports Ltd',
    importerPhone: '+232 11 111111',
    containerNumber: 'MAEU1234567',
    amount: 3500,
    currency: 'SLE',
    paymentMethod: 'mobile_money',
    paymentNotes: 'Partial payment for container clearance',
    issuedByName: 'Fatmata Sesay',
  };

  it('actually generates a real PDF buffer, not a stub', async () => {
    const buffer = await buildReceiptPdf(sampleData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // Every valid PDF file starts with this exact magic-byte header —
    // checking it is a real, cheap way to confirm pdfkit produced an
    // actual PDF rather than silently emitting empty or malformed output.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    // A one-page receipt with this much text content should land somewhere
    // in the low tens of KB at minimum; a near-empty buffer would indicate
    // the content never actually got drawn onto the page.
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('does not throw when optional fields (container, notes, contact info) are omitted', async () => {
    const minimal = {
      agencyName: 'Test Freight Agency',
      receiptNumber: 'TFA-2026-000002',
      issuedAt: new Date(),
      importerName: 'Acme Imports Ltd',
      amount: 100,
      currency: 'SLE',
      paymentMethod: 'cash',
      issuedByName: 'Fatmata Sesay',
    };
    const buffer = await buildReceiptPdf(minimal);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('does not throw on an unrecognized payment method (defensive against a future enum change)', async () => {
    const buffer = await buildReceiptPdf({ ...sampleData, paymentMethod: 'some_new_method_not_in_the_label_map' });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
