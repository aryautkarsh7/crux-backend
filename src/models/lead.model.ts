import { Schema, model, type InferSchemaType } from 'mongoose';

/** Inbound interest: provider sign-ups, callback requests, newsletter, corporate plans. */
const leadSchema = new Schema(
  {
    kind: { type: String, enum: ['provider', 'hospital', 'corporate', 'callback', 'newsletter', 'surgery', 'plus'], required: true, index: true },
    surgery: { type: String, default: '' },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    organisation: { type: String, default: '' },
    city: { type: String, default: '' },
    specialty: { type: String, default: '' },
    message: { type: String, default: '' },
    source: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

export type Lead = InferSchemaType<typeof leadSchema>;
export const LeadModel = model('Lead', leadSchema);
