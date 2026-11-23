import { describe, it, expect } from 'vitest';
import { sanitizeForAudit } from './adminAudit';

describe('sanitizeForAudit', () => {
  it('hides anything that looks like a secret, at any depth', () => {
    expect(sanitizeForAudit({ name: 'A', password: 'x', nested: { newPassword: 'y', apiKey: 'z', ok: 1 }, token: 't' })).toEqual({
      name: 'A',
      password: '[hidden]',
      nested: { newPassword: '[hidden]', apiKey: '[hidden]', ok: 1 },
      token: '[hidden]',
    });
  });
  it('cuts long text and deep nesting and long lists', () => {
    const out = sanitizeForAudit({ note: 'x'.repeat(500), deep: { a: { b: { c: 1 } } }, list: Array.from({ length: 50 }, (_, i) => i) }) as Record<string, unknown>;
    expect((out.note as string).length).toBe(201);
    expect(out.deep).toEqual({ a: { b: '[nested]' } });
    expect((out.list as number[]).length).toBe(20);
  });
});
