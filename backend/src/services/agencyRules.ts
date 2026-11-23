import { DOCUMENT_TYPE_KEYS } from '../constants/containerPipeline';

// What an agency's working rules resolve to once its own settings are laid
// over the built-in defaults. Every consumer (container creation, the
// attention engine, the deadline engine, the digest) reads rules through
// this one function, so a missing setting always means the same default.

export interface ResolvedRules {
  requiredDocumentTypes: string[];
  attentionWindowDays: number;
  defaultFreeStorageDays: number;
  defaultGraceDays: number;
}

export const DEFAULT_RULES: ResolvedRules = {
  requiredDocumentTypes: ['CTN', 'BL', 'Invoice', 'PackingList'],
  attentionWindowDays: 3,
  defaultFreeStorageDays: 4,
  defaultGraceDays: 7,
};

export interface StoredRules {
  requiredDocumentTypes?: string[];
  attentionWindowDays?: number;
  defaultFreeStorageDays?: number;
  defaultGraceDays?: number;
}

export function resolveRules(stored?: StoredRules | null): ResolvedRules {
  return {
    requiredDocumentTypes: stored?.requiredDocumentTypes ?? DEFAULT_RULES.requiredDocumentTypes,
    attentionWindowDays: stored?.attentionWindowDays ?? DEFAULT_RULES.attentionWindowDays,
    defaultFreeStorageDays: stored?.defaultFreeStorageDays ?? DEFAULT_RULES.defaultFreeStorageDays,
    defaultGraceDays: stored?.defaultGraceDays ?? DEFAULT_RULES.defaultGraceDays,
  };
}

export interface RuleLimits {
  min: number;
  max: number;
}

export const LIMITS = {
  attentionWindowDays: { min: 1, max: 14 } as RuleLimits,
  defaultFreeStorageDays: { min: 0, max: 60 } as RuleLimits,
  defaultGraceDays: { min: 0, max: 90 } as RuleLimits,
};

// Returns what is wrong with a proposed change, or null when it is acceptable.
export function checkRulesChange(change: StoredRules): string | null {
  if (change.requiredDocumentTypes) {
    const bad = change.requiredDocumentTypes.filter((t) => !(DOCUMENT_TYPE_KEYS as readonly string[]).includes(t));
    if (bad.length > 0) return `Unknown document type: ${bad.join(', ')}`;
    if (new Set(change.requiredDocumentTypes).size !== change.requiredDocumentTypes.length) return 'A document type is listed twice';
  }
  for (const key of ['attentionWindowDays', 'defaultFreeStorageDays', 'defaultGraceDays'] as const) {
    const v = change[key];
    if (v === undefined) continue;
    const { min, max } = LIMITS[key];
    if (!Number.isInteger(v) || v < min || v > max) return `${key} must be a whole number from ${min} to ${max}`;
  }
  return null;
}
