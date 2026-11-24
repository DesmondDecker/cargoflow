import { describe, expect, it } from 'vitest';
import { parseMaerskPublicPage } from './maerskPublicUiProvider';

const RESULT = `Shipment & Container Tracking
BL number
272105777
TLLU4020573
40' Dry High
Vessel: MADRID MAERSK
QINGDAO, CN
Departs QINGDAO QIANWAN CONTAINER CO LTD 26 Jun 2026
FREETOWN, SL
Arrives FREETOWN TERMINAL 02 Oct 2026
View 11 events completed from origin
FREETOWN
FREETOWN TERMINAL
Empty container return
Latest event
20 Oct 2026 13:10`;

describe('parseMaerskPublicPage', () => {
  it('extracts the requested container status and arrival date', () => {
    expect(parseMaerskPublicPage(RESULT, 'TLLU4020573')).toMatchObject({
      resolved: true,
      carrierName: 'Maersk',
      status: 'Empty container return',
      vesselName: 'MADRID MAERSK',
      eta: new Date('2026-10-02T00:00:00.000Z'),
      source: 'scraper:maersk_public_ui',
    });

  });

  it('resolves a bill-of-lading lookup to its first container result', () => {
    expect(parseMaerskPublicPage(RESULT, '272105777', 'bill_of_lading')).toMatchObject({
      resolved: true,
      carrierName: 'Maersk',
      matchedContainerNumber: 'TLLU4020573',
      status: 'Empty container return',
      source: 'scraper:maersk_public_ui',
    });
  });

  it('does not accept a Maersk result for a different bill of lading', () => {
    expect(parseMaerskPublicPage(RESULT, '270560510', 'bill_of_lading')).toMatchObject({
      resolved: false,
      source: 'scraper:maersk_public_ui_mismatch',
    });
  });

  it('parses the public tracker layout with the latest-event label on the same line', () => {
    const page = `BL number
270560510
JAWAHARLAL NEHRU, IN
FREETOWN, SL
1 container
TCKU7454768
40' Dry High
JAWAHARLAL NEHRU, IN
Departs JAWAHARLAL NEHRU NSICT DPW
29 May 2026
FREETOWN, SL
Arrives FREETOWN TERMINAL
19 Aug 2026
Last updated: 6 days ago
View 14 events completed from origin
FREETOWN
FREETOWN TERMINAL
Gate out for delivery Latest event
17 Nov 2026 21:05`;

    expect(parseMaerskPublicPage(page, 'TCKU7454768')).toMatchObject({
      resolved: true,
      status: 'Gate out for delivery',
      originPlace: 'JAWAHARLAL NEHRU, IN',
      destinationPlace: 'FREETOWN, SL',
      departedAt: new Date('2026-05-29T00:00:00.000Z'),
      eta: new Date('2026-08-19T00:00:00.000Z'),
      latestEvent: {
        description: 'Gate out for delivery',
        location: 'FREETOWN',
        facility: 'FREETOWN TERMINAL',
        at: new Date('2026-11-17T21:05:00.000Z'),
      },
      eventsCompleted: 14,
      carrierUpdatedNote: '6 days ago',
      source: 'scraper:maersk_public_ui',
    });
  });

  it('does not resolve a result for a different container', () => {
    expect(parseMaerskPublicPage(RESULT, 'MSKU1234565')).toMatchObject({
      resolved: false,
      source: 'scraper:maersk_public_ui_mismatch',
    });
  });

  it('stops rather than bypassing an access challenge', () => {
    expect(parseMaerskPublicPage('Please verify that you are human', 'TLLU4020573')).toMatchObject({
      resolved: false,
      source: 'scraper:maersk_public_ui_challenge',
    });
  });

  it('rejects invalid container numbers without contacting the tracker', () => {
    expect(parseMaerskPublicPage(RESULT, 'not-a-container')).toMatchObject({
      resolved: false,
      source: 'scraper:maersk_public_ui_invalid_input',
    });
  });
});
