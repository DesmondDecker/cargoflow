import { describe, it, expect } from 'vitest';
import { validateContainerNumber, guessShippingLine, agencyHistoryConfidence, AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD } from './carrierDetection';

describe('validateContainerNumber', () => {
  it('accepts the official ISO 6346 worked example (CSQU3054383)', () => {
    // This exact number is the standard's own published example — hand-
    // computed independently against the mod-11 algorithm before trusting
    // it as a test oracle: CSQU305438 sums to 6185, 6185 % 11 = 3, which
    // matches the check digit actually on the number. Real external
    // ground truth, not a number this codebase invented for itself.
    const result = validateContainerNumber('CSQU3054383');
    expect(result.formatValid).toBe(true);
    expect(result.checkDigitValid).toBe(true);
  });

  it('flags a wrong check digit on an otherwise well-formed number', () => {
    const result = validateContainerNumber('CSQU3054380'); // last digit changed from the real 3
    expect(result.formatValid).toBe(true);
    expect(result.checkDigitValid).toBe(false);
    expect(result.issue).toContain('3'); // the error message should name the correct digit
  });

  it('rejects the wrong shape outright, with checkDigitValid left null (not false)', () => {
    const result = validateContainerNumber('ABC1234567'); // 3 letters, not 4
    expect(result.formatValid).toBe(false);
    expect(result.checkDigitValid).toBeNull(); // null means "never checked", distinct from false ("checked and wrong")
  });

  it('is whitespace- and case-tolerant on otherwise valid input', () => {
    const result = validateContainerNumber('  csqu 305 4383 ');
    expect(result.formatValid).toBe(true);
    expect(result.checkDigitValid).toBe(true);
  });

  it('maps a check-digit remainder of 10 to 0, per the ISO 6346 spec', () => {
    // The algorithm's one special case (remainder 10 -> digit 0) doesn't
    // happen to get hit by the other examples in this file, so it's
    // guaranteed no coverage without a number constructed specifically to
    // land there. MAEU000080 was hand-computed against the actual mod-11
    // algorithm (sum=2408, 2408%11=10) before writing this test — not an
    // external claim, independently verified by running the real algorithm
    // standalone first. See the sandbox session: computeCheckDigit('MAEU000080') -> 0.
    const result = validateContainerNumber('MAEU0000800');
    expect(result.formatValid).toBe(true);
    expect(result.checkDigitValid).toBe(true);
  });
});

describe('guessShippingLine', () => {
  it('resolves a known prefix to its carrier at high confidence', () => {
    const result = guessShippingLine('MAEU1234567');
    expect(result.guess).toBe('Maersk');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('bic_owner_code_table');
  });

  it('resolves Safmarine\'s legacy prefix to the Maersk brand that absorbed it', () => {
    const result = guessShippingLine('SAFM1234567');
    expect(result.guess).toBe('Maersk');
  });

  it('is case- and whitespace-tolerant on the prefix', () => {
    const result = guessShippingLine('  maeu1234567');
    expect(result.guess).toBe('Maersk');
  });

  it('reports low confidence and no guess for an unrecognized prefix, rather than a false match', () => {
    const result = guessShippingLine('ZZZZ1234567');
    expect(result.guess).toBeUndefined();
    expect(result.confidence).toBe('low');
  });

  it('still resolves MSCU correctly (regression guard for the old MSCU2 bug)', () => {
    // Earlier this session the lookup table had a dead 5-character key,
    // "MSCU2", left over from a typo — it could never match anything
    // because guessShippingLine always slices the prefix to exactly 4
    // characters, so that key was permanently unreachable. It's gone now;
    // this just confirms a container number starting with "MSCU2..." still
    // resolves correctly off the real 4-character "MSCU" key.
    const result = guessShippingLine('MSCU2123456');
    expect(result.guess).toBe('MSC');
  });
});

describe('agencyHistoryConfidence', () => {
  it('stays at medium confidence below the repeat threshold', () => {
    expect(agencyHistoryConfidence(1)).toBe('medium');
    expect(agencyHistoryConfidence(AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD - 1)).toBe('medium');
  });

  it('reaches high confidence exactly at the threshold, not one short', () => {
    expect(agencyHistoryConfidence(AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD)).toBe('high');
    expect(agencyHistoryConfidence(AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD + 5)).toBe('high');
  });
});
