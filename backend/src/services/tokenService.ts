import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { RefreshTokenModel } from '../models/RefreshToken';
import { AccessTokenPayload, signAccessToken, TokenAudience } from '../utils/jwt';
import { AppError } from '../utils/AppError';

function hashToken(raw: string): string {
  return crypto.createHmac('sha256', env.refreshTokenSecret).update(raw).digest('hex');
}

function randomRefreshToken(): string {
  return `${uuidv4()}.${crypto.randomBytes(32).toString('hex')}`;
}

export interface IssueTokensInput {
  audience: TokenAudience;
  subjectId: Types.ObjectId | string;
  agencyId?: Types.ObjectId | string;
  role?: string;
  deviceId?: string;
}

export async function issueTokenPair(input: IssueTokensInput): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: AccessTokenPayload = {
    sub: String(input.subjectId),
    aud: input.audience,
    agencyId: input.agencyId ? String(input.agencyId) : undefined,
    role: input.role,
  };
  const accessToken = signAccessToken(payload);

  const raw = randomRefreshToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  // One active refresh token per (subject, audience, device): replacing
  // rather than accumulating rows keeps re-login/re-join from leaking an
  // ever-growing set of valid sessions for the same physical device.
  if (input.deviceId) {
    await RefreshTokenModel.updateMany(
      { subjectId: input.subjectId, audience: input.audience, deviceId: input.deviceId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  await RefreshTokenModel.create({
    tokenHash: hashToken(raw),
    audience: input.audience,
    subjectId: input.subjectId,
    agencyId: input.agencyId,
    deviceId: input.deviceId,
    expiresAt,
  });

  return { accessToken, refreshToken: raw };
}

// Validates + burns the presented refresh token (rotation: a replayed token
// is always rejected, whether reused by an attacker or resubmitted by the
// legitimate client after already rotating once) and returns who it
// belonged to. The caller re-fetches the live User/Driver (role/agencyId can
// have changed since the token was issued — e.g. promoted to admin) and
// calls issueTokenPair itself to get the new pair.
export async function consumeRefreshToken(
  rawToken: string,
  audience: TokenAudience
): Promise<{ subjectId: string; agencyId?: string; deviceId?: string }> {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshTokenModel.findOne({ tokenHash, audience });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw AppError.unauthorized('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }

  record.revokedAt = new Date();
  await record.save();

  return {
    subjectId: String(record.subjectId),
    agencyId: record.agencyId ? String(record.agencyId) : undefined,
    deviceId: record.deviceId,
  };
}

export async function revokeAllForSubject(subjectId: Types.ObjectId | string, audience: TokenAudience): Promise<void> {
  await RefreshTokenModel.updateMany({ subjectId, audience, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllForAgency(agencyId: Types.ObjectId | string): Promise<void> {
  await RefreshTokenModel.updateMany({ agencyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeOneDevice(subjectId: Types.ObjectId | string, audience: TokenAudience, deviceId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ subjectId, audience, deviceId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
