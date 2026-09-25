import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SPECIALTY_ALIASES, SPECIALTY_CATEGORIES } from '../../db/data/specialties.js';
import { cities as allCities, cityBySlug, conditions as allConditions, resolveCitySlug } from '../../lib/catalogue-store.js';
import { notFound } from '../../lib/errors.js';
import { escapeRegex } from '../../lib/http.js';
import { ensureSlots } from '../../lib/slot-gen.js';
import { bookableSlot } from '../../lib/slots.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { specialtyContent } from './specialty-content.js';

const listQuery = z.object({
  city: z.string().default('bangalore'),
  specialty: z.string().optional(),
  focus: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  mode: z.enum(['clinic', 'video']).optional(),
  area: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  availability: z.enum(['now', 'today', 'tomorrow', 'next-7-days']).optional(),
  free: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  maxFee: z.coerce.number().positive().optional(),
  minExperience: z.coerce.number().min(0).optional(),
  sort: z.enum(['relevance', 'fee_asc', 'fee_desc', 'experience', 'rating', 'soonest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const SORTS: Record<string, Record<string, 1 | -1>> = {
  // Admin ranking (rankScore) first, then quality signals.
  relevance: { rankScore: -1, recommendPercent: -1, rating: -1, reviewCount: -1 },
  fee_asc: { fee: 1 },
  fee_desc: { fee: -1 },
  experience: { experienceYears: -1 },
  rating: { rating: -1, reviewCount: -1 },
  soonest: { recommendPercent: -1 },
};

// Catalogue data is public and changes rarely: let the CDN and browser cache it.
const CATALOGUE_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const SLOT_FIELDS = 'slug fee videoFee schedule freeVideo instant slotsThrough';

/** Start/end of the requested availability window, defaulting to the next 7 days. */
export function availabilityWindow(availability?: 'now' | 'today' | 'tomorrow' | 'next-7-days') {
  const now = new Date();
  const endOfDay = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offsetDays);
    d.setHours(23, 59, 59, 999);
    return d;
  };
  // "Consult now": a video slot starting within the hour.
  if (availability === 'now') return { $gte: now, $lte: new Date(now.getTime() + 60 * 60 * 1000) };
  if (availability === 'today') return { $gte: now, $lte: endOfDay(0) };
  if (availability === 'tomorrow') {
    const start = new Date(now);
    start.setDate(now.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: endOfDay(1) };
  }
  return { $gte: now, $lte: endOfDay(7) };
}

export const resolveSpecialtySlug = (slug?: string) => (slug ? SPECIALTY_ALIASES[slug] ?? slug : slug);

const dto = ({ _id, createdAt: _c, updatedAt: _u, schedule, slotsThrough: _t, ...d }: Record<string, any>) => ({ id: String(_id), ...d, offersVideo: schedule?.video !== 'none' });

export async function doctorRoutes(app: FastifyInstance) {
  // ---- Cities ----
  app.get('/cities', async (_request, reply) => {
    const counts = await DoctorModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$city', count: { $sum: 1 } } }]);
    const byCity = new Map(counts.map((c) => [c._id, c.count]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      cities: allCities().map((c) => ({ slug: c.slug, name: c.name, state: c.state, tier: c.tier, doctorCount: byCity.get(c.slug) ?? 0, localities: c.localities.map((l) => ({ slug: l.slug, name: l.name, pincode: l.pincode })) })),
    };
  });

  app.get('/cities/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const canonical = resolveCitySlug(slug);
    const city = canonical ? cityBySlug(canonical) : undefined;
    if (!city) throw notFound('We don’t serve this city yet');
    const [areas, facilities] = await Promise.all([
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: { city: city.slug } }, { $group: { _id: '$area', count: { $sum: 1 } } }]),
      FacilityModel.countDocuments({ city: city.slug }),
    ]);
    const byArea = new Map(areas.map((a) => [a._id, a.count]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      city: { slug: city.slug, name: city.name, state: city.state, council: city.council, facilityCount: facilities },
      localities: city.localities.map((l) => ({ ...l, doctorCount: byArea.get(l.name) ?? 0 })),
    };
  });

  // ---- Specialties ----
  app.get('/specialties', async (request, reply) => {
    const { city: rawCity, mode } = z
      .object({ city: z.string().default('bangalore'), mode: z.enum(['clinic', 'video']).optional() })
      .parse(request.query);
    const everywhere = rawCity === 'all' || rawCity === 'india';
    const city = resolveCitySlug(rawCity) ?? 'bangalore';

    const [specialties, counts] = await Promise.all([
      SpecialtyModel.find().sort({ name: 1 }).lean(),
      DoctorModel.aggregate<{ _id: string; count: number; video: number }>([
        { $match: everywhere ? {} : { city } },
        { $group: { _id: '$specialty', count: { $sum: 1 }, video: { $sum: { $cond: [{ $ne: ['$schedule.video', 'none'] }, 1, 0] } } } },
      ]),
    ]);
    const bySpecialty = new Map(counts.map((c) => [c._id, c]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      categories: [...new Set([...SPECIALTY_CATEGORIES, ...specialties.map((s) => s.category)])],
      specialties: specialties.map(({ _id, createdAt: _c, updatedAt: _u, keywords: _k, ...s }) => ({
        ...s,
        doctorCount: bySpecialty.get(s.slug)?.count ?? 0,
        // With a mode, how many of its doctors offer that kind of consult — every schedule has slots this week.
        availableDoctors: mode === 'video' ? bySpecialty.get(s.slug)?.video ?? 0 : bySpecialty.get(s.slug)?.count ?? 0,
      })),
    };
  });

  /** SEO content for a specialty listing: about, conditions, FAQs, related links — specific to specialty, city and locality. */
  app.get('/specialties/:slug', async (request, reply) => {
    const { slug: raw } = z.object({ slug: z.string() }).parse(request.params);
    const { city: rawCity, area } = z.object({ city: z.string().default('bangalore'), area: z.string().optional() }).parse(request.query);
    const slug = resolveSpecialtySlug(raw)!;
    const city = cityBySlug(resolveCitySlug(rawCity) ?? '');
    if (!city) throw notFound('We don’t serve this city yet');
    const specialty = await SpecialtyModel.findOne({ slug }).lean();
    if (!specialty) throw notFound('Specialty not found');
    const content = await specialtyContent(specialty, city, area);
    reply.header('cache-control', CATALOGUE_CACHE);
    return content;
  });

  // ---- Doctors ----
  app.get('/doctors', async (request, reply) => {
    const query = listQuery.parse(request.query);
    const { focus, q, mode, area, language, availability, free, maxFee, minExperience, sort, page, limit } = query;
    // Video consults work from anywhere: city=all searches every city.
    const everywhere = query.city === 'all' || query.city === 'india';
    const city = everywhere ? 'all' : resolveCitySlug(query.city) ?? query.city;
    const specialty = resolveSpecialtySlug(query.specialty);
    const daysNeeded = availability === 'now' || availability === 'today' ? 1 : availability === 'tomorrow' ? 2 : undefined;

    const filter: Record<string, unknown> = everywhere ? {} : { city };
    if (specialty && specialty !== 'doctors') filter.specialty = specialty;
    if (focus) filter.focusAreas = focus;
    if (maxFee) filter.fee = { $lte: maxFee };
    if (minExperience) filter.experienceYears = { $gte: minExperience };
    if (area) filter.area = new RegExp(`^${escapeRegex(area)}$`, 'i');
    if (language) filter.languages = language;
    if (free) filter.freeVideo = true;
    if (mode === 'video' || availability === 'now') filter['schedule.video'] = { $ne: 'none' };
    let matchedSpecialties: string[] = [];
    let specialtyOrder: string[] = [];
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      // "Dermatologist" matches the specialty; "acne" or "fever" matches what doctors treat.
      const catalogue = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, subSpecialties: 1, conditions: 1, keywords: 1 }).lean();
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const hitsKeywords = (keywords?: string | null) => {
        if (!keywords) return false;
        try {
          return new RegExp(`\\b(${keywords})`, 'i').test(q) || words.some((w) => new RegExp(`\\b(${keywords})`, 'i').test(w));
        } catch {
          return false;
        }
      };
      matchedSpecialties = catalogue.filter((sp) => re.test(sp.name) || re.test(sp.plural) || sp.conditions?.some((c) => re.test(c)) || hitsKeywords(sp.keywords)).map((sp) => sp.slug);
      const focusSlugs = catalogue.flatMap((sp) => sp.subSpecialties.filter((sub) => re.test(sub.name) || re.test(sub.description ?? '')).map((sub) => sub.slug));
      const conditionSpecialties = allConditions().filter((c) => re.test(c.name) || c.symptoms.some((s) => re.test(s))).map((c) => c.specialty);
      // Best match first: "fever" → General Physician before the Siddha doctor who also treats fever.
      const byName = catalogue.filter((sp) => re.test(sp.name) || re.test(sp.plural)).map((sp) => sp.slug);
      specialtyOrder = [...new Set([...byName, ...conditionSpecialties, ...matchedSpecialties])];
      matchedSpecialties = specialtyOrder;
      filter.$or = [
        { name: re }, { clinicName: re }, { area: re }, { title: re }, { qualification: re },
        { specialty: { $in: [...new Set([...matchedSpecialties, ...conditionSpecialties])] } },
        { focusAreas: { $in: focusSlugs } },
      ];
    }

    // Availability (and "now") narrows to doctors with a matching open slot, so counts and paging stay right.
    if (availability || free || sort === 'soonest') {
      const candidates = await DoctorModel.find(filter, SLOT_FIELDS).lean();
      await ensureSlots(candidates as never, new Date(), daysNeeded);
      const slotMatch: Record<string, unknown> = { doctorSlug: { $in: candidates.map((c) => c.slug) }, startsAt: availabilityWindow(availability), ...bookableSlot() };
      if (mode || availability === 'now') slotMatch.mode = availability === 'now' ? 'video' : mode;
      if (free) slotMatch.free = true;
      const available = await SlotModel.distinct('doctorSlug', slotMatch);
      filter.slug = { $in: available };
    }

    let doctors;
    let total;
    if (sort === 'soonest') {
      // Order by the earliest open slot rather than a stored field.
      const slotMatch: Record<string, unknown> = { doctorSlug: { $in: (filter.slug as { $in: string[] })?.$in ?? [] }, startsAt: availabilityWindow(availability), ...bookableSlot() };
      if (mode || availability === 'now') slotMatch.mode = availability === 'now' ? 'video' : mode;
      if (free) slotMatch.free = true;
      const order = await SlotModel.aggregate<{ _id: string; at: Date }>([{ $match: slotMatch }, { $group: { _id: '$doctorSlug', at: { $min: '$startsAt' } } }, { $sort: { at: 1 } }]);
      total = order.length;
      const pageSlugs = order.slice((page - 1) * limit, page * limit).map((o) => o._id);
      const docs = await DoctorModel.find({ slug: { $in: pageSlugs } }).lean();
      doctors = pageSlugs.map((s) => docs.find((d) => d.slug === s)!).filter(Boolean);
    } else if (specialtyOrder.length > 1 && sort === 'relevance') {
      [doctors, total] = await Promise.all([
        DoctorModel.aggregate([
          { $match: filter },
          { $addFields: { _rank: { $let: { vars: { i: { $indexOfArray: [specialtyOrder, '$specialty'] } }, in: { $cond: [{ $lt: ['$$i', 0] }, 99, '$$i'] } } } } },
          { $sort: { _rank: 1, rankScore: -1, recommendPercent: -1, rating: -1, reviewCount: -1, slug: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { _rank: 0 } },
        ]),
        DoctorModel.countDocuments(filter),
      ]);
    } else {
      [doctors, total] = await Promise.all([
        DoctorModel.find(filter).sort({ ...SORTS[sort]!, slug: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        DoctorModel.countDocuments(filter),
      ]);
    }

    // Fresh slots for the page, then one aggregate for every card's "next available" chip.
    await ensureSlots(doctors as never, new Date(), daysNeeded);
    const slugs = doctors.map((d) => d.slug);
    const slotFilter: Record<string, unknown> = { doctorSlug: { $in: slugs }, startsAt: { $gte: new Date() }, ...bookableSlot() };
    if (mode || availability === 'now') slotFilter.mode = availability === 'now' ? 'video' : mode;
    if (free) slotFilter.free = true;
    const nextSlots = slugs.length
      ? await SlotModel.aggregate<{ _id: string; startsAt: Date; mode: string; fee: number; free: boolean; slotId: unknown }>([
          { $match: slotFilter },
          { $sort: { startsAt: 1 } },
          { $group: { _id: '$doctorSlug', startsAt: { $first: '$startsAt' }, mode: { $first: '$mode' }, fee: { $first: '$fee' }, free: { $first: '$free' }, slotId: { $first: '$_id' } } },
        ])
      : [];
    const nextBySlug = new Map(nextSlots.map((s) => [s._id, s]));

    const facetBase: Record<string, unknown> = everywhere ? {} : { city };
    if (specialty && specialty !== 'doctors') facetBase.specialty = specialty;
    const [areaFacet, languageFacet] = await Promise.all([
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: facetBase }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: facetBase }, { $unwind: '$languages' }, { $group: { _id: '$languages', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    ]);

    reply.header('cache-control', availability || free ? 'public, max-age=30' : CATALOGUE_CACHE);
    return {
      facets: {
        areas: areaFacet.map((a) => ({ value: a._id, count: a.count })),
        languages: languageFacet.map((l) => ({ value: l._id, count: l.count })),
      },
      doctors: doctors.map((d) => {
        const next = nextBySlug.get(d.slug);
        return {
          ...dto(d),
          nextSlotAt: next?.startsAt ?? null,
          nextSlot: next ? { id: String(next.slotId), startsAt: next.startsAt, mode: next.mode, fee: next.fee, free: Boolean(next.free) } : null,
        };
      }),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      mode: mode ?? null,
      city,
      matchedSpecialties,
    };
  });

  app.get('/doctors/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const doctor = await DoctorModel.findOne({ slug }).lean();
    if (!doctor) throw notFound('Doctor not found');

    const [facility, rating, specialtyDoc, similar] = await Promise.all([
      doctor.facilitySlug ? FacilityModel.findOne({ slug: doctor.facilitySlug }).lean() : null,
      ReviewModel.aggregate<{ _id: null; average: number; total: number }>([
        { $match: { doctorSlug: slug } },
        { $group: { _id: null, average: { $avg: '$rating' }, total: { $sum: 1 } } },
      ]),
      SpecialtyModel.findOne({ slug: doctor.specialty }).lean(),
      DoctorModel.find({ specialty: doctor.specialty, city: doctor.city, slug: { $ne: slug } }).sort({ rating: -1, reviewCount: -1 }).limit(3).lean(),
    ]);

    const focusNames = new Map((specialtyDoc?.subSpecialties ?? []).map((sub) => [sub.slug, sub.name]));
    const city = cityBySlug(doctor.city);
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      doctor: {
        ...dto(doctor),
        cityName: city?.name ?? doctor.city,
        focusAreaNames: (doctor.focusAreas ?? []).map((f) => focusNames.get(f) ?? f),
        services: (specialtyDoc?.subSpecialties ?? []).map((sub) => ({ ...sub, focus: (doctor.focusAreas ?? []).includes(sub.slug) })),
        specialtyName: specialtyDoc?.name ?? doctor.specialty,
        specialtyPlural: specialtyDoc?.plural ?? doctor.specialty,
        offersVideo: doctor.schedule?.video !== 'none',
        // Always computed from the reviews, so every screen shows the same numbers.
        reviewSummary: { average: rating[0] ? Math.round(rating[0].average * 10) / 10 : doctor.rating, total: rating[0]?.total ?? 0 },
      },
      facility: facility ? (({ _id: fid, createdAt: _c, updatedAt: _u, ...f }) => ({ id: String(fid), ...f }))(facility) : null,
      similar: similar.map(dto),
    };
  });

  app.get('/doctors/:slug/slots', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { mode, days } = z.object({
      mode: z.enum(['clinic', 'video']).optional(),
      days: z.coerce.number().int().min(1).max(14).default(7),
    }).parse(request.query);

    const doctor = await DoctorModel.findOne({ slug }, SLOT_FIELDS).lean();
    if (!doctor) throw notFound('Doctor not found');
    await ensureSlots([doctor] as never);

    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const filter: Record<string, unknown> = { doctorSlug: slug, startsAt: { $gte: new Date(), $lte: until }, ...bookableSlot() };
    if (mode) filter.mode = mode;

    const slots = await SlotModel.find(filter).sort({ startsAt: 1 }).limit(400).lean();
    return {
      slots: slots.map((s) => ({ id: String(s._id), startsAt: s.startsAt, mode: s.mode, fee: s.fee, free: Boolean(s.free) })),
    };
  });
}
