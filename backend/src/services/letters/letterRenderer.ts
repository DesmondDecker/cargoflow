import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// Fills a Word letter template. The templates are the agency's real letters
// with every variable piece of text swapped for a {{field}} token, so the
// layout, fonts and fixed wording are exactly the original's. Rendering is
// plain token replacement inside word/document.xml: nothing else in the file
// is touched.

// backend/templates/letters, found the same way whether this runs from src/
// (ts-node, tests) or from the compiled dist/ folder.
const TEMPLATE_DIR = path.resolve(__dirname, '../../../templates/letters');

export class MissingLetterFieldsError extends Error {
  constructor(public missing: string[]) {
    super(`Missing letter fields: ${missing.join(', ')}`);
    this.name = 'MissingLetterFieldsError';
    Object.setPrototypeOf(this, MissingLetterFieldsError.prototype);
  }
}

const TOKEN = /\{\{(\w+)\}\}/g;
// Characters that are not allowed in XML 1.0 and would make Word refuse the file.
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function escapeXml(value: string): string {
  return value.replace(XML_ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Value -> XML for inside a <w:t>. Line breaks become real Word line breaks.
function valueToXml(value: string): string {
  return value
    .split(/\r\n|\r|\n/)
    .map(escapeXml)
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

// Placeholder styling in the templates (red, yellow highlight, italic) marks
// "fill this in". Once filled, the value is ordinary text like the rest of
// the letter, so that styling is removed from runs that held a token.
function stripPlaceholderStyling(run: string): string {
  if (!run.includes('{{')) return run;
  return run.replace(/<w:highlight [^>]*\/>|<w:color w:val="FF0000"\/>|<w:i\/>|<w:iCs\/>/g, '');
}

export function templateFields(documentXml: string): string[] {
  return Array.from(new Set(Array.from(documentXml.matchAll(TOKEN)).map((m) => m[1])));
}

export function fillTemplateXml(documentXml: string, data: Record<string, string>): string {
  const missing = templateFields(documentXml).filter((k) => typeof data[k] !== 'string');
  if (missing.length > 0) throw new MissingLetterFieldsError(missing);

  const styled = documentXml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/g, stripPlaceholderStyling);
  return styled.replace(TOKEN, (_m, key: string) => valueToXml(data[key]));
}

export async function renderTemplateBuffer(templateBuffer: Buffer, data: Record<string, string>): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('Template has no word/document.xml');
  zip.file('word/document.xml', fillTemplateXml(await entry.async('string'), data));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function renderLetterFile(templateFile: string, data: Record<string, string>): Promise<Buffer> {
  const buffer = await fs.promises.readFile(path.join(TEMPLATE_DIR, templateFile));
  return renderTemplateBuffer(buffer, data);
}

export async function readTemplateFields(templateFile: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(path.join(TEMPLATE_DIR, templateFile)));
  return templateFields(await zip.file('word/document.xml')!.async('string'));
}
