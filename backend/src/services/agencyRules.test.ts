import { describe, it, expect } from 'vitest';
import { checkRulesChange, DEFAULT_RULES, resolveRules } from './agencyRules';
import { computeAttention } from './attentionEngine';
import { computeDeadlines } from './deadlineEngine';

describe('resolveRules', () => {
  it('uses the built-in defaults when nothing is set', () => {
    expect(resolveRules(undefined)).toEqual(DEFAULT_RULES);
    expect(resolveRules({})).toEqual(DEFAULT_RULES);
  });
  it('lays the agency\'s own settings over the defaults, including an empty required list', () => {
    expect(resolveRules({ attentionWindowDays: 5, requiredDocumentTypes: [] })).toEqual({ ...DEFAULT_RULES, attentionWindowDays: 5, requiredDocumentTypes: [] });
  });
});

describe('checkRulesChange', () => {
  it('accepts valid changes', () => {
    expect(checkRulesChange({ requiredDocumentTypes: ['CTN', 'BL'], attentionWindowDays: 7, defaultFreeStorageDays: 0, defaultGraceDays: 14 })).toBeNull();
  });
  it('refuses unknown or repeated document types and out-of-range numbers', () => {
    expect(checkRulesChange({ requiredDocumentTypes: ['Passport'] })).toContain('Unknown document type');
    expect(checkRulesChange({ requiredDocumentTypes: ['CTN', 'CTN'] })).toContain('twice');
    expect(checkRulesChange({ attentionWindowDays: 0 })).toContain('attentionWindowDays');
    expect(checkRulesChange({ attentionWindowDays: 3.5 })).toContain('whole number');
    expect(checkRulesChange({ defaultGraceDays: 91 })).toContain('defaultGraceDays');
  });
});

describe('the engines honour the agency\'s rules', () => {
  const now = new Date('2026-10-30T00:00:00Z');
  const day = 86400000;
  const container = (dueInDays: number) => ({
    status: 'Arrived' as const,
    requiredDocumentTypes: [],
    deadlines: [{ ruleName: 'Free Storage Expiry', startEvent: 'arrival', startDate: now, dueDate: new Date(now.getTime() + dueInDays * day), status: 'pending' as const }],
  });

  it('flags a deadline only inside the agency\'s attention window', () => {
    expect(computeAttention(container(5) as never, new Set(), now).attentionLevel).toBe('normal');
    const wider = computeAttention(container(5) as never, new Set(), now, { windowDays: 7 });
    expect(wider.attentionLevel).toBe('attention');
    expect(wider.attentionReasons[0]).toBe('Free Storage Expiry due within 7 days');
  });

  it('keeps the original wording and behaviour at the default 3 days', () => {
    expect(computeAttention(container(2) as never, new Set(), now).attentionReasons[0]).toBe('Free Storage Expiry due within 3 days');
  });

  it('uses the agency\'s fallback storage and grace days when no carrier term is entered', () => {
    const d = computeDeadlines({ arrival: now }, now, { freeStorageDays: 10, demurrageGraceDays: 20 });
    expect(d[0].dueDate.getTime() - now.getTime()).toBe(10 * day);
    expect(d[1].dueDate.getTime() - now.getTime()).toBe(20 * day);
  });
});
