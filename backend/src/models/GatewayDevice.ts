import { Schema, model, Types } from 'mongoose';

// A business-owned phone that forwards its own incoming mobile-money SMS to
// POST /gateway/sms-notifications. Auth for that endpoint is the device's
// own API key (hashed at rest, shown once at creation) — not a user/admin
// JWT, since the forwarding happens from an unattended device/script.
export interface GatewayDeviceDoc {
  _id: Types.ObjectId;
  name: string;
  apiKeyHash: string;
  isActive: boolean;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const gatewayDeviceSchema = new Schema<GatewayDeviceDoc>(
  {
    name: { type: String, required: true, trim: true },
    apiKeyHash: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

export const GatewayDeviceModel = model<GatewayDeviceDoc>('GatewayDevice', gatewayDeviceSchema);
