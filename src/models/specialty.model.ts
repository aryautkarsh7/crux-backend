import { Schema, model, type InferSchemaType } from 'mongoose';

const specialtySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    plural: { type: String, required: true },
    icon: { type: String, required: true },
    fromPrice: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false },
);

export type Specialty = InferSchemaType<typeof specialtySchema>;
export const SpecialtyModel = model('Specialty', specialtySchema);
