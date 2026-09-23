import { Schema, model, type InferSchemaType } from 'mongoose';

const itemSchema = new Schema(
  { slug: String, name: String, price: Number, mrp: Number, qty: Number, rxRequired: Boolean },
  { _id: false },
);

const addressSchema = new Schema(
  { label: String, line1: String, line2: String, area: String, city: String, pincode: String, phone: String },
  { _id: false },
);

/** Pharmacy orders and home lab-collection bookings share one ledger. */
const orderSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['pharmacy', 'lab'], required: true },
    items: { type: [itemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'sample_scheduled', 'sample_collected', 'report_ready', 'cancelled'],
      default: 'placed',
    },
    /** Required for deliveries and home collection; walk-in lab visits have none. */
    address: { type: addressSchema },
    /** Lab orders: a phlebotomist visits the address, or the patient walks in to the lab. */
    collectionMode: { type: String, enum: ['home', 'lab'] },
    lab: { slug: String, name: String, area: String, address: String, phone: String, lat: Number, lng: Number, pathologist: String },
    patient: { name: String, age: Number, gender: String, phone: String },
    pickup: { date: Date, window: String },
    prescription: { type: Schema.Types.ObjectId, ref: 'HealthRecord' },
    /** Lab report filed to the health locker once results are out. */
    reportRecord: { type: Schema.Types.ObjectId, ref: 'HealthRecord' },
    payment: { method: { type: String, default: 'upi' }, status: { type: String, default: 'paid' } },
    etaAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ user: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export const OrderModel = model('Order', orderSchema);
