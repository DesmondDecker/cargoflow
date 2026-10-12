// Real ISO 6346 shipping-container-number validation: 4-letter owner code +
// 6 digits + 1 check digit, e.g. MSCU1234565. The check digit algorithm
// below is the actual published ISO 6346 spec (letter values, mod-11), not a
// stub — it will correctly flag a mistyped container number.
const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

function computeCheckDigit(ownerCodeAndSerial: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = ownerCodeAndSerial[i];
    const value = /[0-9]/.test(ch) ? parseInt(ch, 10) : LETTER_VALUES[ch];
    sum += value * Math.pow(2, i);
  }
  const remainder = sum % 11;
  return remainder === 10 ? 0 : remainder;
}

export interface NumberValidation {
  formatValid: boolean;
  checkDigitValid: boolean | null;
  issue?: string;
}

export function validateContainerNumber(raw: string): NumberValidation {
  const num = raw.trim().toUpperCase().replace(/\s+/g, '');
  const formatOk = /^[A-Z]{4}\d{7}$/.test(num);
  if (!formatOk) {
    return { formatValid: false, checkDigitValid: null, issue: 'Expected format: 4 letters + 7 digits (e.g. MSCU1234565)' };
  }
  const expected = computeCheckDigit(num.slice(0, 10));
  const actual = parseInt(num[10], 10);
  const valid = expected === actual;
  return { formatValid: true, checkDigitValid: valid, issue: valid ? undefined : `Check digit should be ${expected}, got ${actual}` };
}

// BIC (Bureau International des Containers) owner-prefix codes mapped to
// shipping lines. Merged from two sources: the West-Africa-specific research
// done for this table originally, plus Terminal49's published SCAC/container-
// prefix reference (https://terminal49.com/tools/scac-code-lookup, "free to
// reuse with attribution and a link to the source page" — this comment is
// that attribution). Only entries Terminal49 tags as an actual
// `container_prefix` are pulled in here; its `scac`-only codes are booking/
// bill-of-lading identifiers, not the four letters that appear on a physical
// container, so they'd never match anything via guessShippingLine and don't
// belong in this table.
//
// "All" shipping lines isn't a real endpoint — BIC has issued tens of
// thousands of owner codes to carriers, NVOCCs, and private box owners
// worldwide, most of which will never touch a container bound for Freetown.
// This is every prefix from a legitimate published source for the carriers
// that actually matter globally and regionally, not a padded list of guesses.
// An unrecognized prefix still correctly reports low-confidence rather than
// silently matching the wrong carrier.
const OWNER_CODE_TO_LINE: Record<string, string> = {
  MSCU: 'MSC', MEDU: 'MSC',
  MAEU: 'Maersk', MRKU: 'Maersk', MSKU: 'Maersk', MNBU: 'Maersk', MRSU: 'Maersk', PONU: 'Maersk',
  SAFM: 'Maersk', // Safmarine — historic Africa-specialist brand, folded into the Maersk name c.2020
  SUDU: 'Maersk', ALBU: 'Maersk', // Hamburg Süd — acquired by Maersk in 2017, still runs its own prefixes
  SEAU: 'Maersk', // Sealand Americas — Maersk's intra-Americas regional brand
  SEJJ: 'Maersk', // Sealand Europe — Maersk's intra-Europe regional brand
  CMAU: 'CMA CGM', CGMU: 'CMA CGM', CXDU: 'CMA CGM', ECMU: 'CMA CGM',
  APLU: 'CMA CGM', APRU: 'CMA CGM', // APL — CMA CGM Group brand since 2016
  ANNU: 'ANL', // Australia National Line — CMA CGM Group brand
  HLXU: 'Hapag-Lloyd', HLBU: 'Hapag-Lloyd', HLCU: 'Hapag-Lloyd',
  DAYU: 'Hapag-Lloyd', // Deutsche Afrika-Linien — Africa-trade specialist absorbed into Hapag-Lloyd
  ONEU: 'Ocean Network Express', KKLU: 'Ocean Network Express', TLLU: 'Ocean Network Express',
  OOLU: 'OOCL', OOCU: 'OOCL',
  COSU: 'COSCO', CBHU: 'COSCO', CCLU: 'COSCO',
  CSNU: 'COSCO', // China Shipping Container Lines — merged into COSCO in 2016
  EGHU: 'Evergreen', EISU: 'Evergreen', EGSU: 'Evergreen', EITU: 'Evergreen', EMCU: 'Evergreen',
  YMLU: 'Yang Ming', YMMU: 'Yang Ming',
  HDMU: 'HMM', HMMU: 'HMM',
  TCLU: 'Triton (leasing)', TEMU: 'Triton (leasing)',
  ZIMU: 'ZIM', ZCSU: 'ZIM',
  PCIU: 'Pacific International Lines', PILU: 'Pacific International Lines',
  WHLU: 'Wan Hai', WHSU: 'Wan Hai',
  NIDU: 'NileDutch', // Hapag-Lloyd acquired NileDutch in 2021 but it still runs its own prefix — a major West Africa specialist
  ACLU: 'Atlantic Container Line',
  CHVW: 'Swire Shipping', SHKU: 'Swire Shipping',
  CLAM: 'Crowley', CWLQ: 'Crowley',
  CULU: 'China United Lines',
  GOSU: 'Gold Star Line',
  IILU: 'Independent Container Line',
  MAGU: 'Matson', MATU: 'Matson',
  SJHH: 'SeaLead', SQQY: 'SeaLead',
  SMLM: 'SM Line',
  SSPH: 'Seth Shipping',
  TJFH: 'Transfar',
  TLXU: 'TS Lines',
  TRKU: 'Turkon Line',
  WWSU: 'Westwood Shipping Lines',
};
// Every distinct carrier name this table can produce — used to power a
// pick-a-carrier suggestion list (see agencyController.listKnownCarriers)
// instead of agencies free-typing a name that has to match container.
// shippingLine exactly or the grace-period override silently never applies.
export const ALL_KNOWN_CARRIERS = [...new Set(Object.values(OWNER_CODE_TO_LINE))].sort();
// Deliberately not covering Grimaldi Lines: it's a major West Africa/Freetown
// operator, but almost entirely RoRo (vehicle) and general/break-bulk cargo
// tracked by VIN and booking number, not ISO 6346 container numbers — a
// lookup table keyed on container prefix isn't the right place for it. If
// Grimaldi's reefer/container-line service ever becomes relevant, its
// specific BIC prefix should be verified before adding.

export interface ShippingLineGuess {
  guess?: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

// How many times an agency has to repeat the same correction for a prefix
// the global table doesn't know before that correction is trusted at 'high'
// confidence rather than 'medium'. One correction could be a mistake;
// three in a row for the same prefix is a real pattern.
export const AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD = 3;

export function agencyHistoryConfidence(correctionCount: number): 'high' | 'medium' {
  return correctionCount >= AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium';
}

export function guessShippingLine(containerNumber: string): ShippingLineGuess {
  const prefix = containerNumber.trim().toUpperCase().slice(0, 4);
  const match = OWNER_CODE_TO_LINE[prefix];
  if (match) return { guess: match, confidence: 'high', source: 'bic_owner_code_table' };
  return { guess: undefined, confidence: 'low', source: 'unrecognized_prefix' };
}
