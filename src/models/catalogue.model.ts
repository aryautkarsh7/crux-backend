import { Schema, model } from 'mongoose';

/**
 * Cities, conditions and surgeries. Their slugs are public URLs (/{city}/…, /{city}/treatment-for-{slug},
 * /{city}/surgery/{slug}), so they can be added and edited but a slug never changes once created.
 * Seeded from db/data by the catalogue sync; `managed` records are never overwritten.
 */

const localitySchema = new Schema(
  { slug: { type: String, required: true }, name: { type: String, required: true }, pincode: { type: String, default: '' }, lat: Number, lng: Number },
  { _id: false },
);

const citySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    state: { type: String, required: true },
    /** State medical council shown on doctor registrations. */
    council: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    pincodePrefixes: { type: [String], default: [] },
    /** Other URL spellings that redirect here, e.g. bengaluru → bangalore. */
    aliases: { type: [String], default: [] },
    tier: { type: Number, enum: [1, 2], default: 2 },
    localities: { type: [localitySchema], default: [] },
    /** Position in city pickers and the footer (1 = first); 0 = alphabetical after the popular ones. */
    popularOrder: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

const conditionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    specialty: { type: String, required: true, index: true },
    focus: { type: String, default: '' },
    summary: { type: String, default: '' },
    symptoms: { type: [String], default: [] },
    causes: { type: [String], default: [] },
    treatments: { type: [String], default: [] },
    selfCare: { type: [String], default: [] },
    whenToSee: { type: [String], default: [] },
    /** Label for the homepage "Popular Consultations" chip; empty = not a chip. */
    popular: { type: String, default: '' },
    /** Chip position (1 = first). */
    popularOrder: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

const surgerySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    specialty: { type: String, required: true, index: true },
    icon: { type: String, default: 'healing' },
    popular: { type: Boolean, default: false },
    description: { type: String, default: '' },
    treats: { type: [String], default: [] },
    techniques: { type: [String], default: [] },
    durationMinutes: { type: [Number], default: [30, 60] },
    stay: { type: String, default: '' },
    recovery: { type: String, default: '' },
    anaesthesia: { type: String, default: '' },
    /** Typical cost range in a tier-1 city (tier-2 is shown ~15% lower). */
    cost: { type: [Number], default: [0, 0] },
    insurance: { type: Boolean, default: false },
    steps: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    departments: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

export const CityModel = model('City', citySchema);
export const ConditionModel = model('Condition', conditionSchema);
export const SurgeryModel = model('Surgery', surgerySchema);
