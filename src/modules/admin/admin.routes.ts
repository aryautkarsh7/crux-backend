import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { refreshDoctorRatings } from '../../db/catalogue.js';
import { describeSchedule, type Schedule } from '../../db/data/doctor-network.js';
import { FACILITY_TYPES } from '../../db/data/facility-network.js';
import { SPECIALTY_CATEGORIES } from '../../db/data/specialties.js';
import { cities, conditions, reloadCatalogue, surgeries } from '../../lib/catalogue-store.js';
import { HttpError, badRequest, conflict, notFound, unauthorized } from '../../lib/errors.js';
import { escapeRegex } from '../../lib/http.js';
import { AppointmentModel } from '../../models/appointment.model.js';
import { CityModel, ConditionModel, SurgeryModel } from '../../models/catalogue.model.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { LabCategoryModel, LabTestModel } from '../../models/lab-test.model.js';
import { LabModel } from '../../models/lab.model.js';
import { LeadModel } from '../../models/lead.model.js';
import { MedicineCategoryModel, MedicineModel } from '../../models/medicine.model.js';
import { OrderModel } from '../../models/order.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { ContentModel, PlanModel, SiteSettingModel, TestimonialModel } from '../../models/site.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { UserModel } from '../../models/user.model.js';
import { resetSiteStats } from '../site/site.routes.js';

type Doc = Record<string, any>;

/**
 * One entry per collection the admin panel manages. Catalogue records created or edited here are
 * flagged `managed`, so the seed sync on deploy never overwrites or deletes them.
 */
type Resource = {
  model: Model<any>;
  /** URL key: the public slug for catalogue records, the Mongo id for everything else. */
  key: 'slug' | '_id';
  search: string[];
  sort: Record<string, 1 | -1>;
  /** Query-string filters the list accepts (exact match; booleans as true/false). */
  filters: string[];
  create?: boolean;
  remove?: boolean;
  /** When set, only these fields can be changed (orders, appointments, users, leads). */
  editable?: string[];
  managed?: boolean;
  /** Derives dependent fields before a create or update. */
  prepare?: (body: Doc, existing: Doc | null) => Promise<Doc>;
  after?: (doc: Doc, action: 'create' | 'update' | 'delete') => Promise<void>;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);

const DEFAULT_SCHEDULE: Schedule = { days: [1, 2, 3, 4, 5, 6], sessions: [{ start: '10:00', end: '13:30' }, { start: '17:00', end: '20:30' }], step: 30, video: 'mixed' };

async function prepareDoctor(body: Doc, existing: Doc | null) {
  const next = { ...body };
  // Clinic name, area and city follow the facility the doctor is attached to.
  const facilitySlug = next.facilitySlug ?? existing?.facilitySlug;
  if (next.facilitySlug !== undefined && facilitySlug) {
    const facility = await FacilityModel.findOne({ slug: facilitySlug }, { name: 1, area: 1, city: 1 }).lean();
    if (!facility) throw badRequest(`No hospital or clinic with slug "${facilitySlug}"`, 'unknown_facility');
    next.clinicName ??= facility.name;
    next.area ??= facility.area;
    next.city ??= facility.city;
  }
  if (!existing) {
    next.schedule ??= DEFAULT_SCHEDULE;
    next.videoFee ??= next.fee;
  }
  if (next.schedule) {
    const schedule = { ...DEFAULT_SCHEDULE, ...next.schedule } as Schedule;
    next.schedule = schedule;
    next.consultHours = describeSchedule(schedule);
    // Slots regenerate from the new schedule the next time someone views the doctor.
    next.slotsThrough = null;
  }
  return next;
}

/** First URL segments the website already uses: a city can't take one of these slugs. */
const RESERVED_CITY_SLUGS = new Set(['account', 'blog', 'book', 'cart', 'checkout', 'clinic', 'consult', 'curxx-plus', 'doctor', 'doctors', 'for-providers', 'lab', 'lab-tests', 'labs', 'login', 'medicines', 'orders', 'partner-with-us', 'privacy', 'records', 'register', 'specialties', 'surgeries', 'clinics', 'hospitals', 'teleconsultation-policy', 'terms', 'triage', 'api']);

