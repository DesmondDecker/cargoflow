import { Schema, model, Types } from 'mongoose';
import { STATUS_KEYS, ContainerStatus } from '../constants/containerPipeline';

export type { ContainerStatus };

export type AttentionLevel = 'urgent' | 'attention' | 'normal';
export type ContainerSize = '20ft' | '40ft' | '40ft HC' | '45ft';

export interface DeadlineEntry {
  ruleName: string;
  startEvent: string;
  startDate: Date;
  dueDate: Date;
  status: 'pending' | 'completed' | 'expired';
}

export interface StatusHistoryEntry {
  status: ContainerStatus;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  changedByName?: string; // denormalized so history survives a user being deactivated later
  note?: string;
}

export interface ContainerDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  importerId: Types.ObjectId;
  blId: Types.ObjectId;
  containerNumber: string;
  size: ContainerSize;
  status: ContainerStatus;
  shippingLine?: string;
  vessel?: string;
  shippingLineDetection?: {
    guess?: string;
    confidence?: 'high' | 'medium' | 'low';
    source?: string;
    manuallyEdited?: boolean;
  };
  numberValidation?: {
    formatValid: boolean;
    checkDigitValid: boolean | null;
    issue?: string;
  };
  liveTracking: {
    resolved: boolean;
    carrierName?: string;
    status?: string;
    vesselName?: string;
    eta?: Date;
    source: string;
    publicTrackingUrl?: string;
  };
  assignedOfficerId?: Types.ObjectId;
  dates: {
    arrival?: Date;
    doReceived?: Date;
    discharged?: Date;
    cleared?: Date;
    delivered?: Date;
  };
  deadlines: DeadlineEntry[];
  statusHistory: StatusHistoryEntry[];
  requiredDocumentTypes: string[];
  attentionLevel: AttentionLevel;
  attentionReasons: string[];
  attentionRank: number; // 0=urgent,1=attention,2=normal — sort key for urgent-first lists
  transportAssignmentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number; // optimistic concurrency for offline mobile sync (client sends back the version it last saw)
}

const containerSchema = new Schema<ContainerDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    importerId: { type: Schema.Types.ObjectId, ref: 'Importer', required: true, index: true },
    blId: { type: Schema.Types.ObjectId, ref: 'BillOfLading', required: true, index: true },
    containerNumber: { type: String, required: true, trim: true, uppercase: true },
    size: { type: String, enum: ['20ft', '40ft', '40ft HC', '45ft'], default: '20ft' },
    status: {
      type: String,
      enum: STATUS_KEYS,
      default: STATUS_KEYS[0],
    },
    shippingLine: { type: String, trim: true },
    vessel: { type: String, trim: true },
    shippingLineDetection: {
      guess: String,
      confidence: { type: String, enum: ['high', 'medium', 'low'] },
      source: String,
      manuallyEdited: { type: Boolean, default: false },
    },
    numberValidation: {
      formatValid: { type: Boolean },
      checkDigitValid: { type: Boolean, default: null },
      issue: String,
    },
    liveTracking: {
      resolved: { type: Boolean, default: false },
      carrierName: String,
      status: String,
      vesselName: String,
      eta: Date,
      source: { type: String, default: 'none' },
      publicTrackingUrl: String,
    },
    assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'User' },
    dates: {
      arrival: Date,
      doReceived: Date,
      discharged: Date,
      cleared: Date,
      delivered: Date,
    },
    deadlines: [
      {
        ruleName: String,
        startEvent: String,
        startDate: Date,
        dueDate: Date,
        status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
      },
    ],
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedByName: String,
        note: String,
      },
    ],
    requiredDocumentTypes: { type: [String], default: ['CTN', 'BL', 'Invoice', 'PackingList'] },
    attentionLevel: { type: String, enum: ['urgent', 'attention', 'normal'], default: 'normal' },
    attentionReasons: { type: [String], default: [] },
    attentionRank: { type: Number, default: 2 },
    transportAssignmentId: { type: Schema.Types.ObjectId, ref: 'TransportAssignment' },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

containerSchema.index({ agencyId: 1, containerNumber: 1 }, { unique: true });
containerSchema.index({ agencyId: 1, attentionRank: 1, updatedAt: -1 });
containerSchema.index({ agencyId: 1, status: 1 });

export const ContainerModel = model<ContainerDoc>('Container', containerSchema);
