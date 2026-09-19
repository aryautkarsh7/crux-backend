import { Schema, model, type InferSchemaType } from 'mongoose';

const appointmentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorSlug: { type: String, required: true },
    slot: { type: Schema.Types.ObjectId, ref: 'Slot', required: true, unique: true },
    startsAt: { type: Date, required: true },
    mode: { type: String, enum: ['clinic', 'video'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed', index: true },
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