async function prepareCity(body: Doc, existing: Doc | null) {
  const slug = existing?.slug ?? body.slug;
  if (!existing && RESERVED_CITY_SLUGS.has(slug)) throw badRequest(`"${slug}" is already a page on the website; pick another slug`, 'reserved_slug');
  if (body.aliases) {
    body.aliases = [...new Set((body.aliases as string[]).map((a) => slugify(String(a))).filter((a) => a && a !== slug))];
    const taken = cities().find((c) => c.slug !== slug && (body.aliases.includes(c.slug) || c.aliases.some((a) => body.aliases.includes(a))));
    if (taken) throw badRequest(`An alias is already used by ${taken.name}`, 'duplicate_alias');
  }
  if (body.localities) {
    if (!Array.isArray(body.localities)) throw badRequest('localities: send a list', 'invalid_record');
    body.localities = (body.localities as Doc[]).map((l) => ({ ...l, slug: slugify(String(l.slug || l.name || '')), lat: l.lat ?? body.lat ?? existing?.lat, lng: l.lng ?? body.lng ?? existing?.lng }));
    if (body.localities.some((l: Doc) => !l.slug || !l.name)) throw badRequest('localities: every locality needs a name', 'invalid_record');
  }
  return body;
}

/** Conditions and surgeries point at a specialty; make sure it exists. */
async function checkSpecialty(body: Doc) {
  if (body.specialty && !(await SpecialtyModel.exists({ slug: body.specialty }))) throw badRequest(`No specialty with slug "${body.specialty}"`, 'unknown_specialty');
  return body;
}

const RESOURCES: Record<string, Resource> = {
  doctors: {
    model: DoctorModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'clinicName', 'area', 'slug', 'registration'], sort: { updatedAt: -1 },
    filters: ['city', 'specialty', 'facilitySlug', 'gender', 'freeVideo', 'instant', 'managed', 'verified'],
    prepare: prepareDoctor,
    after: async (doc, action) => {
      if (action !== 'create') await SlotModel.deleteMany({ doctorSlug: doc.slug, status: 'open' });
    },
  },
  facilities: {
    model: FacilityModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'area', 'slug', 'address'], sort: { updatedAt: -1 },
    filters: ['city', 'type', 'category', 'emergency24x7', 'nabh', 'managed'],
    prepare: async (body, existing) => {
      if (body.category && !body.type) body.type = FACILITY_TYPES.find((t) => t.name === body.category)?.group ?? existing?.type;
      if (!existing) body.shortName ??= body.name;
      return body;
    },
  },
  labs: {
    model: LabModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'area', 'slug'], sort: { updatedAt: -1 }, filters: ['city', 'type', 'homeCollection', 'walkIn', 'managed'],
    prepare: async (body, existing) => {
      if (!existing) body.shortName ??= body.name;
      return body;
    },
  },
  'lab-tests': {
    model: LabTestModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'slug', 'covers'], sort: { popularity: -1 }, filters: ['kind', 'department', 'categories', 'homeCollection', 'managed'],
    prepare: async (body, existing) => {
      if (!existing) {
        body.fastingLabel ??= body.fastingHours ? `${body.fastingHours} hrs fasting` : 'No fasting required';
        body.testsIncluded ??= 1;
      }
      if (body.price && body.mrp) body.discount = Math.max(0, Math.round((1 - body.price / body.mrp) * 100));
      return body;
    },
  },
  'lab-categories': { model: LabCategoryModel, key: 'slug', managed: true, create: true, remove: true, search: ['name', 'slug'], sort: { order: 1 }, filters: ['group'] },
  medicines: {
    model: MedicineModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'composition', 'manufacturer', 'slug'], sort: { popularity: -1 }, filters: ['categories', 'rxRequired', 'form', 'managed'],
  },
  'medicine-categories': { model: MedicineCategoryModel, key: 'slug', managed: true, create: true, remove: true, search: ['name', 'slug'], sort: { order: 1 }, filters: ['featured'] },
  specialties: {
    model: SpecialtyModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'plural', 'slug'], sort: { name: 1 }, filters: ['category', 'popular', 'video'],
  },
  articles: {
    model: ArticleModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['title', 'excerpt', 'slug'], sort: { publishedAt: -1 }, filters: ['category', 'featured', 'condition'],
    prepare: async (body, existing) => {
      if (!existing) body.publishedAt ??= new Date();
      if (body.author?.slug) {
        const doctor = await DoctorModel.findOne({ slug: body.author.slug }, { name: 1, title: 1 }).lean();
        if (!doctor) throw badRequest(`No doctor with slug "${body.author.slug}"`, 'unknown_doctor');
        body.author = { slug: body.author.slug, name: doctor.name, title: doctor.title };
      }
      return body;
    },
  },
  reviews: {
    model: ReviewModel, key: '_id', managed: true, create: true, remove: true,
    search: ['author', 'text', 'doctorSlug'], sort: { createdAt: -1 }, filters: ['doctorSlug', 'rating', 'mode', 'verified'],
    after: async (doc) => {
      await refreshDoctorRatings([doc.doctorSlug]);
    },
  },
  cities: {
    model: CityModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'state', 'slug', 'aliases'], sort: { order: 1, name: 1 }, filters: ['tier', 'managed'],
    prepare: prepareCity,
  },
  conditions: {
    model: ConditionModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'slug', 'summary'], sort: { order: 1, name: 1 }, filters: ['specialty', 'managed'],
    prepare: checkSpecialty,
  },
  surgeries: {
    model: SurgeryModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'slug', 'description'], sort: { order: 1, name: 1 }, filters: ['category', 'specialty', 'popular', 'managed'],
    prepare: checkSpecialty,
  },
  'site-settings': {
    model: SiteSettingModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['label', 'slug', 'value', 'note'], sort: { group: 1, slug: 1 }, filters: ['group', 'kind'],
  },
  content: {
    model: ContentModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['label', 'slug', 'title', 'page'], sort: { page: 1, order: 1 }, filters: ['page', 'published'],
    prepare: async (body) => {
      if (body.items !== undefined && !Array.isArray(body.items)) throw badRequest('items: send a list', 'invalid_record');
      return body;
    },
  },
  testimonials: {
    model: TestimonialModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'text', 'location'], sort: { audience: 1, order: 1 }, filters: ['audience', 'published'],
    prepare: async (body, existing) => {
      const name = body.name ?? existing?.name;
      if (!existing && !body.initials && name) body.initials = String(name).replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      return body;
    },
  },
  plans: {
    model: PlanModel, key: 'slug', managed: true, create: true, remove: true,
    search: ['name', 'slug', 'tagline'], sort: { audience: 1, order: 1 }, filters: ['audience', 'published'],
  },
  leads: {
    model: LeadModel, key: '_id', remove: true, editable: ['status', 'note'],
    search: ['name', 'phone', 'email', 'organisation', 'message'], sort: { createdAt: -1 }, filters: ['kind', 'status', 'city'],
  },
  appointments: {
    model: AppointmentModel, key: '_id', editable: ['status', 'notes'],
    search: ['reference', 'doctorSlug', 'patient.name', 'patient.phone'], sort: { startsAt: -1 }, filters: ['status', 'mode', 'doctorSlug'],
    after: async (doc) => {
      // A cancelled appointment gives its slot back.
      if (doc.status === 'cancelled') await SlotModel.updateOne({ _id: doc.slot, status: 'booked' }, { status: 'open' });
    },
  },
  orders: {
    model: OrderModel, key: '_id', editable: ['status', 'payment'],
    search: ['reference', 'patient.name', 'patient.phone', 'items.name'], sort: { createdAt: -1 }, filters: ['kind', 'status', 'collectionMode'],
  },
  users: {
    model: UserModel, key: '_id', editable: ['name', 'email', 'gender', 'bloodGroup'],
    search: ['name', 'phone', 'email'], sort: { createdAt: -1 }, filters: ['gender'],
  },
};

