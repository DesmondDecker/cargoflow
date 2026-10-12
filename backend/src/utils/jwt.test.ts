import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { AppError } from './AppError';
import { env } from '../config/env';
import { verifyAccessToken } from './jwt';

describe('verifyAccessToken', () => {
  it('turns expired tokens into a 401 app error instead of a raw jwt exception', () => {
    const expired = jwt.sign({ sub: 'user_1', aud: 'agency-app' }, env.accessTokenSecret, { expiresIn: -1 });

    expect(() => verifyAccessToken(expired)).toThrow(AppError);
    try {
      verifyAccessToken(expired);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      if (err instanceof AppError) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('TOKEN_EXPIRED');
      }
    }
  });
});
