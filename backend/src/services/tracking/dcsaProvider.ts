import axios from 'axios';
import { TrackingProvider, TrackingResult } from './types';

// Generic client for any carrier that runs a DCSA Track & Trace-conformant
// API (v2.2) — this is an industry standard co-authored by MSC, Maersk, CMA
// CGM, Hapag-Lloyd, ONE, Evergreen, Yang Ming, HMM and COSCO, so one client
// works for any of them once you have that carrier's own credentials. It is
// NOT a universal key: each carrier issues its own OAuth2 client
// credentials from its own developer portal (e.g. developer.maersk.com),
// and this provider only exists for a carrier once those are configured —
// see services/tracking/registry.ts.
//
// This has been written against the published DCSA Track & Trace v2.2
// specification, but has not been exercised against a live carrier
// endpoint from this environment (no credentials were available to test
// with). Verify against the carrier's own sandbox before relying on it.
export interface DcsaProviderConfig {
  carrierName: string;
  tokenUrl: string;
  apiBaseUrl: string; // e.g. https://api.maersk.com/track-and-trace-private
  clientId: string;
  clientSecret: string;
  scope?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class DcsaTrackingProvider implements TrackingProvider {
  carrierName: string;
  private config: DcsaProviderConfig;
  private tokenCache: CachedToken | null = null;

  constructor(config: DcsaProviderConfig) {
    this.carrierName = config.carrierName;
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5000) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...(this.config.scope ? { scope: this.config.scope } : {}),
    });

    const response = await axios.post(this.config.tokenUrl, body.toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const accessToken = response.data.access_token as string;
    const expiresInSeconds = (response.data.expires_in as number) || 3600;
    this.tokenCache = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
    return accessToken;
  }

  async fetchTracking(containerNumber: string): Promise<TrackingResult> {
    try {
      const token = await this.getAccessToken();

      // DCSA Track & Trace: GET /events, filtered by equipment reference
      // (the container number) and event type, most recent first. Exact
      // query-param naming can vary slightly by carrier's own gateway even
      // when the payload shape is DCSA-conformant — confirm against the
      // specific carrier's published OpenAPI spec on their developer portal
      // before going live.
      const response = await axios.get(`${this.config.apiBaseUrl}/events`, {
        params: { equipmentReference: containerNumber, limit: 20, sort: '-eventDateTime' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const events = Array.isArray(response.data) ? response.data : response.data?.events || [];
      if (events.length === 0) {
        return { resolved: false, carrierName: this.carrierName, status: 'No events found for this container yet', source: `dcsa_api:${this.carrierName.toLowerCase()}` };
      }

      const latest = events[0];
      return {
        resolved: true,
        carrierName: this.carrierName,
        status: latest.eventClassifierCode === 'PLN' ? `Planned: ${latest.transportEventTypeCode || latest.documentTypeCode}` : (latest.description || latest.transportEventTypeCode),
        vesselName: latest.transportCall?.vessel?.vesselName,
        eta: latest.eventDateTime ? new Date(latest.eventDateTime) : undefined,
        source: `dcsa_api:${this.carrierName.toLowerCase()}`,
      };
    } catch (err) {
      const message = axios.isAxiosError(err) ? `${err.response?.status || ''} ${err.message}`.trim() : (err as Error).message;
      // Failure here must not be silently swallowed into a fake "resolved"
      // result — surface it as an explicit, labeled error state so it's
      // obvious in the UI that the live call failed rather than that the
      // container has no tracking data.
      return { resolved: false, carrierName: this.carrierName, status: `Tracking lookup failed: ${message}`, source: `dcsa_api:${this.carrierName.toLowerCase()}_error` };
    }
  }
}
