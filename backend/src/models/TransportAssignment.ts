import { Schema, model, Types } from 'mongoose';

export type TransportStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface ProofOfDelivery {
  photoUrl?: string;
  signatureUrl?: string;
  gps?: { lat: number; lng: number } | null;
  notes?: string;
  completedAt?: Date;
}

export interface TransportAssignmentDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  containerId: Types.ObjectId;
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  pickupLocation: string;
  destination: string;
  requiredDate?: Date;
  contactName?: string;
  contactPhone?: string;
  status: TransportStatus;
  proofOfDelivery?: ProofOfDelivery;
  rating?: { stars: number; comment?: string };
  createdAt: Date;
  updatedAt: Date;
}

const transportAssignmentSchema = new Schema<TransportAssignmentDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    pickupLocation: { type: String, required: true },
    destination: { type: String, required: true },
    requiredDate: { type: Date },
    contactName: { type: String },
    contactPhone: { type: String },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
      default: 'pending',
    },
    proofOfDelivery: {
      photoUrl: String,
      signatureUrl: String,
      gps: { lat: Number, lng: Number },
      notes: String,
      completedAt: Date,
    },
    rating: {
      stars: Number,
      comment: String,
    },
  },
  { timestamps: true }
);

transportAssignmentSchema.index({ driverId: 1, status: 1 });
transportAssignmentSchema.index({ agencyId: 1, status: 1 });
// A driver can only have one open (not yet finished) job per container.
transportAssignmentSchema.index(
  { containerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted', 'picked_up', 'in_transit'] } } }
);

export const TransportAssignmentModel = model<TransportAssignmentDoc>('TransportAssignment', transportAssignmentSchema);
