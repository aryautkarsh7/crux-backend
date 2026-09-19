import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    abhaId: { type: String, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
