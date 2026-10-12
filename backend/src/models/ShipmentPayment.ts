import { Schema, model, Types } from 'mongoose';

// Deliberately a separate model from models/Payment.ts. That one is
// CargoFlow billing an agency for its subscription (planId, Orange
// Money/Afrimoney, activation codes) — a completely different business
// relationship from an importer paying the agency for a shipment. Folding
// these together would mean a subscription-billing query could
// accidentally pick up customer payments or vice versa; keeping them apart
// costs one extra model and avoids that entirely.
export const SHIPMENT_PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'] as const;
export type ShipmentPaymentMethod = (typeof SHIPMENT_PAYMENT_METHODS)[number];

export interface ShipmentPaymentDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  importerId: Types.ObjectId; // the customer who paid
  containerId?: Types.ObjectId; // shipment-linked when known
  amount: number;
  currency: string;
  paymentMethod: ShipmentPaymentMethod;
  paidAt: Date;
  recordedByUserId: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const shipmentPaymentSchema = new Schema<ShipmentPaymentDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    importerId: { type: Schema.Types.ObjectId, ref: 'Importer', required: true, index: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'SLE', uppercase: true, trim: true },
    paymentMethod: { type: String, enum: SHIPMENT_PAYMENT_METHODS, required: true },
    paidAt: { type: Date, required: true, default: Date.now },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

shipmentPaymentSchema.index({ agencyId: 1, containerId: 1 });
shipmentPaymentSchema.index({ agencyId: 1, importerId: 1 });

export const ShipmentPaymentModel = model<ShipmentPaymentDoc>('ShipmentPayment', shipmentPaymentSchema);
