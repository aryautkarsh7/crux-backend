import { Schema, model, type InferSchemaType } from 'mongoose';

const parameterGroupSchema = new Schema(
  { name: String, icon: String, count: Number, parameters: [String] },
  { _id: false },
);

const labTestSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['package', 'test'], required: true, index: true },
    testsIncluded: { type: Number, required: true },
    fastingHours: { type: String, default: null },
    fastingLabel: { type: String, required: true },
    covers: { type: String, default: '' },
    highlights: { type: [String], default: [] },
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    turnaround: { type: String, default: '' },
    reportTime: { type: String, default: '24 hours' },
    sampleType: { type: String, default: 'Blood' },
    categories: { type: [String], default: [], index: true },
    parameterGroups: { type: [parameterGroupSchema], default: [] },
    popularity: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

labTestSchema.index({ name: 'text', covers: 'text' });

export type LabTest = InferSchemaType<typeof labTestSchema>;
export const LabTestModel = model('LabTest', labTestSchema);

const labCategorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, default: 'labs' },
    order: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const LabCategoryModel = model('LabCategory', labCategorySchema);
