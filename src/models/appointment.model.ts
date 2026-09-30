import { Schema, model, type InferSchemaType } from 'mongoose';

const appointmentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorSlug: { type: String, required: true },
    slot: { type: Schema.Types.ObjectId, ref: 'Slot', required: true, unique: true },
    startsAt: { type: Date, required: true },
    /** audio = teleconsultation by phone call, booked on a tele (video) slot. */
    mode: { type: String, enum: ['clinic', 'video', 'audio'], required: true, index: true },
    amount: { type: Number, required: true },
    /** requested = a booking request to a doctor who confirms by hand (imported doctors); no payment is taken. */
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    focus: { type: String, default: '' },
    notes: { type: String, default: '' },
    patient: {
      name: { type: String, required: true },
      age: { type: Number },
      gender: { type: String, enum: ['female', 'male', 'other'] },
      phone: { type: String, required: true },
    },
    /**
     * Admin-only: how the doctor was told about a booking request. Never sent to patients (it names the
     * doctor's private contact). status: sent · test · logged · skipped · failed · no_contact.
     */
    notify: {
      status: { type: String },
      mode: { type: String },
      contactSource: { type: String },
      detail: { type: String },
      at: { type: Date },
    },
    /** Hashed client address of a booking request, for the per-address spam limit (never the raw IP). */
    requestIp: { type: String },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ user: 1, startsAt: -1 });
appointmentSchema.index(
  { requestIp: 1, createdAt: -1 },
  { partialFilterExpression: { requestIp: { $type: 'string' } } },
);
appointmentSchema.index({ 'notify.status': 1 }, { sparse: true });

export type Appointment = InferSchemaType<typeof appointmentSchema>;
export const AppointmentModel = model('Appointment', appointmentSchema);
