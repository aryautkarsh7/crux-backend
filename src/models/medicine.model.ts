import { Schema, model, type InferSchemaType } from 'mongoose';

const medicineSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subtitle: { type: String, required: true },
    manufacturer: { type: String, required: true },
    composition: { type: String, required: true },
    form: { type: String, required: true },
    packSize: { type: String, required: true },
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
    categories: { type: [String], default: [], index: true },
    rxRequired: { type: Boolean, default: false },
    stock: { type: Number, default: 100 },
    icon: { type: String, default: 'pill' },
    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    uses: { type: [String], default: [] },
    sideEffects: { type: [String], default: [] },
    howToUse: { type: String, default: '' },
    safetyAdvice: { type: [String], default: [] },
    storage: { type: String, default: 'Store below 30°C, away from direct sunlight.' },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

medicineSchema.index({ name: 'text', composition: 'text', subtitle: 'text', manufacturer: 'text' });

export type Medicine = InferSchemaType<typeof medicineSchema>;
export const MedicineModel = model('Medicine', medicineSchema);

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, default: 'medication' },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const MedicineCategoryModel = model('MedicineCategory', categorySchema);
