import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { message: 'Route not found', code: 'ROUTE_NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { message: err.message, code: err.code, ...(err.details !== undefined ? { details: err.details } : {}) } });
  }

  // Request bodies and queries are checked with zod; a failed check is the
  // caller's mistake (400), not a server fault (500).
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = issues[0];
    const message = first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Invalid request';
    return res.status(400).json({ success: false, error: { message, code: 'VALIDATION_ERROR', details: issues } });
  }

  // Mongoose validation / cast / duplicate-key errors: surface a clean
  // message instead of a raw stack trace, but don't leak internals in prod
  // beyond that. These three still pass their own message through — only
  // truly unexpected errors get masked below.
  const anyErr = err as { name?: string; code?: number; message?: string };
  if (anyErr?.name === 'ValidationError' || anyErr?.name === 'CastError') {
    return res.status(400).json({ success: false, error: { message: anyErr.message || 'Invalid request', code: 'VALIDATION_ERROR' } });
  }
  if (anyErr?.code === 11000) {
    return res.status(409).json({ success: false, error: { message: 'A record with that value already exists', code: 'DUPLICATE' } });
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  const message = env.isProd ? 'Internal server error' : anyErr?.message || 'Internal server error';
  return res.status(500).json({ success: false, error: { message, code: 'INTERNAL' } });
}
