import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DcsaTrackingProvider } from './dcsaProvider';

vi.mock('axios');
const mocked = vi.mocked(axios, true);

describe('DcsaTrackingProvider Consumer-Key header', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (mocked.isAxiosError as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);
    mocked.post.mockResolvedValue({ data: { access_token: 'tok', expires_in: 3600 } });
    mocked.get.mockResolvedValue({ data: { events: [{ eventDateTime: '2026-10-20T10:00:00Z', transportEventTypeCode: 'ARRI', eventClassifierCode: 'ACT' }] } });
  });

  it('sends Consumer-Key on the token request and the events request', async () => {
    const p = new DcsaTrackingProvider({
      carrierName: 'Maersk',
      tokenUrl: 'https://api.maersk.com/customer-identity/oauth/v2/access_token',
      apiBaseUrl: 'https://api.maersk.com/track-and-trace-private',
      clientId: 'KEY',
      clientSecret: 'SECRET',
      consumerKey: 'KEY',
    });
    const r = await p.fetchTracking('MSKU1234565');
    expect(mocked.post.mock.calls[0][2]?.headers).toMatchObject({ 'Consumer-Key': 'KEY' });
    expect(mocked.get.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer tok', 'Consumer-Key': 'KEY' });
    expect(r.resolved).toBe(true);
  });

  it('omits Consumer-Key when none is configured (other carriers unchanged)', async () => {
    const p = new DcsaTrackingProvider({ carrierName: 'X', tokenUrl: 't', apiBaseUrl: 'a', clientId: 'c', clientSecret: 's' });
    await p.fetchTracking('MSKU1234565');
    expect(mocked.get.mock.calls[0][1]?.headers).not.toHaveProperty('Consumer-Key');
  });

  it('queries DCSA by transport document reference for a bill of lading', async () => {
    const p = new DcsaTrackingProvider({ carrierName: 'Maersk', tokenUrl: 't', apiBaseUrl: 'a', clientId: 'c', clientSecret: 's' });
    await p.fetchTracking('270560510', { referenceType: 'bill_of_lading' });
    expect(mocked.get.mock.calls[0][1]?.params).toMatchObject({ transportDocumentReference: '270560510' });
    expect(mocked.get.mock.calls[0][1]?.params).not.toHaveProperty('equipmentReference');
  });
});
