import { Schema, model, type InferSchemaType } from 'mongoose';

const addressSchema = new Schema(
  {
    label: { type: String, default: 'Home' },
    name: { type: String, default: '' },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    area: { type: String, default: '' },
    city: { type: String, default: 'Bengaluru' },
    pincode: { type: String, required: true },
    phone: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: false },
);

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    gender: { type: String, enum: ['female', 'male', 'other', ''], default: '' },
    dob: { type: Date },
    bloodGroup: { type: String, default: '' },
    abhaId: { type: String, default: '' },
    addresses: { type: [addressSchema], default: [] },
    savedDoctors: { type: [String], default: [] },
    savedArticles: { type: [String], default: [] },
    /** Set once the per-user demo health locker has been created. */
    demoSeededAt: { type: Date },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
