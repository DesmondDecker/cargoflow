import { describe, it, expect } from 'vitest';
import { parseCarrierTrackingPage, PageParseError } from './pastedPageParser';

// Copied verbatim from the Maersk public tracking page (BL 272105777).
const SAMPLE = `Shipment & Container Tracking
Go to Manage bookings
Print
Track
Bill of Lading number consists of 9 characters.
Container number is made of 4 letters and 7 digits.
Welcome to the new tracking experience: enhanced visibility, clarity and efficiency.
Take a tourReturn to old tracking
BL number
272105777QINGDAO,
CN
FREETOWN,
SL
1 container
[Go to Shipment details](https://www.maersk.com/shipment-details/search/272105777)
TLLU4020573
40' Dry High
QINGDAO,
CN
Departs QINGDAO QIANWAN CONTAINER CO LTD26 Jun 2026
FREETOWN,
SL
Arrives FREETOWN TERMINAL02 Oct 2026
Note: All times are given in local time, unless otherwise stated.
Last updated: 16 hours ago
View 11 events completed from origin
FREETOWN
FREETOWN TERMINAL
Empty container return
Latest event
20 Oct 2026 13:10`;

describe('parseCarrierTrackingPage (Maersk layout)', () => {
  it('reads the real pasted page', () => {
    const r = parseCarrierTrackingPage(SAMPLE);
    expect(r.carrier).toBe('Maersk');
    expect(r.blNumber).toBe('272105777');
    expect(r.lastUpdatedText).toBe('16 hours ago');
    expect(r.containers).toHaveLength(1);
    const c = r.containers[0];
    expect(c.containerNumber).toBe('TLLU4020573');
    expect(c.containerType).toBe("40' Dry High");
    expect(c.origin).toEqual({ name: 'QINGDAO', country: 'CN' });
    expect(c.destination).toEqual({ name: 'FREETOWN', country: 'SL' });
    expect(c.departure?.facility).toBe('QINGDAO QIANWAN CONTAINER CO LTD');
    expect(c.departure?.date.toISOString()).toBe('2026-06-26T00:00:00.000Z');
    expect(c.arrival?.facility).toBe('FREETOWN TERMINAL');
    expect(c.arrival?.date.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(c.eventsCompleted).toBe(11);
    expect(c.latestEvent).toEqual({
      location: 'FREETOWN',
      facility: 'FREETOWN TERMINAL',
      description: 'Empty container return',
      at: new Date('2026-10-20T13:10:00.000Z'),
    });
  });

  it('splits a multi-container result into one entry each', () => {
    const second = SAMPLE.replace('TLLU4020573', 'MSKU1234565');
    const body = SAMPLE.split('1 container')[1];
    const r = parseCarrierTrackingPage(SAMPLE + '\n' + second.split('1 container')[1].replace(/^[^\n]*\n/, ''));
    expect(r.containers.map((c) => c.containerNumber)).toEqual(['TLLU4020573', 'MSKU1234565']);
    expect(body).toBeTruthy();
  });

  it('works when the latest event has no facility line', () => {
    const t = SAMPLE.replace('FREETOWN TERMINAL\nEmpty container return', 'Empty container return');
    const c = parseCarrierTrackingPage(t).containers[0];
    expect(c.latestEvent?.location).toBe('FREETOWN');
    expect(c.latestEvent?.facility).toBeUndefined();
    expect(c.latestEvent?.description).toBe('Empty container return');
  });

  it('fails loudly on text with no container number', () => {
    expect(() => parseCarrierTrackingPage('hello there')).toThrow(PageParseError);
  });

  it('fails loudly when there are no dates or events', () => {
    expect(() => parseCarrierTrackingPage('TLLU4020573\n40\' Dry High')).toThrow(PageParseError);
  });

  it('reads text taken straight off the page (Departs / facility / date on separate lines)', () => {
    const page = `Skip to content
Bill of Lading number consists of 9 characters.
BL number
272105777
QINGDAO, CN
FREETOWN, SL
1 container
TLLU4020573
40' Dry High
QINGDAO, CN
Departs
QINGDAO QIANWAN CONTAINER CO LTD
26 Jun 2026
FREETOWN, SL
Arrives
FREETOWN TERMINAL
02 Oct 2026
Last updated: 16 hours ago
View 11 events completed from origin
FREETOWN
FREETOWN TERMINAL
Empty container return
Latest event
20 Oct 2026 13:10`;
    const c = parseCarrierTrackingPage(page).containers[0];
    expect(c.origin).toEqual({ name: 'QINGDAO', country: 'CN' });
    expect(c.destination).toEqual({ name: 'FREETOWN', country: 'SL' });
    expect(c.departure?.facility).toBe('QINGDAO QIANWAN CONTAINER CO LTD');
    expect(c.departure?.date.toISOString()).toBe('2026-06-26T00:00:00.000Z');
    expect(c.arrival?.facility).toBe('FREETOWN TERMINAL');
    expect(c.arrival?.date.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(c.latestEvent?.description).toBe('Empty container return');
  });
});
