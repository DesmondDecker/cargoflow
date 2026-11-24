import { Browser, chromium, Page } from 'playwright';
import { existsSync } from 'node:fs';
import { extractGenericTracking } from './genericPageExtractor';
import { TrackingProvider, TrackingResult } from './types';

const TRACKING_URL = process.env.MSC_TRACKING_URL || 'https://www.msc.com/en/track-a-shipment';
const MIN_LOOKUP_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 20000;
const CONTAINER_NUMBER_PATTERN = /^[A-Z]{3}U[A-Z0-9]{7}$/;
const WINDOWS_BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

let browserPromise: Promise<Browser> | undefined;
let lookupQueue: Promise<void> = Promise.resolve();
let lastLookupAt = 0;

function timeoutMs(): number {
  const configured = Number(process.env.TRACKING_SCRAPER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60000) : DEFAULT_TIMEOUT_MS;
}

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function unresolved(status: string, source: string): TrackingResult {
  return { resolved: false, carrierName: 'MSC', status, source };
}

export function parseMscPublicPage(
  text: string,
  referenceNumber: string,
  referenceType: 'container' | 'bill_of_lading' = 'container',
): TrackingResult {
  const expected = normalize(referenceNumber);
  const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(expected) : CONTAINER_NUMBER_PATTERN.test(expected);
  if (!valid) {
    return unresolved('Invalid MSC container number', 'scraper:msc_public_ui_invalid_input');
  }
  if (/captcha|verify (?:that )?you are human|unusual traffic|access denied|request blocked|security check/i.test(text)) {
    return unresolved('MSC public tracker returned an access challenge; automatic lookup stopped', 'scraper:msc_public_ui_challenge');
  }
  if (/no (?:tracking )?results?|no shipment|container (?:number )?not found|unable to find/i.test(text)) {
    return unresolved('No tracking result found on the MSC public tracker', 'scraper:msc_public_ui_empty');
  }

  const proposal = extractGenericTracking(text, expected);
  if (!proposal.containerFound) {
    return unresolved(`MSC public tracker did not return the requested ${referenceType === 'bill_of_lading' ? 'bill of lading' : 'container'}`, 'scraper:msc_public_ui_mismatch');
  }
  if (!proposal.status && !proposal.eta && !proposal.departedAt) {
    return unresolved('MSC page loaded but contained no parseable tracking event', 'scraper:msc_public_ui_unparsed');
  }

  return {
    resolved: true,
    carrierName: 'MSC',
    matchedContainerNumber: text.match(/\b[A-Z]{4}\d{7}\b/)?.[0],
    status: proposal.status || 'Tracking result found',
    vesselName: proposal.vesselName,
    eta: proposal.eta,
    departedAt: proposal.departedAt,
    latestEvent: proposal.latestEvent,
    checkedAt: new Date(),
    source: 'scraper:msc_public_ui',
  };
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = process.env.MSC_CHROMIUM_EXECUTABLE_PATH || process.env.MAERSK_CHROMIUM_EXECUTABLE_PATH;
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
    return getBrowser();
  }
  return browser;
}

async function waitForTurn<T>(operation: () => Promise<T>): Promise<T> {
  const result = lookupQueue.then(async () => {
    const delay = MIN_LOOKUP_INTERVAL_MS - (Date.now() - lastLookupAt);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    lastLookupAt = Date.now();
    return operation();
  });
  lookupQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function readMscPage(referenceNumber: string, referenceType: 'container' | 'bill_of_lading'): Promise<TrackingResult> {
  let page: Page | undefined;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const timeout = timeoutMs();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    await page.goto(TRACKING_URL, { waitUntil: 'domcontentloaded', timeout });

    const cookieConsent = page.getByRole('button', { name: /essential only|reject optional cookies/i }).first();
    if (await cookieConsent.isVisible().catch(() => false)) await cookieConsent.click({ timeout: 5000 });

    const input = page.getByPlaceholder(/container|tracking|bill of lading|bl number/i).first();
    if (!await input.isVisible().catch(() => false)) {
      const currentText = await page.locator('body').innerText();
      if (/captcha|verify (?:that )?you are human|access denied|request blocked|security check/i.test(currentText)) {
        return parseMscPublicPage(currentText, referenceNumber, referenceType);
      }
      return unresolved('MSC public tracker input was not found', 'scraper:msc_public_ui_layout_changed');
    }

    await input.fill(referenceNumber);
    const trackButton = page.getByRole('button', { name: /track|search|submit/i }).first();
    if (await trackButton.isVisible().catch(() => false)) {
      await trackButton.click();
    } else {
      await input.press('Enter');
    }

    const expected = normalize(referenceNumber);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const text = await page.locator('body').innerText();
      if (
        /captcha|verify (?:that )?you are human|unusual traffic|access denied|request blocked|security check|no (?:tracking )?results?|no shipment|container (?:number )?not found|unable to find/i.test(text)
        || normalize(text).includes(expected)
      ) {
        return parseMscPublicPage(text, referenceNumber, referenceType);
      }
      await page.waitForTimeout(500);
    }

    return unresolved('Timed out waiting for the MSC public tracker result', 'scraper:msc_public_ui_timeout');
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : 'Unknown browser error';
    return unresolved(`MSC public tracker lookup failed: ${message}`, 'scraper:msc_public_ui_error');
  } finally {
    if (page) await page.close();
  }
}

export class MscPublicUiTrackingProvider implements TrackingProvider {
  carrierName = 'MSC';

  async fetchTracking(containerNumber: string, ctx?: import('./types').TrackingContext): Promise<TrackingResult> {
    const normalized = normalize(containerNumber);
    const referenceType = ctx?.referenceType || 'container';
    const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(normalized) : CONTAINER_NUMBER_PATTERN.test(normalized);
    if (!valid) {
      return unresolved('Invalid MSC container number', 'scraper:msc_public_ui_invalid_input');
    }
    return waitForTurn(() => readMscPage(normalized, referenceType));
  }
}
