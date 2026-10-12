import { describe, it, expect } from 'vitest';
import { computeAttention } from './attentionEngine';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeAttention', () => {
  it('is normal with no reasons when there is nothing wrong', () => {
    const result = computeAttention(
      { status: 'In Transit', deadlines: [], requiredDocumentTypes: [] },
      new Set()
    );
    expect(result.attentionLevel).toBe('normal');
    expect(result.attentionReasons).toEqual([]);
    expect(result.attentionRank).toBe(2);
  });

  it('is urgent when a deadline has already expired', () => {
    const result = computeAttention(
      {
        status: 'Under Clearance',
        deadlines: [{ ruleName: 'Demurrage Grace Period', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() - DAY_MS), status: 'expired' }],
        requiredDocumentTypes: [],
      },
      new Set()
    );
    expect(result.attentionLevel).toBe('urgent');
    expect(result.attentionRank).toBe(0);
    expect(result.attentionReasons[0]).toContain('Demurrage Grace Period has expired');
  });

  it('is only "attention", not "urgent", for a deadline due soon but not yet expired', () => {
    const result = computeAttention(
      {
        status: 'Under Clearance',
        deadlines: [{ ruleName: 'Free Storage Expiry', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() + DAY_MS), status: 'pending' }],
        requiredDocumentTypes: [],
      },
      new Set()
    );
    expect(result.attentionLevel).toBe('attention');
    expect(result.attentionRank).toBe(1);
  });

  it('does not flag a deadline that is pending and not due soon (more than 3 days out)', () => {
    const result = computeAttention(
      {
        status: 'Under Clearance',
        deadlines: [{ ruleName: 'Free Storage Expiry', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() + 10 * DAY_MS), status: 'pending' }],
        requiredDocumentTypes: [],
      },
      new Set()
    );
    expect(result.attentionLevel).toBe('normal');
  });

  it('an expired deadline outranks a "due soon" one, and deliberately hides the lesser reason', () => {
    // Corrected after actually running this test: my first version of this
    // test asserted both reasons would be listed, and failed — because the
    // source deliberately gates the "due soon" push on `level !== 'urgent'`
    // (see attentionEngine.ts line 24). Once something is urgent, a
    // separate lower-priority "due soon" notice is suppressed on purpose,
    // not shown alongside it. That's real, intentional design — staff see
    // the one thing that matters most, not a cluttered list — so this test
    // was wrong, not the source; fixed to match actual behavior rather than
    // my assumption about what it should do.
    const result = computeAttention(
      {
        status: 'Under Clearance',
        deadlines: [
          { ruleName: 'Free Storage Expiry', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() + DAY_MS), status: 'pending' },
          { ruleName: 'Demurrage Grace Period', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() - DAY_MS), status: 'expired' },
        ],
        requiredDocumentTypes: [],
      },
      new Set()
    );
    expect(result.attentionLevel).toBe('urgent');
    expect(result.attentionReasons.length).toBe(1);
    expect(result.attentionReasons[0]).toContain('Demurrage Grace Period has expired');
  });

  it('flags missing required documents by name', () => {
    const result = computeAttention(
      { status: 'In Transit', deadlines: [], requiredDocumentTypes: ['CTN', 'BL', 'Invoice'] },
      new Set(['CTN']) // only CTN present
    );
    expect(result.attentionLevel).toBe('attention');
    expect(result.attentionReasons[0]).toContain('BL');
    expect(result.attentionReasons[0]).toContain('Invoice');
    expect(result.attentionReasons[0]).not.toContain('CTN'); // CTN is present, shouldn't be listed as missing
  });

  it('nudges (attention, not urgent) when all documents are in but status was never advanced', () => {
    const result = computeAttention(
      { status: 'Pending Documents', deadlines: [], requiredDocumentTypes: ['CTN', 'BL'] },
      new Set(['CTN', 'BL'])
    );
    expect(result.attentionLevel).toBe('attention');
    expect(result.attentionReasons[0]).toContain('ready to move to Under Clearance');
  });

  it('does not show the "ready to advance" nudge if there is already a real problem', () => {
    // Regression guard for the `reasons.length === 0` condition in the
    // source — if a deadline or missing-doc reason already fired, the nudge
    // should not also appear and crowd out the real issue.
    const result = computeAttention(
      {
        status: 'Pending Documents',
        deadlines: [{ ruleName: 'Demurrage Grace Period', startEvent: 'discharged', startDate: new Date(), dueDate: new Date(Date.now() - DAY_MS), status: 'expired' }],
        requiredDocumentTypes: [],
      },
      new Set()
    );
    expect(result.attentionReasons.some((r) => r.includes('ready to move'))).toBe(false);
  });
});
