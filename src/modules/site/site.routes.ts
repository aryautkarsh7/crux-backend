import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FACILITY_TYPES } from '../../db/data/facility-network.js';
import { SPECIALTY_ALIASES, SPECIALTY_CATEGORIES } from '../../db/data/specialties.js';
import { cities, conditions, surgeries, surgeryCategories } from '../../lib/catalogue-store.js';
import { CATALOGUE_CACHE } from '../../lib/http.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { LabModel } from '../../models/lab.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { ContentModel, PlanModel, SiteSettingModel, TestimonialModel } from '../../models/site.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';

const STATS_TTL_MS = 5 * 60 * 1000;
let statsCache: { at: number; value: Awaited<ReturnType<typeof computeStats>> } | null = null;

/** Every number the website shows about itself, counted from the database. */
async function computeStats() {
  const [doctors, verifiedDoctors, instantDoctors, facilities, hospitals, accreditedFacilities, emergencyFacilities, labs, labTests, specialties, reviews] = await Promise.all([
    DoctorModel.countDocuments(),
    DoctorModel.countDocuments({ verified: true }),
    DoctorModel.countDocuments({ instant: true }),
    FacilityModel.countDocuments(),
    FacilityModel.countDocuments({ type: 'hospital' }),
    FacilityModel.countDocuments({ nabh: true }),
    FacilityModel.countDocuments({ emergency24x7: true }),
    LabModel.countDocuments(),
    LabTestModel.countDocuments(),
    SpecialtyModel.countDocuments(),
    ReviewModel.aggregate<{ total: number; average: number }>([{ $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$rating' } } }]),
  ]);
  return {
    doctors,
    verifiedDoctors,
    instantDoctors,
    facilities,
    hospitals,
    clinics: facilities - hospitals,
    accreditedFacilities,
    emergencyFacilities,
    labs,
    labTests,
    specialties,
    cities: cities().length,
    conditions: conditions().length,
    surgeries: surgeries().length,
    reviews: reviews[0]?.total ?? 0,
    averageRating: reviews[0] ? Math.round(reviews[0].average * 10) / 10 : null,
  };
}

const published = { published: { $ne: false } };
const strip = <T extends Record<string, unknown>>({ _id: _i, managed: _m, createdAt: _c, updatedAt: _u, published: _p, ...rest }: T) => rest;

export async function siteRoutes(app: FastifyInstance) {
  /** Editable single values: claims, links, images. */
  app.get('/site/settings', async (_request, reply) => {
    const settings = await SiteSettingModel.find({}, { slug: 1, value: 1 }).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return { settings: Object.fromEntries(settings.map((s) => [s.slug, s.value])) };
  });

  app.get('/site/stats', async (_request, reply) => {
    if (!statsCache || Date.now() - statsCache.at > STATS_TTL_MS) statsCache = { at: Date.now(), value: await computeStats() };
    reply.header('cache-control', CATALOGUE_CACHE);
    return { stats: statsCache.value };
  });

  /** Page sections by page key; several pages at once with a comma, e.g. /content/home,shared. */
  app.get('/content/:pages', async (request, reply) => {
    const { pages } = z.object({ pages: z.string().regex(/^[a-z0-9-]+(,[a-z0-9-]+){0,5}$/, 'Unknown page') }).parse(request.params);
    const docs = await ContentModel.find({ page: { $in: pages.split(',') }, ...published }).sort({ order: 1 }).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return { sections: Object.fromEntries(docs.map((d) => [`${d.page}/${d.section}`, { title: d.title, intro: d.intro, items: d.items }])) };
  });

  app.get('/testimonials', async (request, reply) => {
    const { audience } = z.object({ audience: z.enum(['patient', 'provider']).default('patient') }).parse(request.query);
    const items = await TestimonialModel.find({ audience, ...published }).sort({ order: 1, createdAt: 1 }).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return { testimonials: items.map((t) => strip(t)) };
  });

  app.get('/plans', async (request, reply) => {
    const { audience } = z.object({ audience: z.enum(['plus', 'provider']).default('plus') }).parse(request.query);
    const items = await PlanModel.find({ audience, ...published }).sort({ order: 1, price: 1 }).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return { plans: items.map((p) => strip(p)) };
  });

  /**
   * Everything the website needs to route URLs and build menus: cities with localities and aliases,
   * specialties, conditions, surgeries and facility types. The website keeps a generated snapshot of
   * this and checks here for slugs added since (new cities, conditions or specialties).
   */
  app.get('/catalogue/routing', async (_request, reply) => {
    const specialties = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, icon: 1, category: 1, fromPrice: 1, videoFrom: 1, video: 1, popular: 1, description: 1, homeOrder: 1, order: 1 })
      .sort({ order: 1, name: 1 })
      .lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      cities: cities().map((c) => ({ slug: c.slug, name: c.name, state: c.state, tier: c.tier, lat: c.lat, lng: c.lng, aliases: c.aliases, popularOrder: c.popularOrder ?? 0, localities: c.localities.map((l) => ({ slug: l.slug, name: l.name, pincode: l.pincode })) })),
      specialtyCategories: [...new Set([...SPECIALTY_CATEGORIES, ...specialties.map((s) => s.category)])],
      specialties: specialties.map((s) => ({ slug: s.slug, name: s.name, plural: s.plural, icon: s.icon, category: s.category, fromPrice: s.fromPrice, videoFrom: s.videoFrom, video: s.video !== false, popular: Boolean(s.popular), description: s.description, homeOrder: s.homeOrder ?? 0 })),
      specialtyAliases: SPECIALTY_ALIASES,
      conditions: conditions().map((c) => ({ slug: c.slug, name: c.name, specialty: c.specialty, popular: c.popular || null, popularOrder: c.popularOrder ?? 0 })),
      surgeryCategories: surgeryCategories(),
      surgeries: surgeries().map((s) => ({ slug: s.slug, name: s.name, category: s.category, icon: s.icon, popular: Boolean(s.popular) })),
      facilityTypes: FACILITY_TYPES,
    };
  });
}

/** Admin edits change the counts: let the next request recompute them. */
export const resetSiteStats = () => {
  statsCache = null;
};