/** Strips anything that could be a Mongo operator or overwrite bookkeeping fields. */
function clean(body: unknown): Doc {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Send the record as a JSON object');
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.fromEntries(Object.entries(value as Doc).filter(([k]) => !k.startsWith('$') && !k.includes('.')).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  const out = walk(body) as Doc;
  for (const k of ['_id', 'id', 'createdAt', 'updatedAt', 'managed', 'helpfulBy']) delete out[k];
  return out;
}

/** Mongoose validation and duplicate-key errors become readable 400/409s. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const e = error as { name?: string; code?: number; keyValue?: Doc; errors?: Record<string, { message: string; path: string }>; message?: string };
    if (e.code === 11000) throw conflict(`A record with ${Object.entries(e.keyValue ?? {}).map(([k, v]) => `${k} "${v}"`).join(', ')} already exists`, 'duplicate');
    if (e.name === 'ValidationError' && e.errors) {
      const first = Object.values(e.errors)[0]!;
      throw new HttpError(400, `${first.path}: ${first.message.replace(/^Path `[^`]+` /, '')}`, 'invalid_record');
    }
    if (e.name === 'CastError') throw badRequest(e.message ?? 'A field has the wrong type', 'invalid_record');
    throw error;
  }
}

/** Routes serve cities, conditions and surgeries from memory, and site stats are cached: refresh both. */
async function afterWrite(resource: string) {
  resetSiteStats();
  if (['cities', 'conditions', 'surgeries', 'content'].includes(resource)) await reloadCatalogue();
}

const toClient = ({ _id, ...doc }: Doc) => ({ id: String(_id), ...doc });

function lookupFilter(resource: Resource, key: string) {
  if (resource.key === 'slug') return { slug: key };
  if (!Types.ObjectId.isValid(key)) throw notFound('Record not found');
  return { _id: key };
}

const sha = (s: string) => createHash('sha256').update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

/** preHandler: only admin tokens get through. */
async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized('Sign in to the admin panel');
  }
  if (request.user.role !== 'admin') throw new HttpError(403, 'Admin access only', 'forbidden');
}

