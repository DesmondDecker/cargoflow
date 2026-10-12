import { Schema, model, Types } from 'mongoose';

// Raw SMS forwarded by a gateway device, before/after attempted matching to
// a Payment. Kept even when unmatched so a platform admin can manually
// reconcile via the payments queue, and so the parser can be tuned later
// against real captured messages.
export interface MobileMoneyNotificationDoc {
  _id: Types.ObjectId;
  gatewayDeviceId: Types.ObjectId;
  rawMessage: string;
  parsed?: {
    provider?: 'orange_money' | 'afrimoney';
    amount?: number;
    transactionId?: string;
    counterpartyPhone?: string;
  };
  matchedPaymentId?: Types.ObjectId;
  receivedAt: Date;
}

const mobileMoneyNotificationSchema = new Schema<MobileMoneyNotificationDoc>({
  gatewayDeviceId: { type: Schema.Types.ObjectId, ref: 'GatewayDevice', required: true, index: true },
  rawMessage: { type: String, required: true },
  parsed: {
    provider: { type: String, enum: ['orange_money', 'afrimoney'] },
    amount: Number,
    transactionId: String,
    counterpartyPhone: String,
  },
  matchedPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  receivedAt: { type: Date, default: Date.now },
});

export const MobileMoneyNotificationModel = model<MobileMoneyNotificationDoc>(
  'MobileMoneyNotification',
  mobileMoneyNotificationSchema
);
