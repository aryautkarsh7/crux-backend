import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { bookableSlot } from '../../lib/slots.js';
import { escapeRegex } from '../../lib/http.js';

const listQuery = z.object({
  city: z.string().default('bangalore'),
  specialty: z.string().optional(),
  focus: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  mode: z.enum(['clinic', 'video']).optional(),
  area: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  availability: z.enum(['today', 'tomorrow', 'next-7-days']).optional(),
  maxFee: z.coerce.number().positive().optional(),
  minExperience: z.coerce.number().min(0).optional(),
  sort: z.enum(['relevance', 'fee_asc', 'fee_desc', 'experience', 'rating']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const SORTS: Record<string, Record<string, 1 | -1>> = {
  relevance: { recommendPercent: -1, rating: -1 },
  fee_asc: { fee: 1 },
  fee_desc: { fee: -1 },
  experience: { experienceYears: -1 },
  rating: { rating: -1 },
};

// Catalogue data is public and changes rarely: let the CDN and browser cache it.
const CATALOGUE_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/** Start/end of the requested availability window, defaulting to the next 7 days. */
function availabilityWindow(availability?: 'today' | 'tomorrow' | 'next-7-days') {
  const now = new Date();
  const endOfDay = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offsetDays);
    d.setHours(23, 59, 59, 999);
    return d;
  };
  if (availability === 'today') return { $gte: now, $lte: endOfDay(0) };
  if (availability === 'tomorrow') {
    const start = new Date(now);
    start.setDate(now.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: endOfDay(1) };
  }
  return { $gte: now, $lte: endOfDay(7) };
}

export async function doctorRoutes(app: FastifyInstance) {
  app.get('/specialties', async (request, reply) => {
    const { city, mode } = z
      .object({ city: z.string().default('bangalore'), mode: z.enum(['clinic', 'video']).optional() })
      .parse(request.query);

    const specialties = await SpecialtyModel.find().sort({ name: 1 }).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    if (!mode) return { specialties: specialties.map(({ _id, ...s }) => s) };

    // With a mode, each specialty also reports how many of its doctors have an open
    // slot of that kind this week — the instant-consult flow leads with that number.
    const bookable = await SlotModel.distinct('doctorSlug', { mode, startsAt: availabilityWindow(), ...bookableSlot() });
    const counts = await DoctorModel.aggregate<{ _id: string; count: number }>([
      { $match: { city, slug: { $in: bookable } } },
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
    ]);
    const bySpecialty = new Map(counts.map((c) => [c._id, c.count]));

    return { specialties: specialties.map(({ _id, ...s }) => ({ ...s, availableDoctors: bySpecialty.get(s.slug) ?? 0 })) };
  });

  app.get('/doctors', async (request, reply) => {
    const { city, specialty, focus, q, mode, area, language, availability, maxFee, minExperience, sort, page, limit } =
      listQuery.parse(request.query);

    const filter: Record<string, unknown> = { city };
    if (specialty && specialty !== 'doctors') filter.specialty = specialty;
    if (focus) filter.focusAreas = focus;
    if (maxFee) filter.fee = { $lte: maxFee };
    if (minExperience) filter.experienceYears = { $gte: minExperience };
    if (area) filter.area = area;
    if (language) filter.languages = language;
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      // "Dermatologist" matches the specialty; "acne" or "fever" matches what doctors treat.
      const catalogue = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, subSpecialties: 1 }).lean();
      const specialtySlugs = catalogue.filter((sp) => re.test(sp.name) || re.test(sp.plural)).map((sp) => sp.slug);
      const focusSlugs = catalogue.flatMap((sp) => sp.subSpecialties.filter((sub) => re.test(sub.name) || re.test(sub.description ?? '')).map((sub) => sub.slug));
      filter.$or = [
        { name: re }, { clinicName: re }, { area: re }, { title: re }, { qualification: re },
        { specialty: { $in: specialtySlugs } },
        { focusAreas: { $in: focusSlugs } },
      ];
    }

    // "Available today" narrows to doctors with an open slot in the window, so the
    // count and pagination stay correct instead of filtering after the fact.
    if (availability || mode) {
      const window = availabilityWindow(availability);
      const slotMatch: Record<string, unknown> = { startsAt: window, ...bookableSlot() };
      if (mode) slotMatch.mode = mode;
      const available = await SlotModel.distinct('doctorSlug', slotMatch);
      filter.slug = { $in: available };
    }

    const [doctors, total] = await Promise.all([
      DoctorModel.find(filter).sort(SORTS[sort]!).skip((page - 1) * limit).limit(limit).lean(),
      DoctorModel.countDocuments(filter),
    ]);

    // One aggregate gives every card its "next available" chip without N+1 queries.
    const slugs = doctors.map((d) => d.slug);
    const slotFilter: Record<string, unknown> = { doctorSlug: { $in: slugs }, startsAt: { $gte: new Date() }, ...bookableSlot() };
    if (mode) slotFilter.mode = mode;
    const nextSlots = slugs.length
      ? await SlotModel.aggregate<{ _id: string; startsAt: Date }>([
          { $match: slotFilter },
          { $sort: { startsAt: 1 } },
          { $group: { _id: '$doctorSlug', startsAt: { $first: '$startsAt' } } },
        ])
      : [];
    const nextBySlug = new Map(nextSlots.map((s) => [s._id, s.startsAt]));

    const facetBase: Record<string, unknown> = { city };
    if (specialty && specialty !== 'doctors') facetBase.specialty = specialty;
    const [areaFacet, languageFacet] = await Promise.all([
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: facetBase }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: facetBase }, { $unwind: '$languages' }, { $group: { _id: '$languages', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    ]);

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      facets: {
        areas: areaFacet.map((a) => ({ value: a._id, count: a.count })),
        languages: languageFacet.map((l) => ({ value: l._id, count: l.count })),
      },
      doctors: doctors.map(({ _id, createdAt, updatedAt, ...d }) => ({
        id: String(_id),
        ...d,
        nextSlotAt: nextBySlug.get(d.slug) ?? null,
      })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      mode: mode ?? null,
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
      DoctorModel.find({ specialty: doctor.specialty, slug: { $ne: slug } }).sort({ rating: -1 }).limit(3).lean(),
    ]);

    const { _id, createdAt, updatedAt, ...rest } = doctor;
    const focusNames = new Map((specialtyDoc?.subSpecialties ?? []).map((sub) => [sub.slug, sub.name]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      doctor: {
        id: String(_id),
        ...rest,
        focusAreaNames: (doctor.focusAreas ?? []).map((f) => focusNames.get(f) ?? f),
        services: (specialtyDoc?.subSpecialties ?? []).map((sub) => ({ ...sub, focus: (doctor.focusAreas ?? []).includes(sub.slug) })),
        specialtyName: specialtyDoc?.name ?? doctor.specialty,
        reviewSummary: { average: rating[0] ? Math.round(rating[0].average * 10) / 10 : doctor.rating, total: rating[0]?.total ?? 0 },
      },
      facility: facility ? (({ _id: fid, createdAt: _c, updatedAt: _u, ...f }) => ({ id: String(fid), ...f }))(facility) : null,
      similar: similar.map(({ _id: sid, createdAt: _c, updatedAt: _u, ...d }) => ({ id: String(sid), ...d })),
    };
  });

  app.get('/doctors/:slug/slots', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { mode, days } = z.object({
      mode: z.enum(['clinic', 'video']).optional(),
      days: z.coerce.number().int().min(1).max(14).default(7),
    }).parse(request.query);

    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const filter: Record<string, unknown> = { doctorSlug: slug, startsAt: { $gte: new Date(), $lte: until }, ...bookableSlot() };
    if (mode) filter.mode = mode;

    const slots = await SlotModel.find(filter).sort({ startsAt: 1 }).limit(200).lean();
    return {
      slots: slots.map((s) => ({ id: String(s._id), startsAt: s.startsAt, mode: s.mode, fee: s.fee })),
    };
  });
}
