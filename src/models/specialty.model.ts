import { Schema, model, type InferSchemaType } from 'mongoose';

const subSpecialtySchema = new Schema(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'stethoscope' },
  },
  { _id: false },
);

const specialtySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    plural: { type: String, required: true },
    icon: { type: String, required: true },
    fromPrice: { type: Number, required: true },
    subSpecialties: { type: [subSpecialtySchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

export type SubSpecialty = InferSchemaType<typeof subSpecialtySchema>;
/** Plain sub-specialty objects rather than mongoose subdocuments, so seeds and updates stay assignable. */
export type Specialty = Omit<InferSchemaType<typeof specialtySchema>, 'subSpecialties'> & { subSpecialties: SubSpecialty[] };
export const SpecialtyModel = model<Specialty>('Specialty', specialtySchema);
