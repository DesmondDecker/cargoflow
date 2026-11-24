import { describe, expect, it } from 'vitest';
import { parseGenericCarrierPublicPage } from './genericCarrierPublicUiProvider';

describe('parseGenericCarrierPublicPage', () => {
  it.each([
    ['CMA CGM', 'cma_cgm'],
    ['Hapag-Lloyd', 'hapag_lloyd'],
  ] as const)('extracts tracking details for %s', (carrierName, sourceName) => {
    const text = `Container: TLLU4020573
Vessel: CMA CGM EXAMPLE
ETA 05 Nov 2026
2026-10-20 14:10 FREETOWN Gate out for delivery`;

    expect(parseGenericCarrierPublicPage(text, 'TLLU4020573', carrierName)).toMatchObject({
      resolved: true,
      carrierName,
      status: expect.stringContaining('Gate out for delivery'),
      vesselName: 'CMA CGM EXAMPLE',
      eta: new Date('2026-11-05T00:00:00.000Z'),
      latestEvent: {
        description: expect.stringContaining('Gate out for delivery'),
        at: new Date('2026-10-20T14:10:00.000Z'),
      },
      source: `scraper:${sourceName}_public_ui`,
    });
  });

  it('does not resolve a result for a different container', () => {
    expect(parseGenericCarrierPublicPage('TLLU1234567\nDelivered 20 Oct 2026', 'TLLU4020573', 'CMA CGM')).toMatchObject({
      resolved: false,
      source: 'scraper:cma_cgm_public_ui_mismatch',
    });

  });

  it.each([
    ['CMA CGM', 'cma_cgm'],
    ['Hapag-Lloyd', 'hapag_lloyd'],
  ] as const)('accepts a bill-of-lading reference for %s', (carrierName, sourceName) => {
    const text = `Bill of lading: MEDUADN49575
Container: SEGU6250351
Vessel: CARGO FLOW
ETA 05 Nov 2026`;

    expect(parseGenericCarrierPublicPage(text, 'MEDUADN49575', carrierName, 'bill_of_lading')).toMatchObject({
      resolved: true,
      carrierName,
      matchedContainerNumber: 'SEGU6250351',
      eta: new Date('2026-11-05T00:00:00.000Z'),
      source: `scraper:${sourceName}_public_ui`,
    });
  });

  it('stops rather than bypassing an access challenge', () => {
    expect(parseGenericCarrierPublicPage('Verifying the device...', 'TLLU4020573', 'Hapag-Lloyd')).toMatchObject({
      resolved: false,
      source: 'scraper:hapag_lloyd_public_ui_challenge',
    });
  });

  it('rejects invalid container numbers', () => {
    expect(parseGenericCarrierPublicPage('TLLU4020573', 'TLLU123', 'CMA CGM')).toMatchObject({
      resolved: false,
      source: 'scraper:cma_cgm_public_ui_invalid_input',
    });
  });
});
