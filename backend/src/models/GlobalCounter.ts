import { Schema, model } from 'mongoose';

// A gapless counter that is not tied to one agency (Counter.ts is per
// agency). Customs approval references are numbered across the whole
// platform, so two agencies can never be given the same reference.
const schema = new Schema<{ name: string; value: number }>({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

const GlobalCounterModel = model<{ name: string; value: number }>('GlobalCounter', schema);

// One atomic Mongo operation, so concurrent approvals cannot be handed the same number.
export async function getNextGlobalSequence(name: string): Promise<number> {
  const counter = await GlobalCounterModel.findOneAndUpdate({ name }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return counter.value;
}
