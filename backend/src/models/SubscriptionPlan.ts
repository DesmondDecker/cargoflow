import { Schema, model, Types } from 'mongoose';

// Plans are DB-backed (not hardcoded) so a platform admin can adjust
// pricing/duration without a redeploy — GET /platform-admin/plans just
// reads this collection.
export interface SubscriptionPlanDoc {
  _id: Types.ObjectId;
  planId: string; // stable slug referenced by Agency.subscription.planId / Payment.planId
  name: string;
  amount: number;
  currency: string;
  periodDays: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDoc>(
  {
    planId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'SLE' },
    periodDays: { type: Number, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel = model<SubscriptionPlanDoc>('SubscriptionPlan', subscriptionPlanSchema);
