import { describe, it, expect } from 'vitest';
import { LETTER_TEMPLATES, formatLetterDate, letterWarnings, missingRequired, prefillLetter, sanitizeFields, getTemplate } from './letterTemplates';
import { readTemplateFields } from './letterRenderer';

const TODAY = new Date('2026-10-27T09:00:00Z');
const ctx = {
  container: { containerNumber: 'TLLU4020573', shippingLine: 'Maersk' },
  bl: { blNumber: '272105777', vesselName: 'Maersk Venture', portOfLoading: 'Qingdao', shippingLine: 'Maersk' },
  blContainerNumbers: ['TLLU4020573', 'MSKU1234565'],
  importer: { name: 'Sidi Mansaray', contactPerson: 'Ibrahim Kamara', address: 'B-GIS G-15 Grafton Police', addressLine2: 'Borracu Gralter', city: 'Freetown', country: 'Sierra Leone' },
  agencyName: 'Summit Clearing',
  today: TODAY,
};

describe('template definitions match the Word files', () => {
  it.each(LETTER_TEMPLATES.map((t) => [t.key]))('%s lists exactly the fields in its .docx', async (key) => {
    const def = getTemplate(key)!;
    expect(def.fields.map((f) => f.key).sort()).toEqual((await readTemplateFields(def.file)).sort());
  });
});

describe('formatLetterDate', () => {
  it('writes each letter the way its original did', () => {
    expect(formatLetterDate(TODAY, 'maersk')).toBe('27, OCTOBER 2026');
    expect(formatLetterDate(TODAY, 'long')).toBe('27 October 2026');
  });
});

describe('prefillLetter', () => {
  it('fills the Maersk letter from client and shipment records, in capitals like the original', () => {
    const f = prefillLetter('maersk_release_letter', ctx);
    expect(f).toMatchObject({ sender_address_1: 'B-GIS G-15 GRAFTON POLICE', sender_city: 'FREETOWN', sender_country: 'SIERRA LEONE', bl_number: '272105777', authorizer_name: 'SIDI MANSARAY', letter_date: '27, OCTOBER 2026' });
    expect(f.release_to_name).toBe('');
  });

  it('fills the LOI, listing every container on the bill of lading and naming the agency as the clearing company', () => {
    const f = prefillLetter('loi_seaway_bill', ctx);
    expect(f).toMatchObject({ container_numbers: 'TLLU4020573, MSKU1234565', authorized_company: 'SUMMIT CLEARING', consignee: 'SIDI MANSARAY', vessel: 'MAERSK VENTURE', port_of_loading: 'QINGDAO' });
    expect(f.shipper).toBe('');
  });

  it('leaves unknown things blank instead of inventing them', () => {
    const f = prefillLetter('maersk_release_letter', { container: { containerNumber: 'X' }, blContainerNumbers: [], today: TODAY });
    expect(f.bl_number).toBe('');
    expect(f.authorizer_name).toBe('');
  });
});

describe('checks', () => {
  const maersk = getTemplate('maersk_release_letter')!;

  it('reports which required fields are still empty', () => {
    expect(missingRequired(maersk, prefillLetter('maersk_release_letter', ctx))).toEqual(['release_to_name', 'release_to_email']);
  });

  it('only keeps the template\'s own fields, trimmed, without control characters', () => {
    expect(sanitizeFields(maersk, { bl_number: '  123\u0000 ', rogue: 'x', letter_date: 5 })).toEqual({ bl_number: '123' });
  });

  it('warns about a carrier mismatch, a different signer, and a long LOI date', () => {
    expect(letterWarnings(maersk, {}, { container: { containerNumber: 'X', shippingLine: 'MSC' } })[0]).toContain('addressed to Maersk');
    expect(letterWarnings(maersk, { authorizer_name: 'A', signatory_name: 'B' })[0]).toContain('signed under another');
    expect(letterWarnings(getTemplate('loi_seaway_bill')!, { bl_issuance_date: '11 December 2025' })[0]).toContain('wrap');
    expect(letterWarnings(maersk, { authorizer_name: 'Same', signatory_name: ' same ' })).toEqual([]);
  });
});
