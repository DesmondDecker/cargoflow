import { Schema, model, Types } from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Transportation',
  'Fuel',
  'Handling',
  'Customs',
  'Packaging',
  'Salaries',
  'Storage',
  'Other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface ExpenseDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  containerId?: Types.ObjectId; // shipment-linked when known; optional because some operational cost isn't tied to one container
  category: ExpenseCategory;
  amount: number;
  currency: string; // 'SLE' default; foreign currency stored as stated, never converted (see shipmentFinanceService's own comment on why)
  description?: string;
  evidenceUrls: string[]; // receipt/invoice photos the expense is backed by
  recordedByUserId: Types.ObjectId;
  status: ExpenseStatus;
  approvedByUserId?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'SLE', uppercase: true, trim: true },
    description: { type: String, trim: true },
    evidenceUrls: [{ type: String }],
    recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

expenseSchema.index({ agencyId: 1, status: 1, createdAt: -1 });
expenseSchema.index({ agencyId: 1, containerId: 1 });

export const ExpenseModel = model<ExpenseDoc>('Expense', expenseSchema);
