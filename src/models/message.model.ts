import { Schema, model, type InferSchemaType } from 'mongoose';

/** Consultation chat between patient and doctor, attached to an appointment. */
const messageSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    from: { type: String, enum: ['patient', 'doctor', 'system'], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    attachment: { name: String, size: Number, _id: false },
  },
  { timestamps: true, versionKey: false },
);

export type Message = InferSchemaType<typeof messageSchema>;
export const MessageModel = model('Message', messageSchema);
