import { Schema, model, type InferSchemaType } from 'mongoose';

const reviewSchema = new Schema(
  {
    doctorSlug: { type: String, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    author: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    mode: { type: String, enum: ['clinic', 'video'], required: true },
    tags: { type: [String], default: [] },
    helpful: { type: Number, default: 0 },
    helpfulBy: { type: [Schema.Types.ObjectId], default: [], select: false },
    verified: { type: Boolean, default: true },
    visitedFor: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ doctorSlug: 1, createdAt: -1 });
// One review per patient per doctor; seeded reviews have no user.
reviewSchema.index({ doctorSlug: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });

export type Review = InferSchemaType<typeof reviewSchema>;
export const ReviewModel = model('Review', reviewSchema);
