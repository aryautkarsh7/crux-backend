import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * "Request an appointment" for a doctor who can't be booked online (Doctar listings): a name, a phone and a
 * preferred day and time. Not an appointment: the Curxx team calls back to confirm, and sets the status in
 * the admin panel. No sign-in, no slot, no payment.
 */
const appointmentRequestSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    doctorSlug: { type: String, required: true, index: true },
    doctorName: { type: String, default: '' },
    doctarId: { type: String, default: '' },
    /** The practising place the patient picked (one of the doctor's listed places), if any. */
    facilitySlug: { type: String, default: '' },
    facilityName: { type: String, default: '' },
    city: { type: String, default: '', index: true },
    patient: {
      name: { type: String, required: true },
      phone: { type: String, required: true, index: true },
    },
    /** YYYY-MM-DD, or '' for any day. */
    preferredDay: { type: String, default: '' },
    preferredTime: {
      type: String,
      enum: ['any', 'morning', 'afternoon', 'evening'],
      default: 'any',
    },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'cancelled'],
      default: 'requested',
      index: true,
    },
    /** Team note (admin panel). */
    note: { type: String, default: '' },
    /** Admin-only: who was told and how. Only test recipients or the log, never the doctor or hospital. */
    notify: {
      status: { type: String },
      mode: { type: String },
      detail: { type: String },
      at: { type: Date },
    },
    /** Hashed client address, for the spam limit (never the raw IP). */
    requestIp: { type: String, index: true },
  },
  { timestamps: true, versionKey: false },
);

export type AppointmentRequest = InferSchemaType<typeof appointmentRequestSchema>;
export const AppointmentRequestModel = model(
  'AppointmentRequest',
  appointmentRequestSchema,
  'appointment_requests',
);
