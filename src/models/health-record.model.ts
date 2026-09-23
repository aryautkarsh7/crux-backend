import { Schema, model, type InferSchemaType } from 'mongoose';

const findingSchema = new Schema(
  { name: String, value: String, unit: String, range: String, flag: { type: String, enum: ['normal', 'high', 'low'], default: 'normal' } },
  { _id: false },
);

const recordSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['prescription', 'lab_report', 'imaging', 'discharge', 'vaccination', 'invoice'], required: true },
    title: { type: String, required: true },
    doctorName: { type: String, default: '' },
    facility: { type: String, default: '' },
    date: { type: Date, required: true },
    summary: { type: String, default: '' },
    tags: { type: [String], default: [] },
    source: { type: String, enum: ['curxx', 'upload', 'abha'], default: 'curxx' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/pdf' },
    findings: { type: [findingSchema], default: [] },
    medicines: { type: [{ name: String, dosage: String, duration: String, _id: false }], default: [] },
  },
  { timestamps: true, versionKey: false },
);

recordSchema.index({ user: 1, date: -1 });

export type HealthRecord = InferSchemaType<typeof recordSchema>;
export const HealthRecordModel = model('HealthRecord', recordSchema);
