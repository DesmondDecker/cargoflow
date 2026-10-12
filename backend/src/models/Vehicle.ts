import { Schema, model, Types } from 'mongoose';

// Matches the mobile app's DriverVehicle type exactly: vehicleType is a
// free-form label ('20ft Truck', 'Flatbed', ...) rather than a code, and
// containerCompatibility uses the app's ContainerSize strings.
export type VehicleTypeLabel = '20ft Truck' | '40ft Truck' | 'Flatbed' | 'Low Bed' | 'Pickup' | 'Van' | 'Other';
export type ContainerSizeLabel = '20ft' | '40ft' | '40ft HC' | '45ft';

export interface VehicleDoc {
  _id: Types.ObjectId;
  driverId: Types.ObjectId;
  vehicleType: VehicleTypeLabel;
  plateNumber: string;
  containerCompatibility: ContainerSizeLabel[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<VehicleDoc>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    vehicleType: { type: String, enum: ['20ft Truck', '40ft Truck', 'Flatbed', 'Low Bed', 'Pickup', 'Van', 'Other'], required: true },
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
    containerCompatibility: { type: [String], enum: ['20ft', '40ft', '40ft HC', '45ft'], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const VehicleModel = model<VehicleDoc>('Vehicle', vehicleSchema);
