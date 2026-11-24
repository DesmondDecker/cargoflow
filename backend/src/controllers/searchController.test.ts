import { describe, expect, it } from 'vitest';
import { buildExternalTrackingLookup, normalizeTrackingCodes } from './searchController';

describe('normalizeTrackingCodes', () => {
  it('accepts a pasted list of container and BL numbers and strips blanks and duplicates', () => {
    expect(normalizeTrackingCodes(' MSCU1234567, medu1234567 \n HLCU9988776 , medu1234567 , ')).toEqual([
      'MSCU1234567',
      'MEDU1234567',
      'HLCU9988776',
    ]);
  });

  it('handles a mixed BL and container reference list in one paste', () => {
    expect(normalizeTrackingCodes('BL-1234567\nMSCU1234567, BL-1234567,  medu1234567')).toEqual([
      'BL1234567',
      'MSCU1234567',
      'MEDU1234567',
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(normalizeTrackingCodes('   \n,  , ')).toEqual([]);
  });
});

describe('buildExternalTrackingLookup', () => {
  it('identifies supported container numbers and returns their carrier tracker', () => {
    expect(buildExternalTrackingLookup('maeu 0000 800')).toMatchObject({
      code: 'MAEU0000800',
      carrierName: 'Maersk',
      detection: { type: 'container', confidence: 'high', carrierConfidence: 'high' },
      publicTrackingUrl: 'https://www.maersk.com/tracking/',
    });
  });

  it('identifies a CMA CGM bill of lading and returns its carrier tracker', () => {
    expect(buildExternalTrackingLookup('CMDU-12345678')).toMatchObject({
      code: 'CMDU12345678',
      carrierName: 'CMA CGM',
      detection: { type: 'bill_of_lading', carrierConfidence: 'high' },
      publicTrackingUrl: 'https://www.cma-cgm.com/ebusiness/tracking',
    });
  });
});
