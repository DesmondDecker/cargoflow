import axios from 'axios';
import { scacFor } from './carrierScac';
import { TrackingContext, TrackingProvider, TrackingResult } from './types';

// Backup source: MarineTraffic's (Kpler's) Container Tracking API. It follows
// a container across carriers, which makes it useful when a carrier has no
// API of its own configured. It is a paid service: the key comes from
// sales@kpler.com (see https://container-tracking.marinetraffic.com).
//
// How it works, from that API's published documentation:
//   - every request carries the key in the X-Container-API-Key header;
//   - POST /tracking-requests registers a container (reference number type
//     "container" plus the carrier's SCAC) and answers with the request's
//     status and the id of the resulting shipment;
//   - GET /shipments/{id} returns the shipment summary: transportation
//     status, current vessel, port of discharge arrival (actual or estimated).
//
// The shipment id is kept on the container (externalRef) so later refreshes
// make one call instead of two. Looking an existing request up by container
// number uses a `filter[referenceNumber]` parameter; the documentation names
// that filter but does not spell out its syntax, so that one call is the part
// to confirm against a real key. If it is wrong, the failure is reported in
// the status text and never turned into fake data.

export interface MarineTrafficConfig {
  apiKey: string;
  baseUrl?: string;
}

const DEFAULT_BASE = 'https://api.kpler.com/v1/logistics/containers';

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface ShipmentAttributes {
  transportationStatus?: string;
  currentVessel?: { name?: string };
  portOfLoading?: { loadingVessel?: { name?: string } };
  portOfDischarge?: { arrivalDate?: { timestamp?: string; status?: string } };
  insights?: { arrivalDelayDays?: number };
}

export class MarineTrafficProvider implements TrackingProvider {
  carrierName = 'MarineTraffic';
  private baseUrl: string;

  constructor(private config: MarineTrafficConfig) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  }

  private get headers() {
    return { 'X-Container-API-Key': this.config.apiKey, Accept: 'application/json' };
  }

  private async findShipmentId(containerNumber: string, scac: string): Promise<{ shipmentId?: string; status?: string; reason?: string }> {
    const created = await axios.post(
      `${this.baseUrl}/tracking-requests`,
      { data: [{ type: 'tracking_request', attributes: { referenceNumberType: 'container', referenceNumber: containerNumber, scac } }] },
      { headers: { ...this.headers, 'Content-Type': 'application/json' }, timeout: 15000, validateStatus: (s) => s < 500 }
    );
    const first = created.data?.data?.[0];
    const fromCreate = first?.relationships?.shipment?.data?.shipmentId as string | undefined;
    if (fromCreate) return { shipmentId: fromCreate, status: first?.attributes?.status };

    // Already registered, or still being processed: look the request up.
    const listed = await axios.get(`${this.baseUrl}/tracking-requests`, {
      headers: this.headers,
      params: { filter: { referenceNumber: containerNumber } },
      timeout: 15000,
    });
    const existing = listed.data?.data?.[0];
    const id = existing?.relationships?.shipment?.data?.shipmentId as string | undefined;
    if (id) return { shipmentId: id, status: existing?.attributes?.status };

    const reason = created.data?.errors?.[0]?.description || existing?.attributes?.failed_reason || first?.attributes?.failed_reason;
    return { status: existing?.attributes?.status || first?.attributes?.status, reason };
  }

  async fetchTracking(containerNumber: string, ctx?: TrackingContext): Promise<TrackingResult> {
    const scac = scacFor(ctx?.carrierName);
    const source = `marinetraffic:${scac || 'unknown'}`;
    try {
      let shipmentId = ctx?.externalRef;
      if (!shipmentId) {
        if (!scac) {
          return { resolved: false, status: `MarineTraffic needs the carrier's SCAC code and none is known for ${ctx?.carrierName || 'this carrier'}`, source: `${source}_error` };
        }
        const found = await this.findShipmentId(containerNumber, scac);
        if (!found.shipmentId) {
          return {
            resolved: false,
            status: found.reason ? `MarineTraffic could not track this container: ${found.reason}` : `MarineTraffic has not finished setting up tracking${found.status ? ` (${found.status})` : ''}. Try again later.`,
            source: `${source}_pending`,
          };
        }
        shipmentId = found.shipmentId;
      }

      const response = await axios.get(`${this.baseUrl}/shipments/${encodeURIComponent(shipmentId)}`, { headers: this.headers, timeout: 15000 });
      const attrs = (response.data?.data?.attributes ?? {}) as ShipmentAttributes;
      if (!attrs.transportationStatus && !attrs.currentVessel && !attrs.portOfDischarge) {
        return { resolved: false, status: 'MarineTraffic returned no tracking data for this container yet', source: `${source}_empty`, externalRef: shipmentId };
      }

      const arrival = attrs.portOfDischarge?.arrivalDate;
      const delay = attrs.insights?.arrivalDelayDays;
      const parts = [attrs.transportationStatus ? humanize(attrs.transportationStatus) : 'Tracked'];
      if (typeof delay === 'number' && delay > 0) parts.push(`${delay} day${delay === 1 ? '' : 's'} behind the carrier's ETA`);
      return {
        resolved: true,
        status: parts.join(', '),
        vesselName: attrs.currentVessel?.name || attrs.portOfLoading?.loadingVessel?.name,
        eta: arrival?.timestamp ? new Date(arrival.timestamp) : undefined,
        source,
        externalRef: shipmentId,
      };
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = axios.isAxiosError(err) ? `${status || ''} ${err.message}`.trim() : (err as Error).message;
      return {
        resolved: false,
        status: `MarineTraffic lookup failed: ${message}`,
        source: `${source}_error`,
        // A shipment that no longer exists must not be asked for again.
        externalRef: status === 404 ? undefined : ctx?.externalRef,
      };
    }
  }
}
