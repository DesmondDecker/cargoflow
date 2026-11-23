// Turns text a person copied from a carrier's public tracking page into
// structured tracking data. This is the no-API path: nothing here calls a
// carrier, so it needs no credentials, and every value it returns was read
// from text the user pasted. Callers must label the result as pasted data
// (source 'pasted:maersk_page'), never as live data.
//
// Currently understands the layout of Maersk's public tracking page
// ("BL number / container number / Departs / Arrives / Latest event").
// If the text isn't in that layout, parsing fails loudly with a
// PageParseError rather than guessing.

export class PageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageParseError';
    Object.setPrototypeOf(this, PageParseError.prototype);
  }
}

export interface ParsedPlace {
  name: string;
  country?: string;
}

export interface ParsedContainerTracking {
  containerNumber: string;
  containerType?: string;
  origin?: ParsedPlace;
  destination?: ParsedPlace;
  departure?: { facility?: string; date: Date };
  arrival?: { facility?: string; date: Date };
  eventsCompleted?: number;
  latestEvent?: { location?: string; facility?: string; description: string; at?: Date };
}

export interface ParsedCarrierPage {
  carrier: 'Maersk';
  blNumber?: string;
  lastUpdatedText?: string;
  containers: ParsedContainerTracking[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const DATE_SRC = '(\\d{1,2})\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})';

// Page times are "local time, unless otherwise stated", with no zone given, so
// they are stored as the same wall-clock numbers in UTC. Display them as UTC.
function toDate(day: string, mon: string, year: string, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(Number(year), MONTHS[mon.toLowerCase().slice(0, 3)], Number(day), hh, mm));
}

function normalize(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown links -> link text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

// "QINGDAO, CN" (possibly split across two lines) -> { name, country }
function findPlaces(text: string): ParsedPlace[] {
  const places: ParsedPlace[] = [];
  const re = /([A-Za-z][A-Za-z .'\/()-]*?),\s*([A-Z]{2})(?![A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    places.push({ name: m[1].trim(), country: m[2] });
  }
  return places;
}

function parseDateLine(line: string, prefix: RegExp): { facility?: string; date: Date } | undefined {
  const m = line.match(new RegExp(`^${prefix.source}\\s+(.*?)\\s*${DATE_SRC}\\s*$`, 'i'));
  if (!m) return undefined;
  return { facility: m[1] || undefined, date: toDate(m[2], m[3], m[4]) };
}

// A leg is "Departs <facility> <date>". Copied text keeps it on one line, but
// text read straight off the page can split it into "Departs", the facility
// and the date on separate lines, so read up to three lines, never crossing
// into the next leg.
function readLeg(lines: string[], idx: number, prefix: RegExp): { facility?: string; date: Date } | undefined {
  for (let n = 1; n <= 3 && idx + n <= lines.length; n++) {
    const slice = lines.slice(idx, idx + n);
    if (n > 1 && /^(Departs|Arrives|Arrived|ETA)\b/i.test(slice[n - 1])) return undefined;
    const r = parseDateLine(slice.join(' '), prefix);
    if (r) return r;
  }
  return undefined;
}

function parseContainerSegment(containerNumber: string, lines: string[], header: ParsedPlace[]): ParsedContainerTracking {
  const result: ParsedContainerTracking = { containerNumber };

  const typeLine = lines.find((l) => /^\d{2}'\s*[A-Za-z]/.test(l));
  if (typeLine) result.containerType = typeLine;

  const departIdx = lines.findIndex((l) => /^Departs\b/i.test(l));
  const arriveIdx = lines.findIndex((l) => /^(Arrives|Arrived|ETA)\b/i.test(l));

  if (departIdx >= 0) result.departure = readLeg(lines, departIdx, /Departs/);
  if (arriveIdx >= 0) result.arrival = readLeg(lines, arriveIdx, /(?:Arrives|Arrived|ETA)/);

  const beforeDepart = (departIdx >= 0 ? lines.slice(0, departIdx) : []).filter((l) => l !== typeLine).join(' ');
  const betweenLegs = (departIdx >= 0 && arriveIdx > departIdx ? lines.slice(departIdx + 1, arriveIdx) : []).join(' ');
  result.origin = findPlaces(beforeDepart)[0] || header[0];
  result.destination = findPlaces(betweenLegs)[0] || header[1];

  const viewIdx = lines.findIndex((l) => /^View\s+\d+\s+events?\s+completed/i.test(l));
  if (viewIdx >= 0) {
    result.eventsCompleted = Number(lines[viewIdx].match(/\d+/)![0]);
    const latestIdx = lines.findIndex((l, i) => i > viewIdx && /^Latest event$/i.test(l));
    if (latestIdx > viewIdx + 1) {
      const eventLines = lines.slice(viewIdx + 1, latestIdx);
      const description = eventLines[eventLines.length - 1];
      const location = eventLines.length >= 2 ? eventLines[0] : undefined;
      const facility = eventLines.length >= 3 ? eventLines.slice(1, -1).join(' ') : undefined;
      const when = (lines[latestIdx + 1] || '').match(new RegExp(`${DATE_SRC}(?:\\s+(\\d{1,2}):(\\d{2}))?`, 'i'));
      result.latestEvent = {
        description,
        location,
        facility,
        at: when ? toDate(when[1], when[2], when[3], Number(when[4] || 0), Number(when[5] || 0)) : undefined,
      };
    }
  }

  return result;
}

export function parseCarrierTrackingPage(raw: string): ParsedCarrierPage {
  const lines = normalize(raw);
  if (lines.length === 0) throw new PageParseError('Nothing to read: the pasted text is empty.');

  const containerIdx: { index: number; number: string }[] = [];
  lines.forEach((l, i) => {
    const m = l.match(/^([A-Z]{4}\d{7})(?!\d)/);
    if (m) containerIdx.push({ index: i, number: m[1] });
  });
  if (containerIdx.length === 0) {
    throw new PageParseError(
      'No container number (4 letters + 7 digits on its own line) was found. Copy the whole tracking result from the Maersk tracking page, starting from "BL number" or the container number.'
    );
  }

  const whole = lines.join('\n');
  const bl = whole.match(/BL number\s*([A-Z0-9]{9})/i);
  const blNumber = bl ? bl[1].toUpperCase() : undefined;

  // Header = text between the BL number and the first container, which holds
  // the shipment's origin and destination ("QINGDAO, CN" / "FREETOWN, SL").
  let headerPlaces: ParsedPlace[] = [];
  if (bl && bl.index !== undefined) {
    const firstContainerLine = lines[containerIdx[0].index];
    const headerEnd = whole.indexOf(firstContainerLine, bl.index);
    const headerText = whole.slice(bl.index + bl[0].length, headerEnd > 0 ? headerEnd : undefined).replace(/\s+/g, ' ');
    headerPlaces = findPlaces(headerText);
  }

  const containers = containerIdx.map((c, i) => {
    const end = i + 1 < containerIdx.length ? containerIdx[i + 1].index : lines.length;
    return parseContainerSegment(c.number, lines.slice(c.index + 1, end), headerPlaces);
  });

  const usable = containers.filter((c) => c.latestEvent || c.arrival || c.departure);
  if (usable.length === 0) {
    throw new PageParseError(
      'Found a container number but no dates or events. This reader understands the Maersk tracking page layout (Departs / Arrives / Latest event). Copy the full result, not just the number.'
    );
  }

  const lastUpdated = whole.match(/Last updated:\s*([^\n]+)/i);
  return {
    carrier: 'Maersk',
    blNumber,
    lastUpdatedText: lastUpdated ? lastUpdated[1].trim() : undefined,
    containers: usable,
  };
}
