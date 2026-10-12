import { Schema, model, Types } from 'mongoose';

// A Receipt documents a ShipmentPayment that already happened — it is
// never itself the record of payment. That split (payment vs. the receipt
// that documents it) is deliberate: the payment is the source of truth for
// "how much money came in and when"; the receipt is a formatted artifact
// handed to the customer. Collapsing them would make it impossible to
// reissue or reformat a receipt without touching financial history, and
// impossible to record a payment before the receipt paperwork catches up.
export interface ReceiptDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  receiptNumber: string; // e.g. "CF-2026-000142" — gapless per agency, see Counter.ts
  paymentId: Types.ObjectId; // one receipt per payment
  importerId: Types.ObjectId;
  containerId?: Types.ObjectId;
  amount: number;
  currency: string;
  issuedAt: Date;
  issuedByUserId: Types.ObjectId;
  pdfFileKey: string;
  pdfUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const receiptSchema = new Schema<ReceiptDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    receiptNumber: { type: String, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'ShipmentPayment', required: true, unique: true },
    importerId: { type: Schema.Types.ObjectId, ref: 'Importer', required: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container' },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
    issuedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pdfFileKey: { type: String, required: true },
    pdfUrl: { type: String, required: true },
  },
  { timestamps: true }
);

receiptSchema.index({ agencyId: 1, receiptNumber: 1 }, { unique: true });

export const ReceiptModel = model<ReceiptDoc>('Receipt', receiptSchema);
