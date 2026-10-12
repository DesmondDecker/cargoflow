import { describe, expect, it } from 'vitest';
import { listItemShape } from './containerController';

describe('listItemShape', () => {
  it('keeps the latest live tracking payload in the app-facing container list', () => {
    const result = listItemShape({
      _id: 'container_123',
      containerNumber: 'MSCU1234567',
      status: 'in_transit',
      attentionLevel: 'normal',
      attentionReasons: [],
      shippingLine: 'MSC',
      vessel: 'MV Atlantic',
      importerId: { _id: 'imp_1', name: 'Acme Imports' },
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      version: 3,
      liveTracking: {
        resolved: true,
        carrierName: 'MSC',
        status: 'In transit',
        vesselName: 'MV Atlantic',
        eta: new Date('2026-01-08T00:00:00Z'),
        source: 'scraper:public_tracker',
        publicTrackingUrl: 'https://example.com/tracking',
      },
    });

    expect(result.liveTracking).toMatchObject({
      resolved: true,
      carrierName: 'MSC',
      status: 'In transit',
      vesselName: 'MV Atlantic',
      source: 'scraper:public_tracker',
    });
  });
});
