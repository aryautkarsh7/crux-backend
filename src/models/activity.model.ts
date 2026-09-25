import { Schema, model } from 'mongoose';

/**
 * What people do on the website that the team follows up on: Call / WhatsApp taps, sign-ins,
 * and "wrong information" reports on profiles.
 */

const targetFields = {
  targetType: { type: String, enum: ['doctor', 'facility', 'lab', 'lab-test', 'medicine', 'site'], required: true, index: true },
  targetSlug: { type: String, default: '', index: true },
  targetName: { type: String, default: '' },
  city: { type: String, default: '', index: true },
};

const interactionSchema = new Schema(
  {
    kind: { type: String, enum: ['call', 'whatsapp'], required: true, index: true },
    ...targetFields,
    /** The number the button opened. */
    number: { type: String, default: '' },
    page: { type: String, default: '' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userPhone: { type: String, default: '' },
    device: { type: String, enum: ['mobile', 'desktop'], default: 'desktop' },
  },
  { timestamps: true, versionKey: false },
);
interactionSchema.index({ createdAt: -1 });

const loginEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true, index: true },
    name: { type: String, default: '' },
    /** First sign-in (account created) or a returning login. */
    firstLogin: { type: Boolean, default: false },
    intent: { type: String, default: 'any' },
    device: { type: String, enum: ['mobile', 'desktop'], default: 'desktop' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);
loginEventSchema.index({ createdAt: -1 });

const reportSchema = new Schema(
  {
    ...targetFields,
    issues: { type: [String], default: [] },
    details: { type: String, default: '' },
    contact: { type: String, default: '' },
    page: { type: String, default: '' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['new', 'reviewing', 'fixed', 'rejected'], default: 'new', index: true },
    note: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
);
reportSchema.index({ createdAt: -1 });

/** Reels and videos shown on doctor profiles and the homepage. */
const videoSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ['reel', 'video'], default: 'video' },
    /** YouTube / YouTube Shorts / Instagram reel / direct .mp4 link. */
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    doctorSlug: { type: String, default: '', index: true },
    specialty: { type: String, default: '', index: true },
    city: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    managed: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const InteractionModel = model('Interaction', interactionSchema);
export const LoginEventModel = model('LoginEvent', loginEventSchema);
export const ReportModel = model('Report', reportSchema);
export const VideoModel = model('Video', videoSchema);
