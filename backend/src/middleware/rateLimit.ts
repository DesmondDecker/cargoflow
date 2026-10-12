import rateLimit from 'express-rate-limit';

// Applied to auth endpoints only (register/join/login, all three apps) to
// slow down credential-guessing against the shared agency password and
// driver/admin passwords.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts. Please wait and try again.', code: 'RATE_LIMITED' } },
});
