import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { errorHandler } from './errorHandler';

function run(err: unknown) {
  const res = { statusCode: 0, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  errorHandler(err, {} as never, res as never, (() => {}) as never);
  return res;
}

describe('errorHandler', () => {
  it('answers a failed zod check with 400 and the field name, not 500', () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
    const res = run(parsed.error);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string; message: string } }).error.code).toBe('VALIDATION_ERROR');
    expect((res.body as { error: { message: string } }).error.message).toContain('email');
  });
  it('still masks unexpected errors as 500', () => {
    expect(run(new Error('boom')).statusCode).toBe(500);
  });
});
