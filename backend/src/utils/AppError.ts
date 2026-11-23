// A single error shape carried through the whole app so the error-handling
// middleware can always produce { success:false, error:{ message, code } } —
// the exact ApiEnvelope shape every client (mobile, admin, driver) expects.
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown; // e.g. per-field validation errors, passed through to the client

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(message, 429, code);
  }
  static notImplemented(message: string, code = 'NOT_IMPLEMENTED') {
    return new AppError(message, 501, code);
  }
  static internal(message = 'Internal server error', code = 'INTERNAL') {
    return new AppError(message, 500, code);
  }
}
