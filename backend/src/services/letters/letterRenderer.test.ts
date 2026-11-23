import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fillTemplateXml, MissingLetterFieldsError, renderLetterFile } from './letterRenderer';

const FIX = path.join(__dirname, '__fixtures__');

async function documentXml(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  return zip.file('word/document.xml')!.async('string');
}

// The same values the original generator script used to make the two sample
// letters. The sample files are the reference: rendering must reproduce their
// document.xml exactly, which is the "generated letter is identical to the
// original" requirement as an automated check.
const MAERSK = {
  sender_address_1: 'B-GIS G-15 GRAFTON POLICE', sender_address_2: 'BORRACU GRALTER', sender_city: 'FREETOWN', sender_country: 'SIERRA LEONE',
  letter_date: '27, OCTOBER 2026', bl_number: '276606283', authorizer_name: 'SIDI KMALILU MANSARAY',
  release_to_name: 'MORGAN SAMUEL JAMES', release_to_email: 'morgansamueljames@gmail.com', signatory_name: 'Augustine John Kamara.',
};
const LOI = {
  letter_date: '27 October 2026', vessel: 'MV EXAMPLE', voyage_no: '123E', port_of_loading: 'ANTWERP', bl_numbers: 'CMDU1234567',
  bl_issuance_date: '11 December 2025', container_numbers: 'CMAU1234567', description_of_goods: 'USED CLOTHING', shipper: 'EXAMPLE SHIPPER LTD',
  consignee: 'EXAMPLE CONSIGNEE', authorizing_party: 'SAMPLE CLIENT', authorized_company: 'SAMPLE CLEARING AGENT LTD',
  company_or_individual: 'SAMPLE CLIENT', official_title: 'Managing Director', signatory_name: 'JOHN DOE', letterhead_note: '',
};

describe('letter rendering reproduces the reference letters', () => {
  it('Maersk release letter', async () => {
    const out = await renderLetterFile('Maersk_Release_Letter_TEMPLATE.docx', MAERSK);
    const zip = await JSZip.loadAsync(out);
    expect(await zip.file('word/document.xml')!.async('string')).toBe(await documentXml(path.join(FIX, 'SAMPLE_Maersk_Release_Letter.docx')));
  });

  it('LOI seaway bill', async () => {
    const out = await renderLetterFile('LOI_Seaway_Bill_TEMPLATE.docx', LOI);
    const zip = await JSZip.loadAsync(out);
    expect(await zip.file('word/document.xml')!.async('string')).toBe(await documentXml(path.join(FIX, 'SAMPLE_LOI_Seaway_Bill.docx')));
  });

  it('leaves no token behind', async () => {
    const zip = await JSZip.loadAsync(await renderLetterFile('LOI_Seaway_Bill_TEMPLATE.docx', LOI));
    expect(await zip.file('word/document.xml')!.async('string')).not.toContain('{{');
  });
});

describe('fillTemplateXml', () => {
  const run = (inner: string, rpr = '') => `<w:r>${rpr}<w:t>${inner}</w:t></w:r>`;

  it('refuses to render with a field missing, naming it', () => {
    expect(() => fillTemplateXml(run('{{a}} {{b}}'), { a: 'x' })).toThrow(MissingLetterFieldsError);
    try {
      fillTemplateXml(run('{{a}} {{b}}'), { a: 'x' });
    } catch (e) {
      expect((e as MissingLetterFieldsError).missing).toEqual(['b']);
    }
  });

  it('escapes XML so a value can never break the document', () => {
    expect(fillTemplateXml(run('{{a}}'), { a: 'A & B <C> "D" \'E\'' })).toContain('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
  });

  it('strips characters Word cannot open', () => {
    expect(fillTemplateXml(run('{{a}}'), { a: 'ok\u0000\u0008\u001Fdone' })).toContain('okdone');
  });

  it('turns line breaks into Word line breaks', () => {
    expect(fillTemplateXml(run('{{a}}'), { a: 'one\ntwo' })).toBe('<w:r><w:t>one</w:t><w:br/><w:t xml:space="preserve">two</w:t></w:r>');
  });

  it('removes red/highlight/italic placeholder styling only from runs that held a token', () => {
    const styled = '<w:rPr><w:i/><w:color w:val="FF0000"/><w:highlight w:val="yellow"/></w:rPr>';
    const out = fillTemplateXml(run('{{a}}', styled) + run('label', '<w:rPr><w:i/></w:rPr>'), { a: 'v' });
    expect(out).toContain('<w:r><w:rPr></w:rPr><w:t>v</w:t></w:r>');
    expect(out).toContain('<w:r><w:rPr><w:i/></w:rPr><w:t>label</w:t></w:r>');
  });
});
