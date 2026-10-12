import { describe, expect, it } from 'vitest';
import { normalizeTrackingCodes } from './searchController';

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
