import { Schema, model, type InferSchemaType } from 'mongoose';

const slotSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    doctorSlug: { type: String, required: true },
    startsAt: { type: Date, required: true },
    mode: { type: String, enum: ['clinic', 'video'], required: true },
    fee: { type: Number, required: true },
    status: { type: String, enum: ['open', 'held', 'booked'], default: 'open', index: true },
    /** A free video consult offered by the doctor. */
    free: { type: Boolean, default: false },
    holdExpiresAt: { type: Date },
    heldBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

// Unique so concurrent on-demand generation can't create the same slot twice.
slotSchema.index({ doctorSlug: 1, startsAt: 1 }, { unique: true });
slotSchema.index({ doctor: 1, status: 1, startsAt: 1 });
// Lapsed holds are treated as open at query time (see lib/slots.ts). A TTL index
// here would delete the slot outright instead of returning it to the pool.
slotSchema.index({ status: 1, holdExpiresAt: 1 });

export type Slot = InferSchemaType<typeof slotSchema>;
export const SlotModel = model('Slot', slotSchema);
