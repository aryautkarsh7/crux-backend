import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Curxx-only settings for a Doctar doctor or hospital, merged onto the live record on read. Doctar's own
 * data is never copied here: only what the Curxx team decides (ranking, featuring, hiding, booking, contact
 * overrides).
 */
const overlaySchema = new Schema(
  {
    kind: { type: String, enum: ['doctor', 'facility'], required: true },
    doctarId: { type: String, required: true },
    /** For reading the list in the admin panel; the record's current slug. */
    slug: { type: String, default: '' },
    name: { type: String, default: '' },
    /** 1 = first in its city (+ specialty for doctors); 0 = normal order. */
    rank: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    /** Doctors: the doctor claimed the profile and the team checked their medical council registration. */
    registrationVerified: { type: Boolean, default: false },
    /** Taken off the website (the Doctar record stays untouched). */
    hidden: { type: Boolean, default: false },
    /** False = never bookable online, whatever IMPORTED_BOOKABLE says. */
    bookable: { type: Boolean, default: true },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);
overlaySchema.index({ kind: 1, doctarId: 1 }, { unique: true });

export type Overlay = InferSchemaType<typeof overlaySchema>;
export const DoctarOverlayModel = model('DoctarOverlay', overlaySchema, 'doctar_overlays');

/**
 * The last good Doctar listing index, gzipped and split into parts (a document is capped at 16 MB), so a
 * restart can serve listings straight away even while Doctar is unreachable. A cache, never a source of truth.
 */
const cacheSchema = new Schema(
  {
    name: { type: String, required: true },
    generation: { type: Number, required: true },
    part: { type: Number, required: true },
    parts: { type: Number, required: true },
    data: { type: Buffer, required: true },
    builtAt: { type: Date, required: true },
  },
  { versionKey: false },
);
cacheSchema.index({ name: 1, generation: -1, part: 1 }, { unique: true });

export const DirectoryCacheModel = model('DirectoryCache', cacheSchema, 'directory_cache');
