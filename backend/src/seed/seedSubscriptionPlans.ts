import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

// Optional convenience seed — the admin dashboard's Plans page reads
// straight from this collection, so it's empty (and unusable) until
// something populates it. Edit the list below to your real pricing before running.
const PLANS = [
  { planId: 'monthly', name: 'Monthly', amount: 500, currency: 'SLE', periodDays: 30, description: 'Billed every 30 days' },
  { planId: 'quarterly', name: 'Quarterly', amount: 1350, currency: 'SLE', periodDays: 90, description: 'Billed every 90 days — save vs monthly' },
  { planId: 'annual', name: 'Annual', amount: 5000, currency: 'SLE', periodDays: 365, description: 'Billed once a year — best value' },
];

async function run() {
  await connectDb();
  for (const plan of PLANS) {
    await SubscriptionPlanModel.findOneAndUpdate({ planId: plan.planId }, plan, { upsert: true });
    console.log(`Upserted plan: ${plan.planId}`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
