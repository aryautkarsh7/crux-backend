import { Schema, model, type InferSchemaType } from 'mongoose';

const facilitySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    type: { type: String, enum: ['hospital', 'clinic'], required: true, index: true },
    /** One of the 19 facility types, e.g. "Eye Hospital" — separate from departments. */
    category: { type: String, default: 'Clinic', index: true },
    pincode: { type: String, default: '' },
    geo: { lat: Number, lng: Number },
    /** Outpatient hours when doctors consult (openHours is when the building is open). */
    opdHours: { type: String, default: '' },
    specialties: { type: [String], default: [], index: true },
    city: { type: String, required: true, default: 'bangalore', index: true },
    area: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    /** Admin ranking within its city (1 = top, 0 = not ranked). rankScore is derived for sorting. */
    rank: { type: Number, default: 0 },
    rankScore: { type: Number, default: 0, index: true },
    tagline: { type: String, default: '' },
    about: { type: String, default: '' },
    rating: { type: Number, default: 4.6 },
    reviewCount: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 1 },
    emergency24x7: { type: Boolean, default: false },
    nabh: { type: Boolean, default: false },
    beds: { type: Number, default: 0 },
    established: { type: Number },
    openHours: { type: String, default: '8:00 AM – 9:00 PM' },
    departments: { type: [String], default: [] },
    services: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    insurers: { type: [String], default: [] },
    photoUrl: { type: String, default: '' },
    /** Extra photos (interior, equipment) shown beside the main photo on the profile. */
    gallery: { type: [String], default: [] },
    /** Created or edited in the admin panel: the catalogue sync never overwrites or deletes it. */
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

facilitySchema.index({ city: 1, type: 1, rating: -1 });
facilitySchema.index({ name: 'text', area: 'text', departments: 'text' });

export type Facility = InferSchemaType<typeof facilitySchema>;
export const FacilityModel = model('Facility', facilitySchema);
