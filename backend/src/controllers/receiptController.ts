import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ReceiptModel } from '../models/Receipt';
import { ShipmentPaymentModel } from '../models/ShipmentPayment';
import { ImporterModel } from '../models/Importer';
import { ContainerModel } from '../models/Container';
import { AgencyModel } from '../models/Agency';
import { UserModel } from '../models/User';
import { getNextSequence } from '../models/Counter';
import { buildReceiptPdf } from '../services/receiptPdfService';
import { uploadBufferToR2 } from '../services/storageService';
import { ActivityLogModel } from '../models/ActivityLog';

function receiptShape(r: {
  _id: unknown; receiptNumber: string; paymentId: unknown; importerId: unknown; containerId?: unknown;
  amount: number; currency: string; issuedAt: Date; issuedByUserId: unknown; pdfUrl: string;
}) {
  return {
    _id: String(r._id),
    receiptNumber: r.receiptNumber,
    paymentId: String(r.paymentId),
    importerId: String(r.importerId),
    containerId: r.containerId ? String(r.containerId) : undefined,
    amount: r.amount,
    currency: r.currency,
    issuedAt: r.issuedAt,
    issuedByUserId: String(r.issuedByUserId),
    pdfUrl: r.pdfUrl,
  };
}

const generateSchema = z.object({ paymentId: z.string().min(1) });

export const generateReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = generateSchema.parse(req.body);

  const payment = await ShipmentPaymentModel.findOne({ _id: paymentId, agencyId: req.auth!.agencyId });
  if (!payment) throw AppError.notFound('Payment not found');

  const existing = await ReceiptModel.findOne({ paymentId });
  if (existing) throw AppError.conflict('A receipt has already been issued for this payment', 'RECEIPT_EXISTS');

  const [agency, importer, container, issuer] = await Promise.all([
    AgencyModel.findById(req.auth!.agencyId),
    ImporterModel.findById(payment.importerId),
    payment.containerId ? ContainerModel.findById(payment.containerId) : Promise.resolve(null),
    UserModel.findById(req.auth!.userId),
  ]);
  if (!agency) throw AppError.notFound('Agency not found');
  if (!importer) throw AppError.notFound('Importer not found');

  const sequence = await getNextSequence(agency._id, 'receipt');
  const receiptNumber = `${agency.agencyCode}-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`;

  const pdfBuffer = await buildReceiptPdf({
    agencyName: agency.name,
    agencyContactEmail: agency.contactEmail,
    agencyContactPhone: agency.contactPhone,
    agencyAddress: agency.address,
    receiptNumber,
    issuedAt: new Date(),
    importerName: importer.name,
    importerPhone: importer.phone,
    containerNumber: container?.containerNumber,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    paymentNotes: payment.notes,
    issuedByName: issuer?.name || 'Staff',
  });

  const { fileKey, fileUrl } = await uploadBufferToR2('receipt_pdf', String(agency._id), pdfBuffer, 'application/pdf');

  const receipt = await ReceiptModel.create({
    agencyId: agency._id,
    receiptNumber,
    paymentId: payment._id,
    importerId: importer._id,
    containerId: payment.containerId,
    amount: payment.amount,
    currency: payment.currency,
    issuedAt: new Date(),
    issuedByUserId: req.auth!.userId,
    pdfFileKey: fileKey,
    pdfUrl: fileUrl,
  });

  await ActivityLogModel.create({
    agencyId: agency._id,
    containerId: payment.containerId,
    actorName: issuer?.name || 'User',
    actorUserId: issuer?._id,
    action: 'receipt_issued',
    description: `${issuer?.name || 'A staff member'} issued receipt ${receiptNumber} to ${importer.name}`,
    details: { receiptId: receipt._id },
  });

  return ok(res, { receipt: receiptShape(receipt) }, 201);
});

export const listReceipts = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.containerId) filter.containerId = req.query.containerId;
  if (req.query.importerId) filter.importerId = req.query.importerId;

  const receipts = await ReceiptModel.find(filter).sort({ issuedAt: -1 }).limit(200);
  return ok(res, { receipts: receipts.map(receiptShape) });
});

export const getReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receipt = await ReceiptModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!receipt) throw AppError.notFound('Receipt not found');
  return ok(res, { receipt: receiptShape(receipt) });
});
