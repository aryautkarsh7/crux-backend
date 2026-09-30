import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One outgoing message (per appointment, event and channel). The unique index is what guarantees a
 * notification is never sent twice, even if the sender runs again or twice at once.
 */
const notificationSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    event: { type: String, required: true },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    mode: { type: String, enum: ['log', 'test', 'live'], required: true },
    /** Where it actually went (the test inbox in test mode). */
    to: { type: String, default: '' },
    /** The doctor / facility contact it was meant for. */
    intendedFor: { type: String, default: '' },
    status: {
      type: String,
      enum: ['sending', 'sent', 'logged', 'skipped', 'failed'],
      default: 'sending',
    },
    provider: { type: String, default: '' },
    providerId: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ appointment: 1, event: 1, channel: 1 }, { unique: true });

export type Notification = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = model('Notification', notificationSchema);
