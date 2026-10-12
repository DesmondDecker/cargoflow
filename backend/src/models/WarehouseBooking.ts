import { Schema, model, Types } from 'mongoose';

export type WarehouseBookingStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'in_storage'
  | 'collected'
  | 'cancelled';

// Same shape as TransportAssignment's ProofOfDelivery, applied twice: once
// when goods go in, once when they come out. This is the record that
// resolves "what state was it in when it arrived" disputes — the whole
// reason storage needs more rigor than a one-off delivery.
export interface ConditionRecord {
  photoUrls?: string[];
  notes?: string;
  recordedBy?: 'warehouse' | 'agency';
  gps?: { lat: number; lng: number } | null;
  completedAt?: Date;
}

export interface WarehouseBookingDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  containerId?: Types.ObjectId; // optional — a booking can exist ahead of a container record
  warehouseId: Types.ObjectId;
  unitsBooked: number; // in the warehouse's capacityUnit
  startDate: Date;
  endDate: Date; // requested end; actual collection may run past it (see collectedAt)
  pricePerUnitPerDay: number; // snapshotted at booking time — protects both sides if the listing price changes later
  estimatedTotalPrice: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  status: WarehouseBookingStatus;
  checkIn?: ConditionRecord;
  checkOut?: ConditionRecord;
  collectedAt?: Date;
  rating?: { stars: number; comment?: string };
  createdAt: Date;
  updatedAt: Date;
}

const conditionRecordSchema = new Schema<ConditionRecord>(
  {
    photoUrls: [{ type: String }],
    notes: String,
    recordedBy: { type: String, enum: ['warehouse', 'agency'] },
    gps: { lat: Number, lng: Number },
    completedAt: Date,
  },
  { _id: false }
);

const warehouseBookingSchema = new Schema<WarehouseBookingDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    unitsBooked: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    pricePerUnitPerDay: { type: Number, required: true },
    estimatedTotalPrice: { type: Number, required: true },
    contactName: { type: String },
    contactPhone: { type: String },
    notes: { type: String },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'declined', 'in_storage', 'collected', 'cancelled'],
      default: 'requested',
    },
    checkIn: conditionRecordSchema,
    checkOut: conditionRecordSchema,
    collectedAt: Date,
    rating: {
      stars: Number,
      comment: String,
    },
  },
  { timestamps: true }
);

warehouseBookingSchema.index({ warehouseId: 1, status: 1 });
warehouseBookingSchema.index({ agencyId: 1, status: 1 });

export const WarehouseBookingModel = model<WarehouseBookingDoc>('WarehouseBooking', warehouseBookingSchema);
