import { Schema, model, type InferSchemaType } from 'mongoose';

/** Consent given by a patient for someone to read their records (ABDM-style). */
const accessGrantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    grantee: {
      name: { type: String, required: true },
      kind: { type: String, enum: ['doctor', 'hospital', 'family', 'insurer'], required: true },
      detail: { type: String, default: '' },
    },
    scope: { type: String, enum: ['all', 'prescriptions', 'lab_reports', 'selected'], default: 'all' },
    permission: { type: String, enum: ['view', 'download'], default: 'view' },
    records: [{ type: Schema.Types.ObjectId, ref: 'HealthRecord' }],
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    lastAccessedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export type AccessGrant = InferSchemaType<typeof accessGrantSchema>;
export const AccessGrantModel = model('AccessGrant', accessGrantSchema);
