import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { MobileMoneyNotificationModel } from '../models/MobileMoneyNotification';
import { PaymentModel } from '../models/Payment';

// Very deliberately simple parsing: Orange Money and Afrimoney SMS templates
// vary and this pass has no captured real-world samples to tune against
// (flagged in README as a follow-up). This extracts an amount and a
// transaction-id-looking token if present; anything it can't confidently
// parse is still stored raw so a platform admin can reconcile it manually
// from the payments queue — nothing is silently dropped.
function parseMobileMoneyMessage(raw: string): { provider?: 'orange_money' | 'afrimoney'; amount?: number; transactionId?: string } {
  const lower = raw.toLowerCase();
  const provider = lower.includes('orange') ? 'orange_money' : lower.includes('afrimoney') || lower.includes('africell') ? 'afrimoney' : undefined;
  const amountMatch = raw.match(/(?:SLE|NLE|Le)\s?([\d,]+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;
  const txnMatch = raw.match(/\b(?:Txn|Transaction|Ref)[:\s]*([A-Z0-9]{6,})\b/i);
  const transactionId = txnMatch ? txnMatch[1] : undefined;
  return { provider, amount, transactionId };
}

const ingestSchema = z.object({ message: z.string().min(1) });

export const ingestSmsNotification = asyncHandler(async (req: Request, res: Response) => {
  const { message } = ingestSchema.parse(req.body);
  const parsed = parseMobileMoneyMessage(message);

  const notification = await MobileMoneyNotificationModel.create({
    gatewayDeviceId: req.gatewayDeviceId,
    rawMessage: message,
    parsed,
  });

  // Auto-match only on an exact transaction-id hit against a still-pending
  // submitted payment — anything looser (amount-only, no transaction id) is
  // left for a platform admin to verify manually rather than risking a
  // false match against the wrong agency's payment.
  if (parsed.transactionId) {
    const payment = await PaymentModel.findOne({ submittedTransactionId: parsed.transactionId, status: 'submitted' });
    if (payment) {
      notification.matchedPaymentId = payment._id;
      await notification.save();
    }
  }

  return ok(res, { received: true, matched: !!notification.matchedPaymentId }, 201);
});
