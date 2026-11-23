// The letters the app can generate, and how to fill each one from CargoFlow's
// own records. A template here = a Word file in backend/templates/letters plus
// the list of its {{fields}}. To add a letter (for another carrier, say): put
// the .docx in that folder with {{field}} tokens, then add an entry below; the
// app's letter screens are driven by this list and need no change.

export type LetterTemplateKey = 'maersk_release_letter' | 'loi_seaway_bill';

export interface LetterFieldDef {
  key: string;
  label: string;
  required: boolean;
  multiline?: boolean;
  hint?: string;
}

export interface LetterTemplateDef {
  key: LetterTemplateKey;
  title: string;
  description: string;
  carrier: string; // the shipping line this letter is addressed to
  file: string;
  fields: LetterFieldDef[];
}

export const LETTER_TEMPLATES: LetterTemplateDef[] = [
  {
    key: 'maersk_release_letter',
    title: 'Maersk release letter',
    description: 'Client authorises Maersk Line Sierra Leone to release the delivery order for a bill of lading to a named person.',
    carrier: 'Maersk',
    file: 'Maersk_Release_Letter_TEMPLATE.docx',
    fields: [
      { key: 'sender_address_1', label: 'Client address, line 1', required: true },
      { key: 'sender_address_2', label: 'Client address, line 2', required: true },
      { key: 'sender_city', label: 'Client city', required: true },
      { key: 'sender_country', label: 'Client country', required: true },
      { key: 'letter_date', label: 'Letter date', required: true, hint: 'e.g. 27, OCTOBER 2026' },
      { key: 'bl_number', label: 'Bill of lading number', required: true },
      { key: 'authorizer_name', label: 'Client authorising the release', required: true },
      { key: 'release_to_name', label: 'Delivery order released to (name)', required: true },
      { key: 'release_to_email', label: 'Delivery order email', required: true },
      { key: 'signatory_name', label: 'Name printed under the signature line', required: true },
    ],
  },
  {
    key: 'loi_seaway_bill',
    title: 'Letter of indemnity (seaway bill)',
    description: 'Client indemnifies CMA CGM for releasing the cargo to the named clearing company.',
    carrier: 'CMA CGM',
    file: 'LOI_Seaway_Bill_TEMPLATE.docx',
    fields: [
      { key: 'letterhead_note', label: 'Letterhead note', required: false, hint: 'Leave empty. Original text: (On company letter head)' },
      { key: 'letter_date', label: 'Date', required: true, hint: 'e.g. 27 October 2026' },
      { key: 'vessel', label: 'Vessel', required: true },
      { key: 'voyage_no', label: 'Voyage n°', required: true },
      { key: 'port_of_loading', label: 'Port of loading', required: true },
      { key: 'bl_numbers', label: 'Bills of Lading n°', required: true },
      { key: 'bl_issuance_date', label: 'B/L issuance date', required: true, hint: 'Short date, e.g. 11 Dec 2025, or the line wraps' },
      { key: 'container_numbers', label: 'Container(s) n°', required: true },
      { key: 'description_of_goods', label: 'Description of goods', required: true },
      { key: 'shipper', label: 'Shipper', required: true },
      { key: 'consignee', label: 'Consignee', required: true },
      { key: 'authorizing_party', label: 'Party giving the authorisation ("We ...")', required: true },
      { key: 'authorized_company', label: 'Company authorised to take delivery', required: true },
      { key: 'company_or_individual', label: 'Company name / individual (signature block)', required: true },
      { key: 'official_title', label: 'Official title (Designation)', required: true },
      { key: 'signatory_name', label: 'Name', required: true },
    ],
  },
];

export function getTemplate(key: string): LetterTemplateDef | undefined {
  return LETTER_TEMPLATES.find((t) => t.key === key);
}

// ---------------------------------------------------------------- dates

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Dates in these letters are plain text, written the way each original wrote
// them. UTC is used on purpose so a date never shifts with the server's zone.
export function formatLetterDate(date: Date, style: 'maersk' | 'long'): string {
  const d = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return style === 'maersk' ? `${d}, ${month.toUpperCase()} ${y}` : `${d} ${month} ${y}`;
}

