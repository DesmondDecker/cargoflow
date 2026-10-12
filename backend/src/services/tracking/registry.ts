import { DcsaTrackingProvider } from './dcsaProvider';
import { ScraperTrackingProvider } from './scraperProvider';
import { TrackingProvider } from './types';

// A carrier gets a real provider when its own API credentials are set.
// If the carrier does not expose a standards-based API, the scraper below
// provides a guarded fallback for public tracking pages, but only when the
// carrier URL is explicitly configured. This is intentionally opt-in and
// never enabled by default.
//
// Where to get these, per carrier (self-service, free registration as of
// this writing — carrier portals change, so verify before relying on this):
//   Maersk:      developer.maersk.com  → Track & Trace API → OAuth2 client credentials
//   CMA CGM:     developer.cma-cgm.com → Track & Trace API → OAuth2 client credentials
//   Hapag-Lloyd: api-portal.hlag.com   → self-service portal, DCSA-conformant Track & Trace
//
// MSC is NOT self-service like the three above — real API access
// (developerportal.msc.com, same DCSA standard, versions 1.2/2.2) exists
// but goes through MSC's sales team, with fees possibly applying depending
// on volume. If real credentials are not yet available, this registry will
// activate an opt-in public-page scraper instead when TRACKING_SCRAPER_ENABLED
// is true and MSC_TRACKER_URL is set, so the app still has a guarded fallback
// while the commercial API path is being arranged.
//
// Delmas has no entry anywhere in this codebase on purpose: it hasn't
// existed as an independent carrier since March 1, 2016, when CMA CGM fully
// absorbed the brand. Cargo documented as "Delmas" today moves under CMA
// CGM's own systems — configuring the CMA CGM provider above covers it;
// there is no separate Delmas API or tracking system left to integrate.
//
// ONE, Evergreen, Yang Ming, HMM and ZIM are documented DCSA Track & Trace
// adopters and are wired in below using the same DcsaTrackingProvider — but
// unlike Maersk/CMA CGM/Hapag-Lloyd, self-service portal access and the
// correct token/API URLs haven't been verified for any of them here, so
// there's no default URL to fall back on. Each requires all four of its own
// env vars (client id, secret, token URL, API base URL) before it activates
// at all — check that carrier's developer portal first.
function buildProviders(): Record<string, TrackingProvider> {
  const providers: Record<string, TrackingProvider> = {};

  if (process.env.MAERSK_DCSA_CLIENT_ID && process.env.MAERSK_DCSA_CLIENT_SECRET) {
    providers['Maersk'] = new DcsaTrackingProvider({
      carrierName: 'Maersk',
      tokenUrl: process.env.MAERSK_DCSA_TOKEN_URL || 'https://api.maersk.com/oauth2/access_token',
      apiBaseUrl: process.env.MAERSK_DCSA_API_BASE_URL || 'https://api.maersk.com/track-and-trace-private',
      clientId: process.env.MAERSK_DCSA_CLIENT_ID,
      clientSecret: process.env.MAERSK_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.CMACGM_DCSA_CLIENT_ID && process.env.CMACGM_DCSA_CLIENT_SECRET) {
    providers['CMA CGM'] = new DcsaTrackingProvider({
      carrierName: 'CMA CGM',
      tokenUrl: process.env.CMACGM_DCSA_TOKEN_URL || '',
      apiBaseUrl: process.env.CMACGM_DCSA_API_BASE_URL || '',
      clientId: process.env.CMACGM_DCSA_CLIENT_ID,
      clientSecret: process.env.CMACGM_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.HAPAG_LLOYD_DCSA_CLIENT_ID && process.env.HAPAG_LLOYD_DCSA_CLIENT_SECRET) {
    providers['Hapag-Lloyd'] = new DcsaTrackingProvider({
      carrierName: 'Hapag-Lloyd',
      tokenUrl: process.env.HAPAG_LLOYD_DCSA_TOKEN_URL || '',
      apiBaseUrl: process.env.HAPAG_LLOYD_DCSA_API_BASE_URL || '',
      clientId: process.env.HAPAG_LLOYD_DCSA_CLIENT_ID,
      clientSecret: process.env.HAPAG_LLOYD_DCSA_CLIENT_SECRET,
    });
  }

  // The five carriers below are documented DCSA Track & Trace adopters, so
  // the same DcsaTrackingProvider should work for them — but unlike Maersk,
  // self-service portal access hasn't been verified for any of them, so
  // there's no default tokenUrl/apiBaseUrl to fall back on the way Maersk
  // has. Nothing activates until BOTH the credentials AND the carrier's own
  // token/API URLs are supplied — verify access on each carrier's developer
  // portal first, then set all four env vars for that carrier.
  if (process.env.ONE_DCSA_CLIENT_ID && process.env.ONE_DCSA_CLIENT_SECRET && process.env.ONE_DCSA_TOKEN_URL && process.env.ONE_DCSA_API_BASE_URL) {
    providers['Ocean Network Express'] = new DcsaTrackingProvider({
      carrierName: 'Ocean Network Express',
      tokenUrl: process.env.ONE_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.ONE_DCSA_API_BASE_URL,
      clientId: process.env.ONE_DCSA_CLIENT_ID,
      clientSecret: process.env.ONE_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.EVERGREEN_DCSA_CLIENT_ID && process.env.EVERGREEN_DCSA_CLIENT_SECRET && process.env.EVERGREEN_DCSA_TOKEN_URL && process.env.EVERGREEN_DCSA_API_BASE_URL) {
    providers['Evergreen'] = new DcsaTrackingProvider({
      carrierName: 'Evergreen',
      tokenUrl: process.env.EVERGREEN_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.EVERGREEN_DCSA_API_BASE_URL,
      clientId: process.env.EVERGREEN_DCSA_CLIENT_ID,
      clientSecret: process.env.EVERGREEN_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.YANG_MING_DCSA_CLIENT_ID && process.env.YANG_MING_DCSA_CLIENT_SECRET && process.env.YANG_MING_DCSA_TOKEN_URL && process.env.YANG_MING_DCSA_API_BASE_URL) {
    providers['Yang Ming'] = new DcsaTrackingProvider({
      carrierName: 'Yang Ming',
      tokenUrl: process.env.YANG_MING_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.YANG_MING_DCSA_API_BASE_URL,
      clientId: process.env.YANG_MING_DCSA_CLIENT_ID,
      clientSecret: process.env.YANG_MING_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.HMM_DCSA_CLIENT_ID && process.env.HMM_DCSA_CLIENT_SECRET && process.env.HMM_DCSA_TOKEN_URL && process.env.HMM_DCSA_API_BASE_URL) {
    providers['HMM'] = new DcsaTrackingProvider({
      carrierName: 'HMM',
      tokenUrl: process.env.HMM_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.HMM_DCSA_API_BASE_URL,
      clientId: process.env.HMM_DCSA_CLIENT_ID,
      clientSecret: process.env.HMM_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.ZIM_DCSA_CLIENT_ID && process.env.ZIM_DCSA_CLIENT_SECRET && process.env.ZIM_DCSA_TOKEN_URL && process.env.ZIM_DCSA_API_BASE_URL) {
    providers['ZIM'] = new DcsaTrackingProvider({
      carrierName: 'ZIM',
      tokenUrl: process.env.ZIM_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.ZIM_DCSA_API_BASE_URL,
      clientId: process.env.ZIM_DCSA_CLIENT_ID,
      clientSecret: process.env.ZIM_DCSA_CLIENT_SECRET,
    });
  }

  // MSC: confirmed real DCSA Track & Trace API (developerportal.msc.com,
  // versions 1.2/2.2) — access goes through MSC's sales team rather than
  // self-service signup, so unlike Maersk there's no default token/API URL
  // to fall back on here either. Set all four once that conversation
  // produces real credentials; nothing else needs to change.
  if (process.env.MSC_DCSA_CLIENT_ID && process.env.MSC_DCSA_CLIENT_SECRET && process.env.MSC_DCSA_TOKEN_URL && process.env.MSC_DCSA_API_BASE_URL) {
    providers['MSC'] = new DcsaTrackingProvider({
      carrierName: 'MSC',
      tokenUrl: process.env.MSC_DCSA_TOKEN_URL,
      apiBaseUrl: process.env.MSC_DCSA_API_BASE_URL,
      clientId: process.env.MSC_DCSA_CLIENT_ID,
      clientSecret: process.env.MSC_DCSA_CLIENT_SECRET,
    });
  }

  if (process.env.TRACKING_SCRAPER_ENABLED === 'true' && !providers['MSC'] && process.env.MSC_TRACKER_URL) {
    providers['MSC'] = new ScraperTrackingProvider({
      carrierName: 'MSC',
      trackingUrl: process.env.MSC_TRACKER_URL,
      queryParamName: 'containerNumber',
    });
  }

  return providers;
}

let cachedProviders: Record<string, TrackingProvider> | null = null;

export function getTrackingProvider(carrierName: string | undefined): TrackingProvider | undefined {
  if (!carrierName) return undefined;
  if (!cachedProviders) cachedProviders = buildProviders();
  return cachedProviders[carrierName];
}

// Honest fallback for a carrier with no configured API (MSC today, and any
// other carrier before its credentials are set): a direct link to that
// carrier's own public tracking page so staff can check manually with one
// tap, rather than the app pretending to have live data it doesn't.
// Confirmed reachable at the time this was written; MSC's is a JS-rendered
// page with no query-string deep link found, so it opens the tracker
// homepage rather than a pre-filled result — worth re-checking periodically
// since carrier sites change without notice.
export const PUBLIC_TRACKER_URLS: Record<string, string> = {
  MSC: 'https://www.msc.com/en/track-a-shipment',
  Maersk: 'https://www.maersk.com/tracking/',
  'CMA CGM': 'https://www.cma-cgm.com/ebusiness/tracking',
  'Hapag-Lloyd': 'https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html',
  'Ocean Network Express': 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking',
  COSCO: 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
  Evergreen: 'https://www.shipmentlink.com/tvs2/jsp/TVS2_CargoTracking.jsp',
  'Yang Ming': 'https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx',
  HMM: 'https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.jsp',
  ZIM: 'https://www.zim.com/tools/track-a-shipment',
  'Pacific International Lines': 'https://www.pilship.com/en/quick-access/track-trace.html',
  // Lower confidence on the exact live path for these two — worth
  // spot-checking before relying on them:
  'Wan Hai': 'https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml',
  NileDutch: 'https://www.niledutch.com/tracking',
};
// carrierDetection.ts's OWNER_CODE_TO_LINE table now recognizes more lines
// than have a verified entry here (Atlantic Container Line, Hamburg Süd,
// Swire Shipping, Crowley, Matson, OOCL, and others) — deliberately left
// out rather than guessed. Each carrier's real tracking-page URL should be
// confirmed directly on that carrier's own site before adding it here.
