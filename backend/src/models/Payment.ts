import { Schema, model, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'activated' | 'rejected';
export type PaymentMethod = 'orange_money' | 'afrimoney';

export interface PaymentDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  planId: string;
  amountExpected: number;
  currency: string;
  paymentMethod: PaymentMethod;
  merchantNumber: string;
  referenceCode: string; // shown to the agency to include as a reference where possible
  payerPhoneNumber?: string;
  submittedTransactionId?: string;
  status: PaymentStatus;
  rejectionReason?: string;
  verificationMethod?: 'auto_sms' | 'manual';
  activationCodeHash?: string;
  activationCodeExpiresAt?: Date;
  activationCodeSentVia?: 'sms' | 'in_app_only';
  verifiedAt?: Date;
  activatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    planId: { type: String, required: true },
    amountExpected: { type: Number, required: true },
    currency: { type: String, required: true, default: 'SLE' },
    paymentMethod: { type: String, enum: ['orange_money', 'afrimoney'], required: true },
    merchantNumber: { type: String, required: true },
    referenceCode: { type: String, required: true, index: true },
    payerPhoneNumber: { type: String },
    submittedTransactionId: { type: String },
    status: { type: String, enum: ['pending', 'submitted', 'verified', 'activated', 'rejected'], default: 'pending' },
    rejectionReason: { type: String },
    verificationMethod: { type: String, enum: ['auto_sms', 'manual'] },
    activationCodeHash: { type: String },
    activationCodeExpiresAt: { type: Date },
    activationCodeSentVia: { type: String, enum: ['sms', 'in_app_only'] },
    verifiedAt: { type: Date },
    activatedAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ agencyId: 1, status: 1 });

export const PaymentModel = model<PaymentDoc>('Payment', paymentSchema);
