import { describe, it, expect } from 'vitest';
import { extractGenericTracking, findDates } from './genericPageExtractor';

const NOW = new Date('2026-10-22T12:00:00Z');

// Synthetic samples written to cover the common ways carrier pages lay this
// out. They are NOT copies of any real carrier page.
describe('findDates', () => {
  it('reads the common date formats', () => {
    expect(findDates('Arrived 02 Oct 2026')[0].date.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(findDates('Oct 2, 2026 14:30')[0].date.toISOString()).toBe('2026-10-02T14:30:00.000Z');
    expect(findDates('2026-10-02 09:05')[0].date.toISOString()).toBe('2026-10-02T09:05:00.000Z');
    expect(findDates('02/10/2026')[0].date.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(findDates('02-Oct-2026')[0].date.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });
  it('rejects impossible dates', () => {
    expect(findDates('31/02/2026')).toHaveLength(0);
  });
});

describe('extractGenericTracking', () => {
  it('reads a table-style event list', () => {
    const text = `Container MSCU1234567
Vessel: MSC AURORA
ETA 05 Nov 2026
Date Location Event
2026-10-20 14:10 FREETOWN Gate out empty
2026-10-18 09:00 FREETOWN Discharged
2026-09-30 22:15 TANGER MED Loaded`;
    const p = extractGenericTracking(text, 'MSCU1234567', NOW);
    expect(p.containerFound).toBe(true);
    expect(p.vesselName).toBe('MSC AURORA');
    expect(p.eta?.toISOString()).toBe('2026-11-05T00:00:00.000Z');
    expect(p.latestEvent?.at?.toISOString()).toBe('2026-10-20T14:10:00.000Z');
    expect(p.latestEvent?.description).toContain('Gate out empty');
  });

  it('reads labels with the date on the next line', () => {
    const text = `CMAU 7654321
Estimated arrival
12 Nov 2026
Departure
01 Oct 2026
Discharged from vessel
Oct 15, 2026`;
    const p = extractGenericTracking(text, 'CMAU7654321', NOW);
    expect(p.containerFound).toBe(true);
    expect(p.eta?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(p.departedAt?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('ignores events dated in the future and reports a missing container', () => {
    const p = extractGenericTracking('Some other page\nDelivered 30 Dec 2026', 'HLXU1111111', NOW);
    expect(p.containerFound).toBe(false);
    expect(p.latestEvent).toBeUndefined();
  });
});
