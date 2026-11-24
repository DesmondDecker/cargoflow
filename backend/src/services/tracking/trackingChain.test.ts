import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ChainTrackingProvider } from './chainProvider';
import { MarineTrafficProvider } from './marineTrafficProvider';
import { applyGenericTracking, applyTrackingResult, LiveTrackingValue, TrackingContainer } from './trackingRefresh';
import { getTrackingProvider, describeTrackingSources, resetTrackingRegistryForTests } from './registry';
import { TrackingProvider, TrackingResult } from './types';

vi.mock('axios', async (orig) => {
  const actual = await orig<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, post: vi.fn(), get: vi.fn(), isAxiosError: actual.default.isAxiosError } };
});
const mocked = vi.mocked(axios, true);

const provider = (result: TrackingResult | Error): TrackingProvider => ({
  carrierName: 'X',
  fetchTracking: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

describe('ChainTrackingProvider', () => {
  it('returns the first source that answers and says which one it was', async () => {
    const chain = new ChainTrackingProvider('Maersk', [
      { label: 'carrier API', provider: provider({ resolved: false, status: '401', source: 'dcsa_api:maersk_error' }) },
      { label: 'MarineTraffic', provider: provider({ resolved: true, status: 'In transit', source: 'marinetraffic:MAEU' }) },
      { label: 'scraper', provider: provider({ resolved: true, status: 'never reached', source: 'scraper:public_tracker' }) },
    ]);
    const r = await chain.fetchTracking('MSKU1234565');
    expect(r).toMatchObject({ resolved: true, status: 'In transit', source: 'marinetraffic:MAEU', carrierName: 'Maersk' });
  });

  it('survives a source that throws and reports every failure when nothing answers', async () => {
    const chain = new ChainTrackingProvider('MSC', [
      { label: 'carrier API', provider: provider(new Error('boom')) },
      { label: 'scraper', provider: provider({ resolved: false, status: 'no parseable status', source: 'scraper:public_tracker_unparsed' }) },
    ]);
    const r = await chain.fetchTracking('MSCU1234567');
    expect(r.resolved).toBe(false);
    expect(r.source).toBe('tracking_chain:all_failed');
    expect(r.status).toContain('carrier API: failed: boom');
    expect(r.status).toContain('scraper: no parseable status');
  });
});

describe('MarineTrafficProvider', () => {
  const p = new MarineTrafficProvider({ apiKey: 'KEY' });
  beforeEach(() => {
    mocked.post.mockReset();
    mocked.get.mockReset();
  });

  it('registers the container, then reads the shipment, sending the API key header', async () => {
    mocked.post.mockResolvedValue({ data: { data: [{ attributes: { status: 'success' }, relationships: { shipment: { data: { shipmentId: 'SHIP1' } } } }] } });
    mocked.get.mockResolvedValue({
      data: { data: { attributes: { transportationStatus: 'in_transit', currentVessel: { name: 'MADRID MAERSK' }, portOfDischarge: { arrivalDate: { timestamp: '2026-10-02T00:00:00.000Z', status: 'estimated' } }, insights: { arrivalDelayDays: 3 } } } },
    });
    const r = await p.fetchTracking('TLLU4020573', { carrierName: 'Maersk' });
    expect(mocked.post.mock.calls[0][1]).toEqual({ data: [{ type: 'tracking_request', attributes: { referenceNumberType: 'container', referenceNumber: 'TLLU4020573', scac: 'MAEU' } }] });
    expect(mocked.post.mock.calls[0][2]?.headers).toMatchObject({ 'X-Container-API-Key': 'KEY' });
    expect(r).toMatchObject({ resolved: true, status: 'In transit, 3 days behind the carrier\'s ETA', vesselName: 'MADRID MAERSK', source: 'marinetraffic:MAEU', externalRef: 'SHIP1' });
    expect(r.eta?.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });

  it('goes straight to the shipment when it already has an id', async () => {
    mocked.get.mockResolvedValue({ data: { data: { attributes: { transportationStatus: 'arrived' } } } });
    await p.fetchTracking('TLLU4020573', { carrierName: 'Maersk', externalRef: 'SHIP1' });
    expect(mocked.post).not.toHaveBeenCalled();
    expect(String(mocked.get.mock.calls[0][0])).toContain('/shipments/SHIP1');
  });

  it('reports, rather than invents, when the carrier has no known SCAC', async () => {
    const r = await p.fetchTracking('ABCU1234567', { carrierName: 'Unknown Line' });
    expect(r.resolved).toBe(false);
    expect(r.status).toContain('SCAC');
  });

  it('labels a failed call and forgets a shipment that no longer exists', async () => {
    const err = Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 404 } });
    mocked.get.mockRejectedValue(err);
    const r = await p.fetchTracking('TLLU4020573', { carrierName: 'Maersk', externalRef: 'GONE' });
    expect(r.resolved).toBe(false);
    expect(r.source).toBe('marinetraffic:MAEU_error');
    expect(r.externalRef).toBeUndefined();
  });
});