export async function adminRoutes(app: FastifyInstance) {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request) => {
    const { email, password } = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(request.body);
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new HttpError(503, `Admin sign-in is not configured: ${env.adminProblem}`, 'admin_disabled');
    // Compare both, always, so timing doesn't reveal which one was wrong.
    const ok = same(email, env.ADMIN_EMAIL.toLowerCase()) && same(password, env.ADMIN_PASSWORD);
    if (!ok) throw unauthorized('Wrong email or password');
    const token = await app.jwt.sign({ sub: 'admin', phone: '', role: 'admin' }, { expiresIn: '12h' });
    return { token, admin: { email: env.ADMIN_EMAIL } };
  });

  app.register(async (secured) => {
    secured.addHook('preHandler', requireAdmin);
    secured.addHook('onSend', async (_request, reply) => {
      reply.header('cache-control', 'no-store');
    });

    secured.get('/me', async () => ({ admin: { email: env.ADMIN_EMAIL } }));

    /** Dropdown data for the forms. */
    secured.get('/meta', async () => {
      const [specialties, facilities, labCategories, medicineCategories, articleCategories] = await Promise.all([
        SpecialtyModel.find({}, { slug: 1, name: 1, subSpecialties: 1 }).sort({ name: 1 }).lean(),
        FacilityModel.find({}, { slug: 1, name: 1, city: 1, area: 1 }).sort({ city: 1, name: 1 }).lean(),
        LabCategoryModel.find({}, { slug: 1, name: 1 }).sort({ order: 1 }).lean(),
        MedicineCategoryModel.find({}, { slug: 1, name: 1 }).sort({ order: 1 }).lean(),
        ArticleModel.distinct('category'),
      ]);
      return {
        cities: cities().map((c) => ({ slug: c.slug, name: c.name, localities: c.localities.map((l) => l.name) })),
        specialties: specialties.map((s) => ({ slug: s.slug, name: s.name, focusAreas: s.subSpecialties.map((f: Doc) => ({ slug: f.slug, name: f.name })) })),
        specialtyCategories: SPECIALTY_CATEGORIES,
        facilityTypes: FACILITY_TYPES,
        facilities: facilities.map((f) => ({ slug: f.slug, name: f.name, city: f.city, area: f.area })),
        labCategories: labCategories.map((c) => ({ slug: c.slug, name: c.name })),
        medicineCategories: medicineCategories.map((c) => ({ slug: c.slug, name: c.name })),
        articleCategories,
        surgeries: surgeries().map((s) => ({ slug: s.slug, name: s.name, category: s.category, specialty: s.specialty, cost: s.cost })),
        surgeryCategories: [...new Set(surgeries().map((s) => s.category))],
        conditions: conditions().map((c) => ({ slug: c.slug, name: c.name, specialty: c.specialty })),
        contentPages: await ContentModel.distinct('page'),
        settingGroups: await SiteSettingModel.distinct('group'),
      };
    });

    secured.get('/stats', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 86_400_000);
      const counts = Object.fromEntries(
        await Promise.all(Object.entries(RESOURCES).map(async ([name, r]) => [name, await r.model.estimatedDocumentCount()] as const)),
      );
      const [appointmentsToday, newLeads, managed, recentAppointments, recentLeads, recentOrders, ordersByStatus] = await Promise.all([
        AppointmentModel.countDocuments({ startsAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'cancelled' } }),
        LeadModel.countDocuments({ status: 'new' }),
        DoctorModel.countDocuments({ managed: true }),
        AppointmentModel.find({}, { reference: 1, doctorSlug: 1, startsAt: 1, mode: 1, status: 1, amount: 1, 'patient.name': 1 }).sort({ createdAt: -1 }).limit(8).lean(),
        LeadModel.find({}, 'kind name phone email city status surgery createdAt').sort({ createdAt: -1 }).limit(8).lean(),
        OrderModel.find({}, { reference: 1, kind: 1, total: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(8).lean(),
        OrderModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);
      return {
        counts,
        appointmentsToday,
        newLeads,
        adminDoctors: managed,
        ordersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o._id, o.count])),
        recentAppointments: recentAppointments.map(toClient),
        recentLeads: recentLeads.map(toClient),
        recentOrders: recentOrders.map(toClient),
      };
    });

    const resourceOf = (name: string) => {
      const r = RESOURCES[name];
      if (!r) throw notFound(`Unknown section "${name}"`);
      return r;
    };

    secured.get('/:resource', async (request) => {
      const { resource: name } = z.object({ resource: z.string() }).parse(request.params);
      const r = resourceOf(name);
      const query = request.query as Record<string, string | undefined>;
      const { q, page, limit, sort } = z
        .object({
          q: z.string().trim().max(100).optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          sort: z.string().regex(/^-?[a-zA-Z.]+$/).optional(),
        })
        .parse(query);
      const filter: Doc = {};
      for (const f of r.filters) {
        const v = query[f];
        if (v === undefined || v === '') continue;
        filter[f] = v === 'true' ? true : v === 'false' ? { $ne: true } : f === 'rating' || f === 'tier' ? Number(v) : v;
      }
      if (q) {
        const re = new RegExp(escapeRegex(q), 'i');
        filter.$or = [...r.search.map((field) => ({ [field]: re })), ...(Types.ObjectId.isValid(q) ? [{ _id: q }] : [])];
      }
      const order = sort ? { [sort.replace(/^-/, '')]: sort.startsWith('-') ? -1 : 1 } : r.sort;
      const [items, total] = await Promise.all([
        r.model.find(filter).sort({ ...order, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        r.model.countDocuments(filter),
      ]);
      return { items: (items as Doc[]).map(toClient), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
    });

    secured.get('/:resource/:key', async (request) => {
      const { resource: name, key } = z.object({ resource: z.string(), key: z.string() }).parse(request.params);
      const r = resourceOf(name);
      const doc = await r.model.findOne(lookupFilter(r, key)).lean();
      if (!doc) throw notFound('Record not found');
      return { item: toClient(doc as Doc) };
    });

    secured.post('/:resource', async (request, reply) => {
      const { resource: name } = z.object({ resource: z.string() }).parse(request.params);
      const r = resourceOf(name);
      if (!r.create) throw badRequest(`New ${name} can't be added from the admin panel`, 'read_only');
      let body = clean(request.body);
      if (r.key === 'slug') {
        body.slug = slugify(String(body.slug || body.name || body.title || body.label || ''));
        if (!body.slug) throw badRequest('Give the record a name (or slug)', 'invalid_record');
      }
      if (r.prepare) body = await r.prepare(body, null);
      if (r.managed) body.managed = true;
      const doc = await write(() => r.model.create(body));
      const plain = (doc as { toObject: () => Doc }).toObject();
      await r.after?.(plain, 'create');
      await afterWrite(name);
      reply.code(201);
      return { item: toClient(plain) };
    });

    secured.patch('/:resource/:key', async (request) => {
      const { resource: name, key } = z.object({ resource: z.string(), key: z.string() }).parse(request.params);
      const r = resourceOf(name);
      const existing = await r.model.findOne(lookupFilter(r, key)).lean<Doc>();
      if (!existing) throw notFound('Record not found');
      let body = clean(request.body);
      if (r.editable) body = Object.fromEntries(Object.entries(body).filter(([k]) => r.editable!.includes(k)));
      if (r.key === 'slug') delete body.slug; // the slug is the public URL; renaming would break links
      if (r.prepare) body = await r.prepare(body, existing);
      if (r.managed) body.managed = true;
      const doc = await write(() => r.model.findOneAndUpdate({ _id: existing._id }, { $set: body }, { new: true, runValidators: true }).lean<Doc>());
      await r.after?.(doc!, 'update');
      await afterWrite(name);
      return { item: toClient(doc!) };
    });

    secured.delete('/:resource/:key', async (request) => {
      const { resource: name, key } = z.object({ resource: z.string(), key: z.string() }).parse(request.params);
      const r = resourceOf(name);
      if (!r.remove) throw badRequest(`${name} can't be deleted from the admin panel`, 'read_only');
      const doc = await r.model.findOneAndDelete(lookupFilter(r, key)).lean<Doc>();
      if (!doc) throw notFound('Record not found');
      await r.after?.(doc, 'delete');
      await afterWrite(name);
      return { ok: true };
    });
  });
}
