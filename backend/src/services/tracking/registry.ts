import { DcsaTrackingProvider } from './dcsaProvider';
import { ScraperTrackingProvider } from './scraperProvider';
import { MaerskPublicUiTrackingProvider } from './maerskPublicUiProvider';
import { MscPublicUiTrackingProvider } from './mscPublicUiProvider';
import { GenericCarrierPublicUiTrackingProvider } from './genericCarrierPublicUiProvider';
import { MarineTrafficProvider } from './marineTrafficProvider';
import { ChainTrackingProvider, ChainMember } from './chainProvider';
import { scacFor } from './carrierScac';
import { TrackingProvider } from './types';

// How a container is looked up. Each carrier gets an ordered chain, and the
// first source that has an answer wins:
//
//   1. The carrier's own API (DCSA Track & Trace), when its credentials are set.
//   2. MarineTraffic's Container Tracking API, a paid carrier-independent
//      backup, when MARINETRAFFIC_API_KEY is set and the carrier's SCAC is known.
//   3. The public-page scraper (enabled by default; disable with
//      TRACKING_SCRAPER_ENABLED=false).
//      Maersk and MSC use their public UIs; other carriers need
//      SCRAPER_URL_<CARRIER> and a result page whose data is in returned HTML.
//   4. Generic public tracking, which needs no setup and is the last resort:
//      the carrier is identified from the container prefix and the app links
//      to the carrier's own public tracking page (PUBLIC_TRACKER_URLS below).
//      Staff can also capture a result from that page (see the Track button).
//
// Steps 1 to 3 live in this file; step 4 is trackingRefresh.ts.
//
// Where to get these, per carrier (self-service, free registration as of
// this writing — carrier portals change, so verify before relying on this):
//   Maersk:      developer.maersk.com  → Track & Trace API → OAuth2 client credentials
//   CMA CGM:     developer.cma-cgm.com → Track & Trace API → OAuth2 client credentials
//   Hapag-Lloyd: api-portal.hlag.com   → self-service portal, DCSA-conformant Track & Trace
//
// MSC's DCSA API access (developerportal.msc.com, versions 1.2/2.2) goes
// through its sales team. Its public UI remains available as a scraper fallback.
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
function buildCarrierApiProviders(): Record<string, TrackingProvider> {
  const providers: Record<string, TrackingProvider> = {};

  if (process.env.MAERSK_DCSA_CLIENT_ID && process.env.MAERSK_DCSA_CLIENT_SECRET) {
    providers['Maersk'] = new DcsaTrackingProvider({
      carrierName: 'Maersk',
      tokenUrl: process.env.MAERSK_DCSA_TOKEN_URL || 'https://api.maersk.com/customer-identity/oauth/v2/access_token',
      apiBaseUrl: process.env.MAERSK_DCSA_API_BASE_URL || 'https://api.maersk.com/track-and-trace-private',
      clientId: process.env.MAERSK_DCSA_CLIENT_ID,
      clientSecret: process.env.MAERSK_DCSA_CLIENT_SECRET,
      // Maersk requires the Consumer Key header as well as the bearer token.
      // The consumer key is the same value as the OAuth client id.
      consumerKey: process.env.MAERSK_DCSA_CONSUMER_KEY || process.env.MAERSK_DCSA_CLIENT_ID,
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

  return providers;
}

function carrierSlug(carrierName: string): string {
  return carrierName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Maersk, MSC, CMA CGM, and Hapag-Lloyd use their public UIs unless custom
// SCRAPER_URL_* values are supplied. Other carriers use a static result page.
function buildScraper(carrierName: string): TrackingProvider | undefined {
  if (process.env.TRACKING_SCRAPER_ENABLED === 'false') return undefined;
  const slug = carrierSlug(carrierName);
  const url = process.env[`SCRAPER_URL_${slug}`];
  if (carrierName === 'Maersk' && !url) return new MaerskPublicUiTrackingProvider();
  if (carrierName === 'MSC' && !url) return new MscPublicUiTrackingProvider();
  if (carrierName === 'CMA CGM' && !url) {
    return new GenericCarrierPublicUiTrackingProvider({
      carrierName,
      trackingUrl: process.env.CMA_CGM_TRACKING_URL || PUBLIC_TRACKER_URLS[carrierName],
      chromiumExecutablePath: process.env.CMA_CGM_CHROMIUM_EXECUTABLE_PATH,
    });
  }
  if (carrierName === 'Hapag-Lloyd' && !url) {
    return new GenericCarrierPublicUiTrackingProvider({
      carrierName,
      trackingUrl: process.env.HAPAG_LLOYD_TRACKING_URL || PUBLIC_TRACKER_URLS[carrierName],
      chromiumExecutablePath: process.env.HAPAG_LLOYD_CHROMIUM_EXECUTABLE_PATH,
    });
  }
  if (!url) return undefined;
  const param = process.env[`SCRAPER_PARAM_${slug}`];
  return new ScraperTrackingProvider({ carrierName, trackingUrl: url, queryParamName: param });
}

let carrierApiProviders: Record<string, TrackingProvider> | null = null;
let marineTraffic: MarineTrafficProvider | null | undefined;
const chains = new Map<string, ChainTrackingProvider | null>();

function marineTrafficProvider(): MarineTrafficProvider | null {
  if (marineTraffic === undefined) {
    marineTraffic = process.env.MARINETRAFFIC_API_KEY
      ? new MarineTrafficProvider({ apiKey: process.env.MARINETRAFFIC_API_KEY, baseUrl: process.env.MARINETRAFFIC_API_BASE_URL })
      : null;
  }
  return marineTraffic;
}

function buildChain(carrierName: string): ChainTrackingProvider | null {
  if (!carrierApiProviders) carrierApiProviders = buildCarrierApiProviders();
  const members: ChainMember[] = [];

  const api = carrierApiProviders[carrierName];
  if (api) members.push({ label: 'carrier API', provider: api });

  const mt = marineTrafficProvider();
  if (mt && scacFor(carrierName)) members.push({ label: 'MarineTraffic', provider: mt });

  const scraper = buildScraper(carrierName);
  if (scraper) members.push({ label: 'public page scraper', provider: scraper });

  return members.length > 0 ? new ChainTrackingProvider(carrierName, members) : null;
}

// The lookup chain for a carrier, or undefined when nothing is configured for
// it (generic public tracking then applies; see trackingRefresh.ts).
export function getTrackingProvider(carrierName: string | undefined): ChainTrackingProvider | undefined {
  if (!carrierName) return undefined;
  if (!chains.has(carrierName)) chains.set(carrierName, buildChain(carrierName));
  return chains.get(carrierName) ?? undefined;
}

// What is switched on for each carrier, for a settings screen to show. The
// public link and manual capture are always available.
export interface TrackingSourceSummary {
  carrier: string;
  liveSources: string[]; // e.g. ['carrier API', 'MarineTraffic']
}

export function describeTrackingSources(): TrackingSourceSummary[] {
  return Object.keys(PUBLIC_TRACKER_URLS).map((carrier) => ({ carrier, liveSources: getTrackingProvider(carrier)?.labels ?? [] }));
}

// Lets tests change the environment between cases.
export function resetTrackingRegistryForTests(): void {
  carrierApiProviders = null;
  marineTraffic = undefined;
  chains.clear();
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