describe('applyTrackingResult (generic public tracking is the last resort)', () => {
  const ctx = { guessedCarrier: 'Maersk', publicTrackingUrl: 'https://www.maersk.com/tracking/' };
  const pasted = (): LiveTrackingValue => ({ resolved: true, source: 'pasted:maersk_page', status: 'Empty container return' });

  it('a live answer replaces what was there, even captured tracking', () => {
    const c: TrackingContainer = { liveTracking: pasted() };
    expect(applyTrackingResult(c, { resolved: true, status: 'Discharged', source: 'dcsa_api:maersk' }, ctx)).toBe(true);
    expect(c.liveTracking?.source).toBe('dcsa_api:maersk');
  });

  it('a failed lookup never erases captured tracking', () => {
    const c: TrackingContainer = { liveTracking: pasted() };
    expect(applyTrackingResult(c, { resolved: false, status: '401', source: 'x' }, ctx)).toBe(false);
    expect(c.liveTracking?.status).toBe('Empty container return');
  });

  it('a failed lookup with nothing captured falls back to generic tracking and says why', () => {
    const c: TrackingContainer = {};
    applyTrackingResult(c, { resolved: false, status: 'carrier API: 401', source: 'tracking_chain:all_failed' }, ctx);
    expect(c.liveTracking).toMatchObject({ resolved: true, carrierName: 'Maersk', source: 'bic_owner_code_table', publicTrackingUrl: ctx.publicTrackingUrl });
    expect(c.liveTracking?.status).toContain('carrier API: 401');
  });

  it('with no live source configured, generic tracking identifies the carrier; an unknown prefix says so', () => {
    const known: TrackingContainer = {};
    applyGenericTracking(known, ctx);
    expect(known.liveTracking?.status).toContain('No live tracking source is configured');
    const unknown: TrackingContainer = {};
    applyGenericTracking(unknown, { guessedCarrier: undefined });
    expect(unknown.liveTracking).toMatchObject({ resolved: false, status: 'Unable to identify carrier from container number' });
  });
});

describe('registry builds the chain from the environment', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(process.env)) if (/^(MAERSK_|MSC_|CMACGM_|CMA_CGM_|HAPAG_LLOYD_|MARINETRAFFIC_|SCRAPER_|TRACKING_SCRAPER)/.test(k)) delete process.env[k];
    resetTrackingRegistryForTests();
  });
  afterEach(() => {
    process.env = { ...saved };
    resetTrackingRegistryForTests();
  });

  it('has no live source for a carrier until something is configured', () => {
    process.env.TRACKING_SCRAPER_ENABLED = 'false';
    expect(getTrackingProvider('Maersk')).toBeUndefined();
    expect(describeTrackingSources().every((c) => c.liveSources.length === 0)).toBe(true);
  });

  it('enables the Maersk public UI scraper by default', () => {
    expect(getTrackingProvider('Maersk')?.labels).toEqual(['public page scraper']);
  });

  it('orders carrier API, then MarineTraffic, then the scraper', () => {
    process.env.MAERSK_DCSA_CLIENT_ID = 'id';
    process.env.MAERSK_DCSA_CLIENT_SECRET = 'secret';
    process.env.MARINETRAFFIC_API_KEY = 'key';
    process.env.TRACKING_SCRAPER_ENABLED = 'true';
    process.env.SCRAPER_URL_MAERSK = 'https://example.test/track/{container}';
    expect(getTrackingProvider('Maersk')?.labels).toEqual(['carrier API', 'MarineTraffic', 'public page scraper']);
  });

  it('MarineTraffic alone covers any carrier whose SCAC is known, and not one whose SCAC is not', () => {
    process.env.MARINETRAFFIC_API_KEY = 'key';
    process.env.TRACKING_SCRAPER_ENABLED = 'false';
    expect(getTrackingProvider('MSC')?.labels).toEqual(['MarineTraffic']);
    expect(getTrackingProvider('NileDutch')).toBeUndefined();
  });

  it('the scraper can be disabled', () => {
    process.env.SCRAPER_URL_MSC = 'https://example.test/msc';
    process.env.TRACKING_SCRAPER_ENABLED = 'false';
    expect(getTrackingProvider('MSC')).toBeUndefined();
  });

  it('uses the MSC public UI scraper by default', () => {
    expect(getTrackingProvider('MSC')?.labels).toEqual(['public page scraper']);
  });

  it('uses a custom static scraper URL for MSC when configured', () => {
    process.env.SCRAPER_URL_MSC = 'https://example.test/msc?container={container}';
    expect(getTrackingProvider('MSC')?.labels).toEqual(['public page scraper']);
  });

  it('uses the Maersk public UI scraper when scraping is enabled without a custom URL', () => {
    process.env.TRACKING_SCRAPER_ENABLED = 'true';
    expect(getTrackingProvider('Maersk')?.labels).toEqual(['public page scraper']);
  });

  it.each(['CMA CGM', 'Hapag-Lloyd'])('uses the %s public UI scraper by default', (carrierName) => {
    expect(getTrackingProvider(carrierName)?.labels).toEqual(['public page scraper']);
  });

  it.each([
    ['CMA CGM', 'SCRAPER_URL_CMA_CGM'],
    ['Hapag-Lloyd', 'SCRAPER_URL_HAPAG_LLOYD'],
  ])('allows a custom static scraper URL for %s', (carrierName, variableName) => {
    process.env[variableName] = 'https://example.test/track?container={container}';
    expect(getTrackingProvider(carrierName)?.labels).toEqual(['public page scraper']);
  });
});
