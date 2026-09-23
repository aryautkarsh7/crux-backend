import { Schema, model, type InferSchemaType } from 'mongoose';

/** A partner diagnostic lab: processes samples, runs home collection in its radius, and may take walk-ins. */
const labSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    /** Reference labs run every test in the catalogue; centres run the routine panels. */
    type: { type: String, enum: ['reference', 'centre'], required: true },
    city: { type: String, required: true, default: 'bangalore', index: true },
    area: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    geo: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    phone: { type: String, default: '' },
    tagline: { type: String, default: '' },
    about: { type: String, default: '' },
    accreditations: { type: [String], default: [] },
    nablCertificate: { type: String, default: '' },
    rating: { type: Number, default: 4.6 },
    reviewCount: { type: Number, default: 0 },
    established: { type: Number },
    openHours: { type: String, default: '7:00 AM – 8:00 PM' },
    sundayHours: { type: String, default: '7:00 AM – 1:00 PM' },
    homeCollection: { type: Boolean, default: true },
    walkIn: { type: Boolean, default: true },
    collectionRadiusKm: { type: Number, default: 8 },
    /** Phlebotomist visits per home-collection window. */
    phlebotomists: { type: Number, default: 4 },
    reportTat: { type: String, default: '12–24 hours' },
    pathologist: { name: String, qualification: String, registration: String },
    tests: { type: [String], default: [] },
    equipment: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    photoUrl: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

labSchema.index({ city: 1, rating: -1 });

export type Lab = InferSchemaType<typeof labSchema>;
export const LabModel = model('Lab', labSchema);
