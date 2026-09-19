import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';

const listQuery = z.object({
  city: z.string().default('bangalore'),
  specialty: z.string().optional(),
  q: z.string().trim().min(1).optional(),
  mode: z.enum(['clinic', 'video']).optional(),
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

export async function doctorRoutes(app: FastifyInstance) {
  app.get('/specialties', async (_request, reply) => {
    reply.header('cache-control', CATALOGUE_CACHE);
    const specialties = await SpecialtyModel.find().sort({ name: 1 }).lean();
    return { specialties: specialties.map(({ _id, ...s }) => s) };
  });

  app.get('/doctors', async (request, reply) => {
    const { city, specialty, q, mode, maxFee, minExperience, sort, page, limit } = listQuery.parse(request.query);

    const filter: Record<string, unknown> = { city };
    if (specialty && specialty !== 'doctors') filter.specialty = specialty;
    if (maxFee) filter.fee = { $lte: maxFee };
    if (minExperience) filter.experienceYears = { $gte: minExperience };
    if (q) filter.$text = { $search: q };

    const [doctors, total] = await Promise.all([
      DoctorModel.find(filter).sort(SORTS[sort]!).skip((page - 1) * limit).limit(limit).lean(),
      DoctorModel.countDocuments(filter),
    ]);

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      doctors: doctors.map(({ _id, createdAt, updatedAt, ...d }) => ({ id: String(_id), ...d })),
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

    const { _id, createdAt, updatedAt, ...rest } = doctor;
    reply.header('cache-control', CATALOGUE_CACHE);
    return { doctor: { id: String(_id), ...rest } };
  });

  app.get('/doctors/:slug/slots', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { mode, days } = z.object({
      mode: z.enum(['clinic', 'video']).optional(),
      days: z.coerce.number().int().min(1).max(14).default(7),
    }).parse(request.query);

    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const filter: Record<string, unknown> = { doctorSlug: slug, status: 'open', startsAt: { $gte: new Date(), $lte: until } };
    if (mode) filter.mode = mode;

    const slots = await SlotModel.find(filter).sort({ startsAt: 1 }).limit(200).lean();
    return {
      slots: slots.map((s) => ({ id: String(s._id), startsAt: s.startsAt, mode: s.mode, fee: s.fee })),
    };
  });
}
