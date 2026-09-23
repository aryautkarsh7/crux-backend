import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, escapeRegex, pageQuery, paged, toDto } from '../../lib/http.js';
import { LabCategoryModel, LabTestModel } from '../../models/lab-test.model.js';
import { LabModel } from '../../models/lab.model.js';
import { distanceKm, locate } from '../../lib/geo.js';
import { DEFAULT_LAB, collectionAvailability, eligibleLabs, fit, loadLabs, origin } from './lab-network.js';

const listQuery = z.object({
  category: z.string().trim().min(1).optional(),
  kind: z.enum(['package', 'test']).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'discount']).default('popular'),
  ...pageQuery,
});

const pincodeParam = z.string().regex(/^\d{6}$/).optional().catch(undefined);

const labListQuery = z.object({
  city: z.string().default('bangalore'),
  pincode: pincodeParam,
  area: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  test: z.string().trim().min(1).optional(),
  accreditation: z.enum(['NABL', 'CAP', 'ISO 15189']).optional(),
  homeCollection: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  walkIn: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['distance', 'rating', 'reviews']).default('distance'),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

/** The fields a lab card needs; the profile returns the full document. */
const labCard = (lab: Awaited<ReturnType<typeof loadLabs>>[number]) => ({
  id: String(lab._id),
  slug: lab.slug,
  name: lab.name,
  shortName: lab.shortName,
  type: lab.type,
  area: lab.area,
  address: lab.address,
  pincode: lab.pincode,
  geo: lab.geo,
  phone: lab.phone,
  tagline: lab.tagline,
  accreditations: lab.accreditations,
  rating: lab.rating,
  reviewCount: lab.reviewCount,
  openHours: lab.openHours,
  sundayHours: lab.sundayHours,
  homeCollection: lab.homeCollection,
  walkIn: lab.walkIn,
  collectionRadiusKm: lab.collectionRadiusKm,
  reportTat: lab.reportTat,
  testCount: lab.tests.length,
  photoUrl: lab.photoUrl,
});

const SORTS = { popular: { popularity: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, discount: { discount: -1 } } as const;

export async function labRoutes(app: FastifyInstance) {
  app.get('/lab-categories', async (_request, reply) => {
    const [categories, counts] = await Promise.all([
      LabCategoryModel.find().sort({ order: 1 }).lean(),
      LabTestModel.aggregate<{ _id: string; packages: number; tests: number }>([
        { $unwind: '$categories' },
        { $group: { _id: '$categories', packages: { $sum: { $cond: [{ $eq: ['$kind', 'package'] }, 1, 0] } }, tests: { $sum: { $cond: [{ $eq: ['$kind', 'test'] }, 1, 0] } } } },
      ]),
    ]);
    const bySlug = new Map(counts.map((c) => [c._id, c]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      categories: categories.map((c) => {
        const count = bySlug.get(c.slug);
        return { ...toDto(c), packages: count?.packages ?? 0, tests: count?.tests ?? 0 };
      }),
    };
  });

  app.get('/lab-tests', async (request, reply) => {
    const { category, kind, q, sort, page, limit } = listQuery.parse(request.query);
    const filter: Record<string, unknown> = {};
    if (category) filter.categories = category;
    if (kind) filter.kind = kind;
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { covers: re }, { highlights: re }, { 'parameterGroups.parameters': re }, { 'parameterGroups.name': re }];
    }
    const [items, total] = await Promise.all([
      LabTestModel.find(filter).sort({ ...SORTS[sort], _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      LabTestModel.countDocuments(filter),
    ]);
    reply.header('cache-control', CATALOGUE_CACHE);
    return paged(items.map((t) => toDto(t)), total, page, limit);
  });

  app.get('/lab-tests/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { pincode } = z.object({ pincode: pincodeParam }).parse(request.query);
    const test = await LabTestModel.findOne({ slug }).lean();
    if (!test) throw notFound('Test not found');
    const [related, labs] = await Promise.all([
      LabTestModel.find({ slug: { $ne: slug }, categories: { $in: test.categories } }).sort({ popularity: -1 }).limit(4).lean(),
      loadLabs(),
    ]);
    // Where this test can be done, nearest first.
    const place = origin(pincode);
    const offering = labs.filter((l) => l.tests.includes(slug)).map((l) => ({ lab: l, ...fit(l, place, [slug]) })).sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = offering.find((l) => l.canCollect) ?? offering[0];
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      test: toDto(test),
      related: related.map((t) => toDto(t)),
      availability: {
        labCount: offering.length,
        near: { pincode: place.pincode, area: place.area },
        nearest: nearest ? { ...labCard(nearest.lab), distanceKm: nearest.distanceKm, canCollect: nearest.canCollect } : null,
      },
    };
  });

  // ---- Partner lab directory ----

  app.get('/labs', async (request, reply) => {
    const q = labListQuery.parse(request.query);
    const place = origin(q.pincode);
    const all = await loadLabs(q.city);
    const needle = q.q?.toLowerCase();
    const rows = all
      .map((lab) => ({ lab, ...fit(lab, place, q.test ? [q.test] : []) }))
      .filter(({ lab, offersAll, canCollect }) =>
        (!q.area || lab.area === q.area) &&
        (!q.test || offersAll) &&
        (!q.accreditation || lab.accreditations.includes(q.accreditation)) &&
        (!q.homeCollection || canCollect) &&
        (!q.walkIn || lab.walkIn) &&
        (!needle || [lab.name, lab.area, lab.address, lab.tagline].some((f) => f?.toLowerCase().includes(needle))),
      )
      .sort((a, b) => (q.sort === 'rating' ? b.lab.rating - a.lab.rating : q.sort === 'reviews' ? b.lab.reviewCount - a.lab.reviewCount : a.distanceKm - b.distanceKm));

    const count = (values: string[]) => [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].map(([value, n]) => ({ value, count: n })).sort((a, b) => a.value.localeCompare(b.value));
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      ...paged(rows.slice((q.page - 1) * q.limit, q.page * q.limit).map((r) => ({ ...labCard(r.lab), distanceKm: r.distanceKm, canCollect: r.canCollect })), rows.length, q.page, q.limit),
      near: { pincode: place.pincode, area: place.area, approximate: place.approximate },
      facets: { areas: count(all.map((l) => l.area)), accreditations: count(all.flatMap((l) => l.accreditations)) },
    };
  });

  /** Which labs can take a booking for these tests at this pincode, for the booking page. */
  app.get('/labs/match', async (request, reply) => {
    const { pincode, tests, mode } = z
      .object({
        pincode: z.string().trim().optional(),
        tests: z.string().default('').transform((s) => s.split(',').map((t) => t.trim()).filter(Boolean)),
        mode: z.enum(['home', 'lab']).default('home'),
      })
      .parse(request.query);
    const place = pincode ? locate(pincode) : null;
    const labs = await loadLabs();
    const ranked = labs.map((lab) => ({ lab, ...fit(lab, place ?? origin(), tests) })).sort((a, b) => a.distanceKm - b.distanceKm);
    const eligible = place || mode === 'lab' ? eligibleLabs(labs, place ?? origin(), tests, mode) : [];

    let reason: string | null = null;
    if (mode === 'home' && pincode && !place) reason = `Home collection isn’t available at ${pincode} yet — we currently cover Bengaluru (560xxx). You can visit a partner lab instead.`;
    else if (mode === 'home' && place && !eligible.length) reason = `No partner lab collects at ${place.area} (${place.pincode}) for all the tests in this booking. Visit a lab, or remove the specialised test.`;

    reply.header('cache-control', 'no-store');
    return {
      place: place ? { pincode: place.pincode, area: place.area, approximate: place.approximate } : null,
      serviceable: eligible.length > 0,
      reason,
      recommended: eligible[0]?.lab.slug ?? null,
      labs: ranked.map((r) => ({
        ...labCard(r.lab),
        distanceKm: r.distanceKm,
        offersAll: r.offersAll,
        missingTests: r.missingTests,
        canCollect: r.canCollect,
        canVisit: r.canVisit,
        eligible: eligible.some((e) => e.lab.slug === r.lab.slug),
      })),
    };
  });

  app.get('/labs/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { pincode } = z.object({ pincode: pincodeParam }).parse(request.query);
    const lab = await LabModel.findOne({ slug }).lean();
    if (!lab) throw notFound('Lab not found');
    const place = origin(pincode);
    const [tests, others] = await Promise.all([LabTestModel.find({ slug: { $in: lab.tests } }).sort({ kind: -1, popularity: -1 }).lean(), loadLabs(lab.city)]);
    const nearby = others
      .filter((l) => l.slug !== slug)
      .map((l) => ({ ...labCard(l), distanceKm: distanceKm(lab.geo as { lat: number; lng: number }, l.geo as { lat: number; lng: number }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      lab: { ...toDto(lab), ...fit(lab, place, []), testCount: lab.tests.length },
      near: { pincode: place.pincode, area: place.area },
      tests: tests.map((t) => toDto(t)),
      nearby,
    };
  });

  app.get('/lab-collection-slots', async (request, reply) => {
    const { lab: slug, mode } = z.object({ lab: z.string().default(DEFAULT_LAB), mode: z.enum(['home', 'lab']).default('home') }).parse(request.query);
    const lab = await LabModel.findOne({ slug }).lean();
    if (!lab) throw notFound('Lab not found');
    reply.header('cache-control', 'no-store');
    return { lab: slug, mode, days: await collectionAvailability({ lab, mode }) };
  });
}
