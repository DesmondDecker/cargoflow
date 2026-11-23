// Carriers the agency can track on. Names match the backend's shipping-line
// names (backend/src/services/tracking/registry.ts PUBLIC_TRACKER_URLS), so
// choosing one here is saved as the container's shipping line.
//
// Only Maersk's tracking page takes the number in the URL. The rest open the
// carrier's tracker page and the agent types the number in. These addresses
// are carriers' own public pages and can change without notice, so re-check
// them now and then.
//
// Capture: Maersk's result is read automatically (its page layout is known).
// For every other carrier the app reads the page with generic heuristics and
// shows what it found for the user to correct before anything is saved.
export interface Carrier {
  name: string;
  trackingUrl: (containerNumber: string) => string;
  prefillsNumber: boolean;
  // 'auto' = read by an exact parser, saved directly. 'review' = best-effort
  // read that the user confirms first.
  captureMode: 'auto' | 'review';
}

const page = (url: string) => (): string => url;

export const CARRIERS: Carrier[] = [
  { name: 'Maersk', trackingUrl: (n) => `https://www.maersk.com/tracking/${encodeURIComponent(n)}`, prefillsNumber: true, captureMode: 'auto' },
  { name: 'MSC', trackingUrl: page('https://www.msc.com/en/track-a-shipment'), prefillsNumber: false, captureMode: 'review' },
  { name: 'CMA CGM', trackingUrl: page('https://www.cma-cgm.com/ebusiness/tracking'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Hapag-Lloyd', trackingUrl: page('https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Ocean Network Express', trackingUrl: page('https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking'), prefillsNumber: false, captureMode: 'review' },
  { name: 'COSCO', trackingUrl: page('https://elines.coscoshipping.com/ebusiness/cargoTracking'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Evergreen', trackingUrl: page('https://www.shipmentlink.com/tvs2/jsp/TVS2_CargoTracking.jsp'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Yang Ming', trackingUrl: page('https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx'), prefillsNumber: false, captureMode: 'review' },
  { name: 'HMM', trackingUrl: page('https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.jsp'), prefillsNumber: false, captureMode: 'review' },
  { name: 'ZIM', trackingUrl: page('https://www.zim.com/tools/track-a-shipment'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Pacific International Lines', trackingUrl: page('https://www.pilship.com/en/quick-access/track-trace.html'), prefillsNumber: false, captureMode: 'review' },
  { name: 'Wan Hai', trackingUrl: page('https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml'), prefillsNumber: false, captureMode: 'review' },
  { name: 'NileDutch', trackingUrl: page('https://www.niledutch.com/tracking'), prefillsNumber: false, captureMode: 'review' },
];

export function findCarrier(name?: string): Carrier | undefined {
  if (!name) return undefined;
  const wanted = name.trim().toLowerCase();
  return CARRIERS.find((c) => c.name.toLowerCase() === wanted);
}
