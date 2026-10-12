import { Schema, model, Types } from 'mongoose';

export type WarehouseVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type CapacityUnit = 'sqm' | 'container_slot';

export const AMENITIES = [
  'secured_247',
  'cctv',
  'forklift_onsite',
  'loading_dock',
  'climate_controlled',
  'fire_suppression',
  'weighbridge',
] as const;
export type Amenity = (typeof AMENITIES)[number];

export interface WarehouseDoc {
  _id: Types.ObjectId;
  ownerName: string;
  phone: string;
  passwordHash: string;
  businessName: string;
  location: string; // free-text area, e.g. "Cline Town, Freetown" — matches Driver.location's pattern
  coordinates?: { lat: number; lng: number } | null;
  capacityUnit: CapacityUnit;
  totalCapacity: number; // in capacityUnit
  availableCapacity: number; // decremented on confirmed bookings, restored on cancel/collect
  pricePerUnitPerDay: number; // Leones, matches VTO's per-unit pricing convention
  amenities: Amenity[];
  photos: string[]; // R2 file URLs, same convention as CargoDocument
  verificationStatus: WarehouseVerificationStatus;
  isActive: boolean;
  ratingTotal: number;
  ratingCount: number;
  // A paid placement boost, set by a platform admin (see
  // platformAdminController.setWarehouseSponsorship) — never self-service,
  // since there's no payment flow for it yet. sponsoredUntil expiring on
  // its own is deliberate: a boost that silently runs forever isn't really
  // "sponsored," it's just a permanent rank change nobody's paying for.
  sponsored: boolean;
  sponsoredUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<WarehouseDoc>(
  {
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    businessName: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    coordinates: { lat: Number, lng: Number },
    capacityUnit: { type: String, enum: ['sqm', 'container_slot'], required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    availableCapacity: { type: Number, required: true, min: 0 },
    pricePerUnitPerDay: { type: Number, required: true, min: 0 },
    amenities: [{ type: String, enum: AMENITIES }],
    photos: [{ type: String }],
    verificationStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
    isActive: { type: Boolean, default: true },
    ratingTotal: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    sponsored: { type: Boolean, default: false },
    sponsoredUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

warehouseSchema.index({ location: 1, isActive: 1, verificationStatus: 1 });

export const WarehouseModel = model<WarehouseDoc>('Warehouse', warehouseSchema);
