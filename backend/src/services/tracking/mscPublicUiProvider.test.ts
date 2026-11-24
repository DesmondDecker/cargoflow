import { describe, expect, it } from 'vitest';
import { parseMscPublicPage } from './mscPublicUiProvider';

describe('parseMscPublicPage', () => {
  it('extracts an MSC status, vessel and ETA from public page text', () => {
    const text = `MSC shipment tracking
Container: MSCU1234567
Vessel: MSC AURORA
ETA 05 Nov 2026
Date Location Event
2026-10-20 14:10 FREETOWN Gate out for delivery`;

    expect(parseMscPublicPage(text, 'MSCU1234567')).toMatchObject({
      resolved: true,
      carrierName: 'MSC',
      status: expect.stringContaining('Gate out for delivery'),
      vesselName: 'MSC AURORA',
      eta: new Date('2026-11-05T00:00:00.000Z'),
      latestEvent: {
        description: expect.stringContaining('Gate out for delivery'),
        at: new Date('2026-10-20T14:10:00.000Z'),
      },
      source: 'scraper:msc_public_ui',
    });
  });

  it('accepts other valid container owner codes returned by MSC for a bill of lading', () => {
    const text = `BILL OF LADING: MEDUADN49575
Containers
Container: SEGU6250351
Latest move: TEMA, GH
POD ETA: 01/12/2026`;

    expect(parseMscPublicPage(text, 'SEGU6250351')).toMatchObject({
      resolved: true,
      carrierName: 'MSC',
      eta: new Date('2026-12-01T00:00:00.000Z'),
      source: 'scraper:msc_public_ui',
    });

  });

  it('tracks a bill-of-lading reference and captures its associated container', () => {
    const text = `MSC shipment tracking
BILL OF LADING: MEDUADN49575
Container: SEGU6250351
Latest move: TEMA, GH
POD ETA: 01/12/2026`;

    expect(parseMscPublicPage(text, 'MEDUADN49575', 'bill_of_lading')).toMatchObject({
      resolved: true,
      carrierName: 'MSC',
      matchedContainerNumber: 'SEGU6250351',
      eta: new Date('2026-12-01T00:00:00.000Z'),
      source: 'scraper:msc_public_ui',
    });
  });

  it('rejects results for other containers', () => {
    expect(parseMscPublicPage('MSCU7654321\nDelivered 20 Oct 2026', 'MSCU1234567')).toMatchObject({
      resolved: false,
      source: 'scraper:msc_public_ui_mismatch',
    });
  });

  it('stops on an access challenge', () => {
    expect(parseMscPublicPage('Please verify that you are human', 'MSCU1234567')).toMatchObject({
      resolved: false,
      source: 'scraper:msc_public_ui_challenge',
    });
  });

  it('rejects invalid MSC container numbers', () => {
    expect(parseMscPublicPage('MSCU1234567 Delivered 20 Oct 2026', 'ABCX1234567')).toMatchObject({
      resolved: false,
      source: 'scraper:msc_public_ui_invalid_input',
    });
  });
});
