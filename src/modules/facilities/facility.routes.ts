import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, escapeRegex, pageQuery, paged, toDto } from '../../lib/http.js';
import { bookableSlot } from '../../lib/slots.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { SlotModel } from '../../models/slot.model.js';

const listQuery = z.object({
  city: z.string().default('bangalore'),
  type: z.enum(['hospital', 'clinic']).optional(),
  area: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  emergency: z.coerce.boolean().optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['distance', 'rating', 'reviews']).default('distance'),
  ...pageQuery,
});

const SORTS = { distance: { distanceKm: 1 }, rating: { rating: -1 }, reviews: { reviewCount: -1 } } as const;

export async function facilityRoutes(app: FastifyInstance) {
  app.get('/facilities', async (request, reply) => {
    const { city, type, area, department, emergency, q, sort, page, limit } = listQuery.parse(request.query);
    const filter: Record<string, unknown> = { city };
    if (type) filter.type = type;
    if (area) filter.area = area;
    if (department) filter.departments = new RegExp(`^${escapeRegex(department)}`, 'i');
    if (emergency) filter.emergency24x7 = true;
    if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { area: new RegExp(escapeRegex(q), 'i') }, { departments: new RegExp(escapeRegex(q), 'i') }];

    const [items, total, areas, doctorCounts] = await Promise.all([
      FacilityModel.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).lean(),
      FacilityModel.countDocuments(filter),
      FacilityModel.aggregate<{ _id: string; count: number }>([
        { $match: { city, ...(type ? { type } : {}) } },
        { $group: { _id: '$area', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      DoctorModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$facilitySlug', count: { $sum: 1 } } }]),
    ]);
    const doctorsAt = new Map(doctorCounts.map((d) => [d._id, d.count]));

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      ...paged(items.map((f) => ({ ...toDto(f), doctorCount: doctorsAt.get(f.slug) ?? 0 })), total, page, limit),
      facets: { areas: areas.map((a) => ({ value: a._id, count: a.count })) },
    };
  });

  app.get('/facilities/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const facility = await FacilityModel.findOne({ slug }).lean();
    if (!facility) throw notFound('Hospital or clinic not found');

    const doctors = await DoctorModel.find({ facilitySlug: slug }).sort({ rating: -1, reviewCount: -1 }).lean();
    const next = await SlotModel.aggregate<{ _id: string; startsAt: Date }>([
      { $match: { doctorSlug: { $in: doctors.map((d) => d.slug) }, startsAt: { $gte: new Date() }, ...bookableSlot() } },
      { $sort: { startsAt: 1 } },
      { $group: { _id: '$doctorSlug', startsAt: { $first: '$startsAt' } } },
    ]);
    const nextBySlug = new Map(next.map((n) => [n._id, n.startsAt]));

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      facility: toDto(facility),
      doctors: doctors.map((d) => ({ ...toDto(d), nextSlotAt: nextBySlug.get(d.slug) ?? null })),
    };
  });
}
