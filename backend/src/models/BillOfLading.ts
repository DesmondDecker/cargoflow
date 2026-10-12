import { Schema, model, Types } from 'mongoose';

export interface BillOfLadingDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  importerId: Types.ObjectId;
  blNumber: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: Date;
  eta?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const billOfLadingSchema = new Schema<BillOfLadingDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    importerId: { type: Schema.Types.ObjectId, ref: 'Importer', required: true, index: true },
    blNumber: { type: String, required: true, trim: true, uppercase: true },
    shippingLine: { type: String, trim: true },
    vesselName: { type: String, trim: true },
    portOfLoading: { type: String, trim: true },
    portOfDischarge: { type: String, trim: true },
    etd: { type: Date },
    eta: { type: Date },
  },
  { timestamps: true }
);

billOfLadingSchema.index({ agencyId: 1, blNumber: 1 }, { unique: true });

export const BillOfLadingModel = model<BillOfLadingDoc>('BillOfLading', billOfLadingSchema);
