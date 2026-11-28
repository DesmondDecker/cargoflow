import { describe, expect, it } from 'vitest';
import { FIELDS } from './portalApi';

describe('portal submission fields', () => {
  it('defines all six required customs fields in stable order', () => {
    expect(FIELDS.map((field) => field.key)).toEqual([
      'cvcNumber',
      'billOfLadingNumber',
      'shippingAgency',
      'containerNumber',
      'documentName',
      'itsNumber',
    ]);
  });

  it('provides a human-readable label for every field', () => {
    expect(FIELDS.every((field) => field.label.trim().length > 0)).toBe(true);
  });
});
