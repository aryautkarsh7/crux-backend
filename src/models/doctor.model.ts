import { Schema, model, type InferSchemaType } from 'mongoose';

const doctorSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    qualification: { type: String, required: true },
    title: { type: String, required: true },
    specialty: { type: String, required: true, index: true },
    city: { type: String, required: true, default: 'bangalore', index: true },
    area: { type: String, required: true },
    clinicName: { type: String, required: true },
    experienceYears: { type: Number, required: true },
    fee: { type: Number, required: true },
    videoFee: { type: Number, required: true },
    rating: { type: Number, required: true, default: 4.8 },
    reviewCount: { type: Number, required: true, default: 0 },
    recommendPercent: { type: Number, required: true, default: 97 },
    languages: { type: [String], default: ['English'] },
    photoUrl: { type: String, default: '' },
    about: { type: String, default: '' },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

// Listing queries filter by city + specialty and sort by fee/experience/rating.
doctorSchema.index({ city: 1, specialty: 1, fee: 1 });
doctorSchema.index({ city: 1, specialty: 1, experienceYears: -1 });
doctorSchema.index({ name: 'text', clinicName: 'text', area: 'text' });

export type Doctor = InferSchemaType<typeof doctorSchema>;
export const DoctorModel = model('Doctor', doctorSchema);
