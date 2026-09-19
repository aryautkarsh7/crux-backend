import { Schema, model, type InferSchemaType } from 'mongoose';

const slotSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    doctorSlug: { type: String, required: true },
    startsAt: { type: Date, required: true },
    mode: { type: String, enum: ['clinic', 'video'], required: true },
    fee: { type: Number, required: true },
    status: { type: String, enum: ['open', 'held', 'booked'], default: 'open', index: true },
    holdExpiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

slotSchema.index({ doctorSlug: 1, startsAt: 1 });
slotSchema.index({ doctor: 1, status: 1, startsAt: 1 });
// Holds lapse on their own, returning the slot to the pool.
slotSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'held' } });

export type Slot = InferSchemaType<typeof slotSchema>;
export const SlotModel = model('Slot', slotSchema);
