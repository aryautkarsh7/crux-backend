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
    status: { type: String, enum: ['confirmed', 'completed', 'cancelled'], default: 'confirmed', index: true },
    focus: { type: String, default: '' },
    notes: { type: String, default: '' },
    patient: {
      name: { type: String, required: true },
      age: { type: Number },
      gender: { type: String, enum: ['female', 'male', 'other'] },
      phone: { type: String, required: true },
    },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ user: 1, startsAt: -1 });

export type Appointment = InferSchemaType<typeof appointmentSchema>;
export const AppointmentModel = model('Appointment', appointmentSchema);
