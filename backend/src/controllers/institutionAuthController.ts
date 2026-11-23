import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { InstitutionUserDoc, InstitutionUserModel } from '../models/InstitutionUser';
import { recordInstitutionEvent } from '../services/institutionAudit';
import { consumeRefreshToken, issueTokenPair, revokeAllForSubject } from '../services/tokenService';

export function institutionUserSummary(u: Pick<InstitutionUserDoc, '_id' | 'name' | 'email' | 'institution' | 'isActive' | 'notifyByEmail'> & { isSupervisor?: boolean }) {
  return { id: String(u._id), name: u.name, email: u.email, institution: u.institution, isActive: u.isActive, notifyByEmail: u.notifyByEmail, isSupervisor: !!u.isSupervisor };
}

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export const institutionLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await InstitutionUserModel.findOne({ email: email.toLowerCase() });
  const matches = user ? await comparePassword(password, user.passwordHash) : false;
  if (!user || !user.isActive || !matches) {
    // Failed sign-ins are logged too, whether or not the email exists, so repeated guessing is visible.
    await recordInstitutionEvent({
      institutionUserId: user ? String(user._id) : undefined,
      userName: user?.name ?? '(unknown account)',
      email,
      institution: user?.institution,
      action: 'auth.login',
      outcome: 'failed',
      statusCode: 401,
      method: 'POST',
      path: req.originalUrl.split('?')[0],
      detail: user && !user.isActive ? 'Account is deactivated' : undefined,
      req,
    });
    throw AppError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordInstitutionEvent({ institutionUserId: String(user._id), userName: user.name, email: user.email, institution: user.institution, action: 'auth.login', outcome: 'ok', statusCode: 200, method: 'POST', path: req.originalUrl.split('?')[0], req });
  const tokens = await issueTokenPair({ audience: 'institution-portal', subjectId: user._id });
  return ok(res, { user: institutionUserSummary(user), ...tokens });
});

export const institutionRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
  const consumed = await consumeRefreshToken(refreshToken, 'institution-portal');
  const user = await InstitutionUserModel.findById(consumed.subjectId);
  if (!user || !user.isActive) throw AppError.unauthorized('Account is inactive or no longer exists');
  return ok(res, await issueTokenPair({ audience: 'institution-portal', subjectId: user._id }));
});

export const institutionMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await InstitutionUserModel.findById(req.auth!.institutionUserId);
  if (!user) throw AppError.notFound('User not found');
  return ok(res, { user: institutionUserSummary(user) });
});

export const institutionLogout = asyncHandler(async (req: Request, res: Response) => {
  await revokeAllForSubject(req.auth!.institutionUserId!, 'institution-portal');
  return ok(res, { message: 'Signed out' });
});

export const institutionChangePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(100) }).parse(req.body);
  const user = await InstitutionUserModel.findById(req.auth!.institutionUserId);
  if (!user) throw AppError.notFound('User not found');
  if (!(await comparePassword(currentPassword, user.passwordHash))) throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await revokeAllForSubject(user._id, 'institution-portal'); // other sessions must sign in again
  return ok(res, { message: 'Password changed. Please sign in again.' });
});
