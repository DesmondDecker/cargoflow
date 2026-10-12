import { describe, expect, it } from 'vitest';
import { parseTrackingHtml } from './scraperProvider';

describe('parseTrackingHtml', () => {
  it('extracts the status, vessel and ETA from a tracking page', () => {
    const html = `
      <html>
        <body>
          <div class="status">In Transit</div>
          <div class="vessel">MV Atlantic Trader</div>
          <div class="eta">Estimated Arrival: 2026-10-15</div>
        </body>
      </html>
    `;

    const result = parseTrackingHtml(html);

    expect(result.resolved).toBe(true);
    expect(result.status).toMatch(/In Transit/i);
    expect(result.vesselName).toBe('MV Atlantic Trader');
    expect(result.eta?.toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('returns unresolved when the page indicates no result was found', () => {
    const html = '<html><body>No shipment found for this container number.</body></html>';

    expect(parseTrackingHtml(html)).toMatchObject({ resolved: false });
  });
});
