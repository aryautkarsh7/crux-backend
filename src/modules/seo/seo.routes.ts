import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveCitySlug } from '../../lib/catalogue-store.js';
import { notFound } from '../../lib/errors.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { doctorStats } from './doctor-stats.js';
import { surgeryStats } from './surgery-stats.js';

// Computed stats are cached for 10 minutes on the server; let the CDN keep them briefly too.
const SEO_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/** "india" (or a city slug / alias) → null for all of India, or the canonical city slug. */
function scopeCity(raw: string) {
  if (raw.toLowerCase() === 'india') return null;
  const city = resolveCitySlug(raw);
  if (!city) throw notFound('We don’t serve this city yet');
  return city;
}

/** Figures for the dynamic copy on doctor listing pages and the India pages (docs/content-templates). */
export async function seoRoutes(app: FastifyInstance) {
  app.get('/seo/doctors', async (request, reply) => {
    const q = z.object({ city: z.string().trim().min(2).max(40), specialty: z.string().trim().max(60).optional() }).parse(request.query);
    const city = scopeCity(q.city);
    const specialty = q.specialty && q.specialty !== 'doctors' ? q.specialty : null;
    if (specialty && !(await SpecialtyModel.exists({ slug: specialty }))) throw notFound('Unknown specialty');
    reply.header('cache-control', SEO_CACHE);
    return doctorStats(city, specialty);
  });

  app.get('/seo/surgeries', async (request, reply) => {
    const q = z.object({ city: z.string().trim().min(2).max(40) }).parse(request.query);
    reply.header('cache-control', SEO_CACHE);
    return surgeryStats(scopeCity(q.city));
  });
}
