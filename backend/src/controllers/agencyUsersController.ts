import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { UserModel } from '../models/User';
import { revokeAllForSubject } from '../services/tokenService';
import { checkUserChange } from '../services/agencyUserRules';

// The people who can sign in to an agency, and what each may do. Staff join
// with the shared agency password and a name, so this is where an owner sees
// who is on the team, changes a role, or switches someone off.

const userView = (u: { _id: unknown; name: string; phone?: string; email?: string; role: string; isActive: boolean; lastLoginAt?: Date }) => ({
  id: String(u._id),
  name: u.name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt,
});

export const listAgencyUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserModel.find({ agencyId: req.auth!.agencyId }).sort({ isActive: -1, role: 1, name: 1 });
  return ok(res, { users: users.map(userView), you: req.auth!.userId });
});

const updateSchema = z.object({ role: z.enum(['owner', 'admin', 'staff']).optional(), isActive: z.boolean().optional() });

export const updateAgencyUser = asyncHandler(async (req: Request, res: Response) => {
  const change = updateSchema.parse(req.body);
  const [actor, target] = await Promise.all([
    UserModel.findOne({ _id: req.auth!.userId, agencyId: req.auth!.agencyId }),
    UserModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }),
  ]);
  if (!actor || !target) throw AppError.notFound('User not found');

  const activeOwners = await UserModel.countDocuments({ agencyId: req.auth!.agencyId, role: 'owner', isActive: true });
  const problem = checkUserChange({ id: String(actor._id), role: actor.role }, { id: String(target._id), role: target.role, isActive: target.isActive }, change, activeOwners);
  if (problem) throw AppError.forbidden(problem, 'CHANGE_NOT_ALLOWED');

  if (change.role !== undefined) target.role = change.role;
  if (change.isActive !== undefined) target.isActive = change.isActive;
  await target.save();

  // Switching someone off, or changing what they may do, ends their current sessions.
  if (change.isActive === false || change.role !== undefined) await revokeAllForSubject(target._id, 'agency-app');
  return ok(res, { user: userView(target) });
});
