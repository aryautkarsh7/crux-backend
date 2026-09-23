import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { refreshDoctorRatings } from '../../db/catalogue.js';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, objectId, pageQuery, paged, toDto } from '../../lib/http.js';
import { AppointmentModel } from '../../models/appointment.model.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { LeadModel } from '../../models/lead.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { UserModel } from '../../models/user.model.js';

const reviewQuery = z.object({
  sort: z.enum(['recent', 'helpful', 'rating_high', 'rating_low']).default('recent'),
  mode: z.enum(['clinic', 'video']).optional(),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(30).default(5),
});
const REVIEW_SORTS = { recent: { createdAt: -1 }, helpful: { helpful: -1 }, rating_high: { rating: -1, createdAt: -1 }, rating_low: { rating: 1, createdAt: -1 } } as const;

const reviewBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10, 'Please write at least a sentence').max(1000),
  mode: z.enum(['clinic', 'video']),
  visitedFor: z.string().trim().max(60).default(''),
  tags: z.array(z.string().max(30)).max(4).default([]),
});

const leadBody = z.object({
  kind: z.enum(['provider', 'hospital', 'corporate', 'callback', 'newsletter', 'surgery', 'plus']),
  surgery: z.string().trim().max(80).default(''),
  name: z.string().trim().max(80).default(''),
  phone: z.string().trim().regex(/^([6-9]\d{9})?$/, 'Enter a valid 10-digit mobile number').default(''),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).default(''),
  organisation: z.string().trim().max(120).default(''),
  city: z.string().trim().max(60).default(''),
  specialty: z.string().trim().max(60).default(''),
  message: z.string().trim().max(1000).default(''),
  source: z.string().trim().max(60).default(''),
}).refine((b) => b.phone || b.email, { message: 'Share a phone number or email so we can reach you', path: ['phone'] });

export async function contentRoutes(app: FastifyInstance) {
  // ---- Articles ----
  app.get('/articles', async (request, reply) => {
    const { category, featured, page, limit } = z.object({
      category: z.string().optional(),
      featured: z.coerce.boolean().optional(),
      ...pageQuery,
      limit: z.coerce.number().int().min(1).max(30).default(9),
    }).parse(request.query);
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (featured) filter.featured = true;
    const [items, total, categories] = await Promise.all([
      ArticleModel.find(filter, { sections: 0 }).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ArticleModel.countDocuments(filter),
      ArticleModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    reply.header('cache-control', CATALOGUE_CACHE);
    return { ...paged(items.map((a) => toDto(a)), total, page, limit), categories: categories.map((c) => ({ value: c._id, count: c.count })) };
  });

  app.get('/articles/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const article = await ArticleModel.findOne({ slug }).lean();
    if (!article) throw notFound('Article not found');
    const [related, author] = await Promise.all([
      ArticleModel.find({ slug: { $ne: slug }, category: article.category }, { sections: 0 }).sort({ publishedAt: -1 }).limit(3).lean(),
      article.author?.slug ? DoctorModel.findOne({ slug: article.author.slug }).lean() : null,
    ]);
    // Top up "related" from other categories so the rail is never empty.
    const more = related.length < 3
      ? await ArticleModel.find({ slug: { $nin: [slug, ...related.map((r) => r.slug)] } }, { sections: 0 }).sort({ publishedAt: -1 }).limit(3 - related.length).lean()
      : [];
    reply.header('cache-control', CATALOGUE_CACHE);
    return { article: toDto(article), author: author ? toDto(author) : null, related: [...related, ...more].map((a) => toDto(a)) };
  });

  // ---- Reviews ----
  app.get('/doctors/:slug/reviews', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const { sort, mode, page, limit } = reviewQuery.parse(request.query);
    const filter: Record<string, unknown> = { doctorSlug: slug };
    if (mode) filter.mode = mode;

    const [items, total, summary] = await Promise.all([
      ReviewModel.find(filter).sort(REVIEW_SORTS[sort]).skip((page - 1) * limit).limit(limit).lean(),
      ReviewModel.countDocuments(filter),
      ReviewModel.aggregate<{ _id: null; average: number; total: number; r5: number; r4: number; r3: number; r2: number; r1: number; clinic: number; video: number }>([
        { $match: { doctorSlug: slug } },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            total: { $sum: 1 },
            r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            clinic: { $sum: { $cond: [{ $eq: ['$mode', 'clinic'] }, 1, 0] } },
            video: { $sum: { $cond: [{ $eq: ['$mode', 'video'] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const s = summary[0];
    reply.header('cache-control', 'public, max-age=30');
    return {
      ...paged(items.map((r) => toDto(r, true)), total, page, limit),
      summary: {
        average: s ? Math.round(s.average * 10) / 10 : 0,
        total: s?.total ?? 0,
        breakdown: { 5: s?.r5 ?? 0, 4: s?.r4 ?? 0, 3: s?.r3 ?? 0, 2: s?.r2 ?? 0, 1: s?.r1 ?? 0 },
        byMode: { clinic: s?.clinic ?? 0, video: s?.video ?? 0 },
      },
    };
  });

  app.post('/doctors/:slug/reviews', { preHandler: authenticate, config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const body = reviewBody.parse(request.body);
    if (!(await DoctorModel.exists({ slug }))) throw notFound('Doctor not found');

    const [user, visited] = await Promise.all([
      UserModel.findById(request.user.sub).lean(),
      AppointmentModel.exists({ user: request.user.sub, doctorSlug: slug, status: { $ne: 'cancelled' } }),
    ]);
    const author = user?.name ? `${user.name.split(' ')[0]} ${(user.name.split(' ')[1] ?? '').charAt(0)}.`.trim() : 'Curxx patient';

    const review = await ReviewModel.findOneAndUpdate(
      { doctorSlug: slug, user: request.user.sub },
      { $set: { ...body, author, verified: Boolean(visited) }, $setOnInsert: { doctorSlug: slug, user: request.user.sub, helpful: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    // Profile, cards and review tab all read the same derived numbers.
    await refreshDoctorRatings([slug]);
    reply.code(201);
    return { review: toDto(review!, true) };
  });

  app.post('/reviews/:id/helpful', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    // $addToSet makes the vote idempotent per user.
    const updated = await ReviewModel.findOneAndUpdate(
      { _id: id, helpfulBy: { $ne: request.user.sub } },
      { $addToSet: { helpfulBy: request.user.sub }, $inc: { helpful: 1 } },
      { new: true },
    ).lean();
    const review = updated ?? (await ReviewModel.findById(id).lean());
    if (!review) throw notFound('Review not found');
    return { helpful: review.helpful, counted: Boolean(updated) };
  });

  // ---- Leads ----
  app.post('/leads', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = leadBody.parse(request.body);
    const lead = await LeadModel.create(body);
    reply.code(201);
    return { lead: { id: String(lead._id), kind: lead.kind } };
  });
}
