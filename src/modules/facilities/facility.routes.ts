import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveCitySlug } from '../../db/data/cities.js';
import { FACILITY_TYPES } from '../../db/data/facility-network.js';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, escapeRegex, pageQuery, paged, toDto } from '../../lib/http.js';
import { ensureSlots } from '../../lib/slot-gen.js';
import { bookableSlot } from '../../lib/slots.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { SlotModel } from '../../models/slot.model.js';

const TYPE_BY_SLUG = new Map(FACILITY_TYPES.map((t) => [t.slug, t]));

const listQuery = z.object({
  city: z.string().default('bangalore'),
  type: z.enum(['hospital', 'clinic']).optional(),
  /** One of the 19 facility types, by slug (e.g. eye-hospital). */
  category: z.string().trim().min(1).optional(),
  area: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  specialty: z.string().trim().min(1).optional(),
  emergency: z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1').optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['distance', 'rating', 'reviews']).default('distance'),
  ...pageQuery,
});

const SORTS = { distance: { distanceKm: 1 }, rating: { rating: -1 }, reviews: { reviewCount: -1 } } as const;
const doctorDto = ({ schedule: _s, slotsThrough: _t, ...d }: Record<string, any>) => toDto(d as { _id: unknown });

export async function facilityRoutes(app: FastifyInstance) {
  app.get('/facility-types', async (_request, reply) => {
    reply.header('cache-control', CATALOGUE_CACHE);
    return { types: FACILITY_TYPES };
  });

  app.get('/facilities', async (request, reply) => {
    const query = listQuery.parse(request.query);
    const { type, area, department, specialty, emergency, q, sort, page, limit } = query;
    const city = resolveCitySlug(query.city) ?? query.city;
    const category = query.category ? TYPE_BY_SLUG.get(query.category)?.name ?? query.category : undefined;

    const base: Record<string, unknown> = { city };
    if (type) base.type = type;
    const filter: Record<string, unknown> = { ...base };
    if (category) filter.category = category;
    if (area) filter.area = new RegExp(`^${escapeRegex(area)}$`, 'i');
    if (department) filter.departments = new RegExp(`^${escapeRegex(department)}`, 'i');
    if (specialty) filter.specialties = specialty;
    if (emergency) filter.emergency24x7 = true;
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { area: re }, { departments: re }, { category: re }];
    }

    const [items, total, areas, categories] = await Promise.all([
      FacilityModel.find(filter).sort({ ...SORTS[sort], slug: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      FacilityModel.countDocuments(filter),
      FacilityModel.aggregate<{ _id: string; count: number }>([{ $match: base }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      FacilityModel.aggregate<{ _id: string; count: number }>([{ $match: { city } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const doctorCounts = await DoctorModel.aggregate<{ _id: string; count: number }>([
      { $match: { facilitySlug: { $in: items.map((f) => f.slug) } } },
      { $group: { _id: '$facilitySlug', count: { $sum: 1 } } },
    ]);
    const doctorsAt = new Map(doctorCounts.map((d) => [d._id, d.count]));
    const byCategory = new Map(categories.map((c) => [c._id, c.count]));

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      ...paged(items.map((f) => ({ ...toDto(f), doctorCount: doctorsAt.get(f.slug) ?? 0 })), total, page, limit),
      city,
      facets: {
        areas: areas.map((a) => ({ value: a._id, count: a.count })),
        // All 19 types, so the filter can show every option (zero counts included).
        categories: FACILITY_TYPES.map((t) => ({ value: t.slug, label: t.name, group: t.group, icon: t.icon, count: byCategory.get(t.name) ?? 0 })),
      },
    };
  });

  app.get('/facilities/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const facility = await FacilityModel.findOne({ slug }).lean();
    if (!facility) throw notFound('Hospital or clinic not found');

    const doctors = await DoctorModel.find({ facilitySlug: slug }).sort({ rating: -1, reviewCount: -1 }).lean();
    await ensureSlots(doctors as never);
    const next = await SlotModel.aggregate<{ _id: string; startsAt: Date }>([
      { $match: { doctorSlug: { $in: doctors.map((d) => d.slug) }, startsAt: { $gte: new Date() }, ...bookableSlot() } },
      { $sort: { startsAt: 1 } },
      { $group: { _id: '$doctorSlug', startsAt: { $first: '$startsAt' } } },
    ]);
    const nextBySlug = new Map(next.map((n) => [n._id, n.startsAt]));
    const nearby = await FacilityModel.find({ city: facility.city, slug: { $ne: slug }, category: facility.category }, { slug: 1, name: 1, area: 1, category: 1, rating: 1, type: 1 })
      .sort({ rating: -1 })
      .limit(4)
      .lean();

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      facility: { ...toDto(facility), categoryInfo: FACILITY_TYPES.find((t) => t.name === facility.category) ?? null },
      doctors: doctors.map((d) => ({ ...doctorDto(d), nextSlotAt: nextBySlug.get(d.slug) ?? null })),
      similar: nearby.map((f) => toDto(f)),
    };
  });
}
