import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ContainerModel } from '../models/Container';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ImporterModel } from '../models/Importer';
import { AgencyModel } from '../models/Agency';
import { UserModel } from '../models/User';
import { ActivityLogModel } from '../models/ActivityLog';
import { LetterDoc, LetterModel, MAX_REVISIONS } from '../models/Letter';
import {
  LETTER_TEMPLATES,
  LetterContext,
  LetterTemplateDef,
  MAX_FIELD_LENGTH,
  getTemplate,
  letterWarnings,
  missingRequired,
  prefillLetter,
  sanitizeFields,
} from '../services/letters/letterTemplates';
import { renderLetterFile } from '../services/letters/letterRenderer';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function templateView(def: LetterTemplateDef) {
  return { key: def.key, title: def.title, description: def.description, carrier: def.carrier, fields: def.fields };
}

async function buildContext(agencyId: string, container: { _id: unknown; blId: unknown; importerId: unknown; containerNumber: string; vessel?: string; shippingLine?: string }): Promise<LetterContext> {
  const [bl, importer, agency, onBl] = await Promise.all([
    BillOfLadingModel.findById(container.blId),
    ImporterModel.findOne({ _id: container.importerId, agencyId }),
    AgencyModel.findById(agencyId),
    ContainerModel.find({ agencyId, blId: container.blId }).select('containerNumber').sort({ containerNumber: 1 }),
  ]);
  return {
    container: { containerNumber: container.containerNumber, vessel: container.vessel, shippingLine: container.shippingLine },
    bl: bl ? { blNumber: bl.blNumber, vesselName: bl.vesselName, portOfLoading: bl.portOfLoading, shippingLine: bl.shippingLine } : undefined,
    blContainerNumbers: onBl.map((c) => c.containerNumber),
    importer: importer ?? undefined,
    agencyName: agency?.name,
    today: new Date(),
  };
}

function letterView(letter: LetterDoc, def: LetterTemplateDef, ctx?: LetterContext) {
  return {
    _id: String(letter._id),
    containerId: String(letter.containerId),
    templateKey: letter.templateKey,
    template: templateView(def),
    fields: letter.fields,
    missing: missingRequired(def, letter.fields),
    warnings: letterWarnings(def, letter.fields, ctx),
    history: [...letter.revisions].reverse().slice(0, 10).map((r) => ({ editedByName: r.editedByName, editedAt: r.editedAt })),
    createdByName: letter.createdByName,
    lastDownloadedAt: letter.lastDownloadedAt,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  };
}

async function findLetter(req: Request): Promise<{ letter: InstanceType<typeof LetterModel>; def: LetterTemplateDef }> {
  const letter = await LetterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!letter) throw AppError.notFound('Letter not found');
  const def = getTemplate(letter.templateKey);
  if (!def) throw AppError.internal('This letter uses a template that no longer exists');
  return { letter, def };
}

async function actor(req: Request): Promise<{ name: string; id: unknown }> {
  const user = await UserModel.findById(req.auth!.userId);
  return { name: user?.name || 'User', id: user?._id };
}

export const listTemplates = asyncHandler(async (_req: Request, res: Response) => ok(res, { templates: LETTER_TEMPLATES.map(templateView) }));

export const listContainerLetters = asyncHandler(async (req: Request, res: Response) => {
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');
  const letters = await LetterModel.find({ agencyId: req.auth!.agencyId, containerId: container._id }).sort({ updatedAt: -1 });
  return ok(res, {
    letters: letters.flatMap((l) => {
      const def = getTemplate(l.templateKey);
      return def ? [{ _id: String(l._id), templateKey: l.templateKey, title: def.title, missingCount: missingRequired(def, l.fields).length, updatedAt: l.updatedAt, createdByName: l.createdByName }] : [];
    }),
  });
});

const createSchema = z.object({ templateKey: z.string() });

