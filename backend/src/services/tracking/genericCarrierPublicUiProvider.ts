import { existsSync } from 'node:fs';
import { Browser, chromium, Page } from 'playwright';
import { extractGenericTracking } from './genericPageExtractor';
import { TrackingProvider, TrackingResult } from './types';

const DEFAULT_TIMEOUT_MS = 20000;
const MIN_LOOKUP_INTERVAL_MS = 5000;
const CONTAINER_NUMBER_PATTERN = /^[A-Z]{3}U[A-Z0-9]{7}$/;
const WINDOWS_BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const CHALLENGE_PATTERN = /captcha|verify (?:that )?you are human|unusual traffic|access denied|request blocked|security check|verifying the device|datadome/i;
const NO_RESULT_PATTERN = /no (?:tracking )?results?|no shipment|container (?:number )?not found|unable to find/i;

export interface GenericCarrierPublicUiConfig {
  carrierName: 'CMA CGM' | 'Hapag-Lloyd';
  trackingUrl: string;
  chromiumExecutablePath?: string;
}

let browserPromise: Promise<Browser> | undefined;

function timeoutMs(): number {
  const configured = Number(process.env.TRACKING_SCRAPER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60000) : DEFAULT_TIMEOUT_MS;
}

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sourcePrefix(carrierName: string): string {
  return carrierName === 'CMA CGM' ? 'cma_cgm' : 'hapag_lloyd';
}

function unresolved(carrierName: string, status: string, reason: string): TrackingResult {
  return { resolved: false, carrierName, status, source: `scraper:${sourcePrefix(carrierName)}_public_ui_${reason}` };
}

export function parseGenericCarrierPublicPage(
  text: string,
  containerNumber: string,
  carrierName: GenericCarrierPublicUiConfig['carrierName'],
  referenceType: 'container' | 'bill_of_lading' = 'container',
): TrackingResult {
  const expected = normalize(containerNumber);
  const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(expected) : CONTAINER_NUMBER_PATTERN.test(expected);
  if (!valid) {
    return unresolved(carrierName, 'Invalid container number', 'invalid_input');
  }
  if (CHALLENGE_PATTERN.test(text)) {
    return unresolved(carrierName, `${carrierName} public tracker returned an access challenge; automatic lookup stopped`, 'challenge');
  }
  if (NO_RESULT_PATTERN.test(text)) {
    return unresolved(carrierName, `No tracking result found on the ${carrierName} public tracker`, 'empty');
  }

  const proposal = extractGenericTracking(text, expected);
  if (!proposal.containerFound) {
    return unresolved(carrierName, `${carrierName} public tracker did not return the requested ${referenceType === 'bill_of_lading' ? 'bill of lading' : 'container'}`, 'mismatch');
  }
  if (!proposal.status && !proposal.eta && !proposal.departedAt) {
    return unresolved(carrierName, `${carrierName} page loaded but contained no parseable tracking event`, 'unparsed');
  }

  return {
    resolved: true,
    carrierName,
    matchedContainerNumber: text.match(/\b[A-Z]{4}\d{7}\b/)?.[0],
    status: proposal.status || 'Tracking result found',
    vesselName: proposal.vesselName,
    eta: proposal.eta,
    departedAt: proposal.departedAt,
    latestEvent: proposal.latestEvent,
    checkedAt: new Date(),
    source: `scraper:${sourcePrefix(carrierName)}_public_ui`,
  };
}

async function getBrowser(executablePath?: string): Promise<Browser> {
  if (!browserPromise) {
    const installedBrowser = executablePath || WINDOWS_BROWSER_PATHS.find(existsSync);
    browserPromise = chromium.launch({
      headless: true,
      ...(installedBrowser ? { executablePath: installedBrowser } : {}),
    }).catch((error: unknown) => {
      browserPromise = undefined;
      throw error;
    });
  }

  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = undefined;
    return getBrowser(executablePath);
  }
  return browser;
}

export class GenericCarrierPublicUiTrackingProvider implements TrackingProvider {
  readonly carrierName: GenericCarrierPublicUiConfig['carrierName'];
  private lookupQueue: Promise<void> = Promise.resolve();
  private lastLookupAt = 0;

  constructor(private readonly config: GenericCarrierPublicUiConfig) {
    this.carrierName = config.carrierName;
  }

  async fetchTracking(containerNumber: string, ctx?: import('./types').TrackingContext): Promise<TrackingResult> {
    const normalized = normalize(containerNumber);
    const referenceType = ctx?.referenceType || 'container';
    const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(normalized) : CONTAINER_NUMBER_PATTERN.test(normalized);
    if (!valid) {
      return unresolved(this.carrierName, 'Invalid container number', 'invalid_input');
    }

    const result = this.lookupQueue.then(async () => {
      const delay = MIN_LOOKUP_INTERVAL_MS - (Date.now() - this.lastLookupAt);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      this.lastLookupAt = Date.now();
      return this.readPage(normalized, referenceType);
    });
    this.lookupQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readPage(containerNumber: string, referenceType: 'container' | 'bill_of_lading'): Promise<TrackingResult> {
    let page: Page | undefined;
    try {
      const browser = await getBrowser(this.config.chromiumExecutablePath);
      page = await browser.newPage();
      const timeout = timeoutMs();
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      await page.goto(this.config.trackingUrl, { waitUntil: 'domcontentloaded', timeout });

      const body = page.locator('body');
      let text = await body.innerText();
      if (CHALLENGE_PATTERN.test(text)) {
        return parseGenericCarrierPublicPage(text, containerNumber, this.carrierName, referenceType);
      }

      const input = page.getByPlaceholder(/container|tracking|bill of lading|bl number/i).first();
      if (!await input.isVisible().catch(() => false)) {
        return unresolved(this.carrierName, `${this.carrierName} public tracker input was not found`, 'layout_changed');
      }

      await input.fill(containerNumber);
      const trackButton = page.getByRole('button', { name: /track|search|submit/i }).first();
      if (await trackButton.isVisible().catch(() => false)) {
        await trackButton.click();
      } else {
        await input.press('Enter');
      }

      const expected = normalize(containerNumber);
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        text = await body.innerText();
        if (CHALLENGE_PATTERN.test(text) || NO_RESULT_PATTERN.test(text) || normalize(text).includes(expected)) {
          return parseGenericCarrierPublicPage(text, containerNumber, this.carrierName, referenceType);
        }
        await page.waitForTimeout(500);
      }

      return unresolved(this.carrierName, `Timed out waiting for the ${this.carrierName} public tracker result`, 'timeout');
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 180) : 'Unknown browser error';
      return unresolved(this.carrierName, `${this.carrierName} public tracker lookup failed: ${message}`, 'error');
    } finally {
      if (page) await page.close();
    }
  }
}
