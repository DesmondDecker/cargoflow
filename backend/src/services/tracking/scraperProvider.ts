import axios from 'axios';
import { TrackingProvider, TrackingResult } from './types';

export interface ScraperProviderConfig {
  carrierName: string;
  trackingUrl: string;
  queryParamName?: string;
}

function stripHtml(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] || match[0]).trim();
    }
  }
  return undefined;
}

function parseIsoDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseTrackingHtml(html: string): TrackingResult {
  const text = stripHtml(html);
  const lower = text.toLowerCase();

  if (/no shipment|no result|not found|no records|tracking unavailable|please check/i.test(lower)) {
    return {
      resolved: false,
      status: 'No tracking result found on the public carrier page',
      source: 'scraper:public_tracker_empty',
    };
  }

  const status = firstMatch(text, [
    /(?:current\s+status|status)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 ,;/().-]{2,120})/i,
    /(?:shipment\s+status|container\s+status)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 ,;/().-]{2,120})/i,
    /(?:in transit|delivered|arrived|loaded|discharged|gate in|gate out|on vessel)/i,
    /([A-Za-z0-9][A-Za-z0-9 ,;/().-]{2,120})\s*(?:in transit|delivered|arrived|loaded|discharged|gate in|gate out|on vessel)/i,
  ]);

  const vesselNameRaw = firstMatch(text, [
    /((?:MV|M\/V|MS|voyage)\s+[A-Za-z0-9][A-Za-z0-9 .'-]{0,80}?)(?=\s+(?:Estimated|ETA|Arrival|Status|Route)|$)/i,
    /(?:vessel|ship)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 .'-]{2,80})(?=\s+(?:Estimated|ETA|Arrival|Status|Route)|$)/i,
  ]);
  const vesselName = vesselNameRaw ? vesselNameRaw.replace(/^(?:vessel|ship)\s*[:\-]?\s*/i, '').trim() : undefined;

  const etaRaw = firstMatch(text, [
    /(?:eta|estimated\s+arrival|estimated\s+date\s+of\s+arrival|arrival\s+date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2} [A-Za-z]{3,9} \d{4}|[A-Za-z]{3,9} \d{1,2}, \d{4})/i,
  ]);

  const eta = etaRaw ? parseIsoDate(etaRaw) : undefined;

  if (!status && !vesselName && !eta) {
    return {
      resolved: false,
      status: 'Tracking page loaded but no parseable container status was found',
      source: 'scraper:public_tracker_unparsed',
    };
  }

  return {
    resolved: true,
    status: status || 'Tracking result found',
    vesselName: vesselName || undefined,
    eta,
    source: 'scraper:public_tracker',
  };
}

export class ScraperTrackingProvider implements TrackingProvider {
  carrierName: string;
  private config: ScraperProviderConfig;

  constructor(config: ScraperProviderConfig) {
    this.carrierName = config.carrierName;
    this.config = config;
  }

  private buildUrl(containerNumber: string): string {
    const url = new URL(this.config.trackingUrl);
    if (this.config.trackingUrl.includes('{container}') || this.config.trackingUrl.includes('{{container}}')) {
      return this.config.trackingUrl.replace('{container}', encodeURIComponent(containerNumber)).replace('{{container}}', encodeURIComponent(containerNumber));
    }

    const paramName = this.config.queryParamName || 'container';
    url.searchParams.set(paramName, containerNumber);
    return url.toString();
  }

  async fetchTracking(containerNumber: string): Promise<TrackingResult> {
    const url = this.buildUrl(containerNumber);

    try {
      const response = await axios.get(url, {
        timeout: Number(process.env.TRACKING_SCRAPER_TIMEOUT_MS || 20000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? {});
      const parsed = parseTrackingHtml(html);
      return {
        ...parsed,
        carrierName: this.carrierName,
      };
    } catch (error) {
      const message = axios.isAxiosError(error) ? `${error.response?.status || ''} ${error.message}`.trim() : (error as Error).message;
      return {
        resolved: false,
        carrierName: this.carrierName,
        status: `Scraper lookup failed: ${message}`,
        source: 'scraper:public_tracker_error',
      };
    }
  }
}
