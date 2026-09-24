import { Schema, model } from 'mongoose';

/**
 * Editable website data: single values (settings), page sections (content), testimonials and plans.
 * Every record carries `managed` like the rest of the catalogue: seeded records are refreshed on
 * deploy until someone edits them in the admin panel, after which the sync leaves them alone.
 */

const siteSettingSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    group: { type: String, default: 'General', index: true },
    /** claim: a marketing statement that must be true before launch; image: a URL. */
    kind: { type: String, enum: ['text', 'claim', 'number', 'url', 'image'], default: 'text' },
    value: { type: String, default: '' },
    /** Where it shows on the website, for the editor. */
    note: { type: String, default: '' },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

const contentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    /** Page key, e.g. home, curxx-plus, privacy. */
    page: { type: String, required: true, index: true },
    /** Section key within the page, e.g. faqs, bands. */
    section: { type: String, required: true },
    label: { type: String, default: '' },
    title: { type: String, default: '' },
    intro: { type: String, default: '' },
    /** The section's entries; their shape depends on the section (see the admin hint). */
    items: { type: [Schema.Types.Mixed], default: [] },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);
contentSchema.index({ page: 1, order: 1 });

const testimonialSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    /** patient: homepage stories; provider: doctors on the For Providers page. */
    audience: { type: String, enum: ['patient', 'provider'], default: 'patient', index: true },
    name: { type: String, required: true },
    initials: { type: String, default: '' },
    /** Second line under the name, e.g. "Bengaluru, Karnataka" or "MD Dermatology • Bengaluru". */
    location: { type: String, default: '' },
    city: { type: String, default: '' },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    text: { type: String, required: true },
    doctorSlug: { type: String, default: '' },
    /** Result chip on provider stories, e.g. { icon: 'trending_up', label: '3.4x Booking Growth' }. */
    badge: { icon: { type: String, default: '' }, label: { type: String, default: '' } },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

const planSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    /** plus: Curxx Plus for patients; provider: software plans on For Providers. */
    audience: { type: String, enum: ['plus', 'provider'], default: 'plus', index: true },
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    /** Shown after the price: year, month or forever. */
    period: { type: String, default: 'year' },
    members: { type: String, default: '' },
    highlight: { type: Boolean, default: false },
    badge: { type: String, default: '' },
    /** One per line; wrap in **double stars** to bold a perk. */
    perks: { type: [String], default: [] },
    /** Shown crossed out as not included. */
    excluded: { type: [String], default: [] },
    ctaLabel: { type: String, default: '' },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    managed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

export const SiteSettingModel = model('SiteSetting', siteSettingSchema);
export const ContentModel = model('Content', contentSchema, 'contents');
export const TestimonialModel = model('Testimonial', testimonialSchema);
export const PlanModel = model('Plan', planSchema);
