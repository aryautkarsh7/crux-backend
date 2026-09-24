import { Schema, model, type InferSchemaType } from 'mongoose';

const parameterGroupSchema = new Schema(
  { name: String, icon: String, count: Number, parameters: [String] },
  { _id: false },
);

const labTestSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['package', 'test', 'scan', 'procedure'], required: true, index: true },
    /** False for scans and procedures that need a visit to a centre. */
    homeCollection: { type: Boolean, default: true },
    department: { type: String, default: '', index: true },
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
    /** Created or edited in the admin panel: the catalogue sync never overwrites or deletes it. */
    managed: { type: Boolean, default: false, index: true },
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
    /** "concern" (Diabetes, Thyroid…) or "department" (Radiology, Microbiology…). */
    group: { type: String, enum: ['concern', 'department'], default: 'concern' },
    /** Created or edited in the admin panel: the catalogue sync never overwrites or deletes it. */
    managed: { type: Boolean, default: false, index: true },
  },
  { versionKey: false },
);

export const LabCategoryModel = model('LabCategory', labCategorySchema);
