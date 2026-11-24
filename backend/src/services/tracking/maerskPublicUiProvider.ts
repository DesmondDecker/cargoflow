import { Browser, chromium, Page } from 'playwright';
import { existsSync } from 'node:fs';
import { parseCarrierTrackingPage } from './pastedPageParser';
import { extractGenericTracking } from './genericPageExtractor';
import { TrackingProvider, TrackingResult } from './types';

const TRACKING_URL = 'https://www.maersk.com/tracking/';
const MIN_LOOKUP_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 20000;
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

function normalizedContainerNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function challengeDetected(text: string): boolean {
  return /captcha|verify (?:that )?you are human|unusual traffic|access denied|request blocked|security check/i.test(text);
}

function noResultDetected(text: string): boolean {
  return /no shipment found|no tracking result|no results? found|container (?:number )?not found|unable to find (?:the )?(?:shipment|container)|we (?:could not|couldn't) find (?:the )?(?:shipment|container)/i.test(text);
}

function unresolved(status: string, source: string): TrackingResult {
  return { resolved: false, carrierName: 'Maersk', status, source };
}

export function parseMaerskPublicPage(
  text: string,
  referenceNumber: string,
  referenceType: 'container' | 'bill_of_lading' = 'container',
): TrackingResult {
  const expected = normalizedContainerNumber(referenceNumber);
  const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(expected) : /^[A-Z]{4}\d{7}$/.test(expected);
  if (!valid) {
    return unresolved('Invalid container number for Maersk tracking', 'scraper:maersk_public_ui_invalid_input');
  }
  if (challengeDetected(text)) {
    return unresolved('Maersk public tracker returned an access challenge; automatic lookup stopped', 'scraper:maersk_public_ui_challenge');
  }
  if (noResultDetected(text)) {
    return unresolved('No tracking result found on the Maersk public tracker', 'scraper:maersk_public_ui_empty');
  }

  try {
    const parsed = parseCarrierTrackingPage(text);
    if (referenceType === 'bill_of_lading' && normalizedContainerNumber(parsed.blNumber || '') !== expected) {
      return unresolved('Maersk public tracker did not return the requested bill of lading', 'scraper:maersk_public_ui_mismatch');
    }
    const container = referenceType === 'bill_of_lading'
      ? parsed.containers[0]
      : parsed.containers.find((item) => normalizedContainerNumber(item.containerNumber) === expected);
    if (!container) {
      return unresolved('Maersk public tracker did not return the requested container', 'scraper:maersk_public_ui_mismatch');
    }

    const latestEvent = container.latestEvent;
    const status = latestEvent?.description
      || (container.arrival ? `Arrival details available${container.arrival.facility ? ` at ${container.arrival.facility}` : ''}` : undefined)
      || (container.departure ? `Departure details available${container.departure.facility ? ` from ${container.departure.facility}` : ''}` : undefined);
    if (!status) {
      return unresolved('Maersk page loaded but contained no current event or shipment dates', 'scraper:maersk_public_ui_unparsed');
    }

    return {
      resolved: true,
      carrierName: 'Maersk',
      matchedContainerNumber: container.containerNumber,
      status,
      vesselName: extractGenericTracking(text, expected).vesselName,
      eta: container.arrival?.date,
      originPlace: container.origin ? `${container.origin.name}${container.origin.country ? `, ${container.origin.country}` : ''}` : undefined,
      destinationPlace: container.destination ? `${container.destination.name}${container.destination.country ? `, ${container.destination.country}` : ''}` : undefined,
      departedAt: container.departure?.date,
      latestEvent,
      eventsCompleted: container.eventsCompleted,
      carrierUpdatedNote: parsed.lastUpdatedText,
      checkedAt: new Date(),
      source: 'scraper:maersk_public_ui',
    };
  } catch {
    return unresolved('Maersk public tracker response could not be parsed', 'scraper:maersk_public_ui_unparsed');
  }
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = process.env.MAERSK_CHROMIUM_EXECUTABLE_PATH;
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

async function readMaerskPage(referenceNumber: string, referenceType: 'container' | 'bill_of_lading'): Promise<TrackingResult> {
  let page: Page | undefined;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const timeout = timeoutMs();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    await page.goto(TRACKING_URL, { waitUntil: 'domcontentloaded', timeout });

    const essentialOnly = page.getByRole('button', { name: 'Essential only', exact: true });
    if (await essentialOnly.isVisible()) await essentialOnly.click({ timeout: 5000 });

    const input = page.getByPlaceholder('BL or container number', { exact: true });
    await input.fill(referenceNumber);
    await page.getByRole('button', { name: 'Track', exact: true }).click();

    const expected = normalizedContainerNumber(referenceNumber);
    const deadline = Date.now() + timeout;
    let text = '';
    while (Date.now() < deadline) {
      text = await page.locator('body').innerText();
      if (
        challengeDetected(text)
        || noResultDetected(text)
        || normalizedContainerNumber(text).includes(expected)
      ) {
        return parseMaerskPublicPage(text, referenceNumber, referenceType);
      }
      await page.waitForTimeout(500);
    }

    return unresolved('Timed out waiting for the Maersk public tracker result', 'scraper:maersk_public_ui_timeout');
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : 'Unknown browser error';
    return unresolved(`Maersk public tracker lookup failed: ${message}`, 'scraper:maersk_public_ui_error');
  } finally {
    if (page) await page.close();
  }
}

export class MaerskPublicUiTrackingProvider implements TrackingProvider {
  carrierName = 'Maersk';

  async fetchTracking(containerNumber: string, ctx?: import('./types').TrackingContext): Promise<TrackingResult> {
    const normalized = normalizedContainerNumber(containerNumber);
    const referenceType = ctx?.referenceType || 'container';
    const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(normalized) : /^[A-Z]{4}\d{7}$/.test(normalized);
    if (!valid) {
      return unresolved('Invalid container number for Maersk tracking', 'scraper:maersk_public_ui_invalid_input');
    }
    return waitForTurn(() => readMaerskPage(normalized, referenceType));
  }
}
