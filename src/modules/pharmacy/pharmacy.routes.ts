import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, escapeRegex, pageQuery, paged, toDto } from '../../lib/http.js';
import { MedicineCategoryModel, MedicineModel } from '../../models/medicine.model.js';

const listQuery = z.object({
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  rx: z.enum(['required', 'otc']).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'discount', 'rating']).default('popular'),
  ...pageQuery,
});

export async function pharmacyRoutes(app: FastifyInstance) {
  app.get('/medicine-categories', async (_request, reply) => {
    const [categories, counts] = await Promise.all([
      MedicineCategoryModel.find().sort({ order: 1 }).lean(),
      MedicineModel.aggregate<{ _id: string; count: number }>([{ $unwind: '$categories' }, { $group: { _id: '$categories', count: { $sum: 1 } } }]),
    ]);
    const bySlug = new Map(counts.map((c) => [c._id, c.count]));
    reply.header('cache-control', CATALOGUE_CACHE);
    return { categories: categories.map((c) => ({ ...toDto(c), count: bySlug.get(c.slug) ?? 0 })) };
  });

  app.get('/medicines', async (request, reply) => {
    const { category, q, rx, sort, page, limit } = listQuery.parse(request.query);
    const filter: Record<string, unknown> = {};
    if (category) filter.categories = category;
    if (rx) filter.rxRequired = rx === 'required';
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { composition: re }, { subtitle: re }, { manufacturer: re }, { uses: re }];
    }

    // Discount sort needs a computed field, so it goes through an aggregate.
    const sortStage: Record<string, 1 | -1> =
      sort === 'price_asc' ? { price: 1 } : sort === 'price_desc' ? { price: -1 } : sort === 'rating' ? { rating: -1, reviewCount: -1 } : sort === 'discount' ? { discountPct: -1 } : { popularity: -1 };

    const [items, total] = await Promise.all([
      MedicineModel.aggregate([
        { $match: filter },
        { $addFields: { discountPct: { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 100] }, 0] } } },
        { $sort: { ...sortStage, _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { description: 0, sideEffects: 0, howToUse: 0, safetyAdvice: 0, storage: 0 } },
      ]),
      MedicineModel.countDocuments(filter),
    ]);

    reply.header('cache-control', CATALOGUE_CACHE);
    return paged(items.map((m) => toDto(m)), total, page, limit);
  });

  app.get('/medicines/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const medicine = await MedicineModel.findOne({ slug }).lean();
    if (!medicine) throw notFound('Medicine not found');

    // Same composition first (substitutes), then same category.
    const [substitutes, similar] = await Promise.all([
      MedicineModel.find({ slug: { $ne: slug }, composition: medicine.composition }).limit(4).lean(),
      MedicineModel.find({ slug: { $ne: slug }, categories: { $in: medicine.categories } }).sort({ popularity: -1 }).limit(8).lean(),
    ]);

    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      medicine: toDto(medicine),
      substitutes: substitutes.map((m) => toDto(m)),
      similar: similar.map((m) => toDto(m)),
    };
  });
}
