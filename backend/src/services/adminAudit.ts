// Turns a request body into something safe and short enough to keep in the
// audit log: anything that looks like a secret is replaced, long text is cut,
// and nesting is flattened to a few levels.

const SECRET_KEY = /pass(word)?|secret|token|authorization|key|pin/i;

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 3) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      out[k] = SECRET_KEY.test(k) ? '[hidden]' : sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