export const createLetter = asyncHandler(async (req: Request, res: Response) => {
  const { templateKey } = createSchema.parse(req.body);
  const def = getTemplate(templateKey);
  if (!def) throw AppError.badRequest('Unknown letter template', 'UNKNOWN_TEMPLATE');
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const ctx = await buildContext(req.auth!.agencyId!, container);
  const fields = prefillLetter(def.key, ctx);
  const who = await actor(req);

  const letter = await LetterModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    templateKey: def.key,
    fields,
    revisions: [{ fields, editedByName: who.name, editedByUserId: who.id, editedAt: new Date() }],
    createdByName: who.name,
    createdByUserId: who.id,
  });
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    actorName: who.name,
    actorUserId: who.id,
    action: 'letter_created',
    description: `Started a letter: ${def.title}`,
    details: { letterId: letter._id, templateKey: def.key },
  });
  return ok(res, { letter: letterView(letter, def, ctx) }, 201);
});

export const getLetter = asyncHandler(async (req: Request, res: Response) => {
  const { letter, def } = await findLetter(req);
  const container = await ContainerModel.findOne({ _id: letter.containerId, agencyId: req.auth!.agencyId });
  const ctx = container ? await buildContext(req.auth!.agencyId!, container) : undefined;
  return ok(res, { letter: letterView(letter, def, ctx) });
});

const updateSchema = z.object({ fields: z.record(z.string(), z.string().max(MAX_FIELD_LENGTH)) });

export const updateLetter = asyncHandler(async (req: Request, res: Response) => {
  const { fields: input } = updateSchema.parse(req.body);
  const { letter, def } = await findLetter(req);

  const next = { ...letter.fields, ...sanitizeFields(def, input) };
  const who = await actor(req);
  letter.fields = next;
  letter.markModified('fields');
  letter.revisions.push({ fields: next, editedByName: who.name, editedByUserId: who.id as never, editedAt: new Date() });
  if (letter.revisions.length > MAX_REVISIONS) letter.revisions.splice(0, letter.revisions.length - MAX_REVISIONS);
  await letter.save();

  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: letter.containerId,
    actorName: who.name,
    actorUserId: who.id,
    action: 'letter_edited',
    description: `Edited a letter: ${def.title}`,
    details: { letterId: letter._id },
  });

  const container = await ContainerModel.findOne({ _id: letter.containerId, agencyId: req.auth!.agencyId });
  const ctx = container ? await buildContext(req.auth!.agencyId!, container) : undefined;
  return ok(res, { letter: letterView(letter, def, ctx) });
});

export const deleteLetter = asyncHandler(async (req: Request, res: Response) => {
  const { letter, def } = await findLetter(req);
  const who = await actor(req);
  await letter.deleteOne();
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: letter.containerId,
    actorName: who.name,
    actorUserId: who.id,
    action: 'letter_deleted',
    description: `Deleted a letter: ${def.title}`,
  });
  return ok(res, { message: 'Letter deleted' });
});

// Builds the Word file fresh from the saved values. A letter with a required
// field still empty is refused, with the names of what is missing, so one
// can never be sent out with a blank in it.
export const downloadLetter = asyncHandler(async (req: Request, res: Response) => {
  const { letter, def } = await findLetter(req);
  const missing = missingRequired(def, letter.fields);
  if (missing.length > 0) {
    const labels = def.fields.filter((f) => missing.includes(f.key)).map((f) => f.label);
    throw AppError.badRequest(`Fill in these before downloading: ${labels.join(', ')}`, 'LETTER_INCOMPLETE');
  }

  const buffer = await renderLetterFile(def.file, { ...Object.fromEntries(def.fields.map((f) => [f.key, ''])), ...letter.fields });
  const reference = (letter.fields.bl_number || letter.fields.bl_numbers || 'letter').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40);
  letter.lastDownloadedAt = new Date();
  await letter.save();

  const who = await actor(req);
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: letter.containerId,
    actorName: who.name,
    actorUserId: who.id,
    action: 'letter_downloaded',
    description: `Generated a letter: ${def.title}`,
    details: { letterId: letter._id },
  });

  res.setHeader('Content-Type', DOCX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${def.key}_${reference}.docx"`);
  res.send(buffer);
});
