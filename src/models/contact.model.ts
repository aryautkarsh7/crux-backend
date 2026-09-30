import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Private contact details of a doctor or facility, used only to tell them about booking requests.
 * Kept out of the doctor/facility records on purpose: public routes spread those records into
 * responses, and nothing public ever reads this collection.
 */
const contactSchema = new Schema(
  {
    kind: { type: String, enum: ['doctor', 'facility'], required: true },
    slug: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    /** doctar = from the import (refreshed on every run) · admin = typed in the admin panel (the import leaves it alone). */
    source: { type: String, enum: ['doctar', 'admin'], default: 'admin' },
  },
  { timestamps: true, versionKey: false },
);

contactSchema.index({ kind: 1, slug: 1 }, { unique: true });

export type Contact = InferSchemaType<typeof contactSchema>;
export const ContactModel = model('Contact', contactSchema);
