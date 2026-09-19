import { Schema, model, type InferSchemaType } from 'mongoose';

const otpSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

// Challenges clean themselves up once they expire.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpChallenge = InferSchemaType<typeof otpSchema>;
export const OtpModel = model('OtpChallenge', otpSchema);
