// Best-effort reader for tracking text copied from ANY carrier's public page.
//
// Unlike pastedPageParser.ts (which understands Maersk's exact layout), this
// does not know any carrier's layout. It looks for dates and the usual
// labels (ETA, departure, vessel, status) and for dated event lines, and
// returns a PROPOSAL. A person must review and confirm it before anything is
// saved, so a wrong guess is corrected on screen instead of being stored.
// Nothing here is a substitute for a real per-carrier parser: when you see
// the same carrier's layout often, a dedicated parser beats these heuristics.

export interface GenericProposal {
  containerFound: boolean;
  status?: string;
  latestEvent?: { description: string; at?: Date };
  eta?: Date;
  departedAt?: Date;
  vesselName?: string;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
const TIME = '(?:[ T,]+(\\d{1,2}):(\\d{2}))?';

interface FoundDate {
  date: Date;
  start: number;
  end: number;
}

function utc(y: number, m: number, d: number, hh?: string, mm?: string): Date | null {
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m, d, hh ? Number(hh) : 0, mm ? Number(mm) : 0));
  return date.getUTCMonth() === m ? date : null; // rejects 31 Feb and similar
}

export function findDates(line: string): FoundDate[] {
  const found: FoundDate[] = [];
  const push = (m: RegExpExecArray, date: Date | null) => {
    if (date) found.push({ date, start: m.index, end: m.index + m[0].length });
  };
  let m: RegExpExecArray | null;

  const dmy = new RegExp(`(\\d{1,2})[ \\-\\/.]+${MON}[ \\-\\/.,]+(\\d{4})${TIME}`, 'gi'); // 02 Oct 2026, 02-Oct-2026
  while ((m = dmy.exec(line))) push(m, utc(Number(m[3]), MONTHS[m[2].toLowerCase().slice(0, 3)], Number(m[1]), m[4], m[5]));

  const mdy = new RegExp(`${MON}\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})${TIME}`, 'gi'); // Oct 2, 2026
  while ((m = mdy.exec(line))) push(m, utc(Number(m[3]), MONTHS[m[1].toLowerCase().slice(0, 3)], Number(m[2]), m[4], m[5]));

  const iso = new RegExp(`(\\d{4})-(\\d{2})-(\\d{2})${TIME}`, 'g'); // 2026-10-02
  while ((m = iso.exec(line))) push(m, utc(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4], m[5]));

  const slash = new RegExp(`(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})${TIME}`, 'g'); // 02/10/2026 read as day/month
  while ((m = slash.exec(line))) push(m, utc(Number(m[3]), Number(m[2]) - 1, Number(m[1]), m[4], m[5]));

  // Drop overlaps, keep left-to-right order.
  found.sort((a, b) => a.start - b.start);
  return found.filter((d, i) => i === 0 || d.start >= found[i - 1].end);
}

const ETA_LABEL = /\b(ETA|E\.T\.A|estimated (?:time of )?arrival|expected arrival|arrival|arrives|arrived)\b/i;
const DEPART_LABEL = /\b(ETD|E\.T\.D|departure|departs|departed|sailed|sailing|loaded on board|on board)\b/i;
const VESSEL_LABEL = /\bvessel(?:\s*(?:name|\/\s*voyage))?\s*[:\-]?\s*([A-Z][A-Z0-9 .'-]{2,39})/i;

function normalizeId(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function dateNear(lines: string[], i: number): Date | undefined {
  for (const offset of [0, 1, 2]) {
    const line = lines[i + offset];
    if (line === undefined) break;
    const d = findDates(line)[0];
    if (d) return d.date;
  }
  return undefined;
}

export function extractGenericTracking(raw: string, containerNumber: string, now: Date = new Date()): GenericProposal {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const proposal: GenericProposal = { containerFound: normalizeId(raw).includes(normalizeId(containerNumber)) };

  const labelled = new Set<number>();
  lines.forEach((line, i) => {
    if (!proposal.eta && ETA_LABEL.test(line)) {
      const d = dateNear(lines, i);
      if (d) {
        proposal.eta = d;
        labelled.add(i);
      }
    }
    if (!proposal.departedAt && DEPART_LABEL.test(line) && !ETA_LABEL.test(line)) {
      const d = dateNear(lines, i);
      if (d) {
        proposal.departedAt = d;
        labelled.add(i);
      }
    }
    if (!proposal.vesselName) {
      const v = line.match(VESSEL_LABEL);
      if (v) proposal.vesselName = v[1].trim().replace(/\s{2,}.*$/, '');
    }
  });

  // Latest dated event that has already happened (events are history; ETAs and
  // departures with labels above are forecasts/legs, so they are skipped).
  let best: { at: Date; description: string } | undefined;
  lines.forEach((line, i) => {
    if (labelled.has(i) || ETA_LABEL.test(line)) return;
    const dates = findDates(line);
    if (dates.length === 0) return;
    const at = dates[0].date;
    if (at.getTime() > now.getTime() + 86400000) return;
    let description = (line.slice(0, dates[0].start) + ' ' + line.slice(dates[0].end)).replace(/[|·•\-–:,]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (description.length < 3) description = (lines[i - 1] || lines[i + 1] || '').trim();
    if (description.length < 3 || findDates(description).length > 0) return;
    if (!best || at.getTime() > best.at.getTime()) best = { at, description: description.slice(0, 160) };
  });
  if (best) {
    proposal.latestEvent = { description: best.description, at: best.at };
    proposal.status = best.description.slice(0, 80);
  }

  return proposal;
}
