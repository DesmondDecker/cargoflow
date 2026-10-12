import { Schema, model, Types } from 'mongoose';

// Generic atomic counter, scoped per agency per named sequence. Receipt
// numbering is the first user (see getNextSequence in receiptController.ts)
// but the shape is generic on purpose — any future "needs a gapless,
// per-agency incrementing number" feature can reuse this instead of
// growing its own counter logic.
interface CounterDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  name: string;
  value: number;
}

const counterSchema = new Schema<CounterDoc>({
  agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true },
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
});

counterSchema.index({ agencyId: 1, name: 1 }, { unique: true });

const CounterModel = model<CounterDoc>('Counter', counterSchema);

// Atomic: findOneAndUpdate with $inc is a single Mongo operation, so two
// concurrent requests can never be handed the same number — the usual
// failure mode of "read current value, add one, write it back" done as two
// separate steps.
export async function getNextSequence(agencyId: Types.ObjectId, name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { agencyId, name },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return counter.value;
}