// ------------------------------------------------------------- prefill

export interface LetterContext {
  container: { containerNumber: string; vessel?: string; shippingLine?: string };
  bl?: { blNumber: string; vesselName?: string; portOfLoading?: string; shippingLine?: string };
  // Every container on the same bill of lading, so the LOI lists them all.
  blContainerNumbers: string[];
  importer?: { name: string; contactPerson?: string; address?: string; addressLine2?: string; city?: string; country?: string };
  agencyName?: string;
  today: Date;
}

const up = (s?: string) => (s ?? '').trim().toUpperCase();
const t = (s?: string) => (s ?? '').trim();

// Fills what CargoFlow already knows and leaves the rest empty for the user.
// Nothing is guessed: a field with no source is left blank, and the letter
// cannot be downloaded until it is filled.
export function prefillLetter(key: LetterTemplateKey, ctx: LetterContext): Record<string, string> {
  const importer = ctx.importer;
  const blNumber = ctx.bl?.blNumber ?? '';
  const containerNumbers = ctx.blContainerNumbers.length > 0 ? ctx.blContainerNumbers : [ctx.container.containerNumber];

  if (key === 'maersk_release_letter') {
    return {
      sender_address_1: up(importer?.address),
      sender_address_2: up(importer?.addressLine2),
      sender_city: up(importer?.city),
      sender_country: up(importer?.country),
      letter_date: formatLetterDate(ctx.today, 'maersk'),
      bl_number: blNumber,
      authorizer_name: up(importer?.name),
      release_to_name: '',
      release_to_email: '',
      signatory_name: t(importer?.contactPerson) || t(importer?.name),
    };
  }

  return {
    letterhead_note: '',
    letter_date: formatLetterDate(ctx.today, 'long'),
    vessel: up(ctx.bl?.vesselName || ctx.container.vessel),
    voyage_no: '',
    port_of_loading: up(ctx.bl?.portOfLoading),
    bl_numbers: blNumber,
    bl_issuance_date: '',
    container_numbers: containerNumbers.join(', '),
    description_of_goods: '',
    shipper: '',
    consignee: up(importer?.name),
    authorizing_party: up(importer?.name),
    authorized_company: up(ctx.agencyName),
    company_or_individual: up(importer?.name),
    official_title: '',
    signatory_name: up(importer?.contactPerson),
  };
}

// ------------------------------------------------------ checks and cleaning

export const MAX_FIELD_LENGTH = 500;

// Trims, drops control characters, and keeps only this template's fields.
export function sanitizeFields(def: LetterTemplateDef, input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of def.fields) {
    const raw = input[field.key];
    if (typeof raw !== 'string') continue;
    out[field.key] = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  }
  return out;
}

export function missingRequired(def: LetterTemplateDef, fields: Record<string, string>): string[] {
  return def.fields.filter((f) => f.required && !(fields[f.key] ?? '').trim()).map((f) => f.key);
}

// Things worth a second look but not worth blocking the letter for.
export function letterWarnings(def: LetterTemplateDef, fields: Record<string, string>, ctx?: Pick<LetterContext, 'container' | 'bl'>): string[] {
  const warnings: string[] = [];
  const carrier = (ctx?.bl?.shippingLine || ctx?.container.shippingLine || '').trim();
  if (carrier && carrier.toLowerCase() !== def.carrier.toLowerCase()) {
    warnings.push(`This letter is addressed to ${def.carrier}, but the container's shipping line is ${carrier}.`);
  }
  if (def.key === 'maersk_release_letter' && fields.authorizer_name && fields.signatory_name && fields.authorizer_name.trim().toLowerCase() !== fields.signatory_name.trim().toLowerCase()) {
    warnings.push('The letter is authorised by one name but signed under another. Check that is intended.');
  }
  if (def.key === 'loi_seaway_bill' && (fields.bl_issuance_date ?? '').length > 12) {
    warnings.push('The B/L issuance date is long and will wrap onto a second line. A short date like 11 Dec 2025 fits.');
  }
  return warnings;
}
