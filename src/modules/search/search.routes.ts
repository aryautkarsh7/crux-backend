import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveCitySlug } from '../../db/data/cities.js';
import { CONDITIONS } from '../../db/data/conditions.js';
import { escapeRegex, toDto } from '../../lib/http.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { MedicineModel } from '../../models/medicine.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';

/** One query across the whole catalogue, for the header search. */
export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (request, reply) => {
    const { q, city: rawCity } = z.object({ q: z.string().trim().min(2).max(80), city: z.string().default('bangalore') }).parse(request.query);
    const city = resolveCitySlug(rawCity) ?? 'bangalore';
    const re = new RegExp(escapeRegex(q), 'i');

    const catalogue = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, icon: 1, fromPrice: 1, subSpecialties: 1, conditions: 1, keywords: 1 }).lean();
    const keywordHit = (keywords?: string | null) => {
      try {
        return Boolean(keywords) && new RegExp(`\\b(${keywords})`, 'i').test(q);
      } catch {
        return false;
      }
    };
    // "fever" finds the General Physician even though no specialty is called that.
    const conditionSpecialties = new Set(CONDITIONS.filter((c) => re.test(c.name) || c.symptoms.some((s) => re.test(s))).map((c) => c.specialty));
    const specialties = catalogue.filter((s) => re.test(s.name) || re.test(s.plural) || s.subSpecialties.some((sub) => re.test(sub.name)) || conditionSpecialties.has(s.slug) || keywordHit(s.keywords));
    const focusSlugs = catalogue.flatMap((s) => s.subSpecialties.filter((sub) => re.test(sub.name) || re.test(sub.description ?? '')).map((sub) => sub.slug));

    const [doctors, medicines, labTests, facilities, articles] = await Promise.all([
      DoctorModel.find({ city, $or: [{ name: re }, { clinicName: re }, { title: re }, { area: re }, { specialty: { $in: specialties.map((s) => s.slug) } }, { focusAreas: { $in: focusSlugs } }] }).sort({ rating: -1 }).limit(5).lean(),
      MedicineModel.find({ $or: [{ name: re }, { composition: re }, { uses: re }] }, { slug: 1, name: 1, subtitle: 1, price: 1, mrp: 1, icon: 1, imageUrl: 1, rxRequired: 1 }).sort({ popularity: -1 }).limit(5).lean(),
      LabTestModel.find({ $or: [{ name: re }, { covers: re }, { 'parameterGroups.parameters': re }] }, { slug: 1, name: 1, kind: 1, price: 1, mrp: 1, testsIncluded: 1 }).sort({ popularity: -1 }).limit(5).lean(),
      FacilityModel.find({ city, $or: [{ name: re }, { area: re }, { departments: re }, { category: re }] }, { slug: 1, name: 1, type: 1, category: 1, area: 1, rating: 1 }).sort({ rating: -1 }).limit(4).lean(),
      ArticleModel.find({ $or: [{ title: re }, { excerpt: re }, { tags: re }] }, { slug: 1, title: 1, category: 1, readMinutes: 1 }).sort({ publishedAt: -1 }).limit(3).lean(),
    ]);

    reply.header('cache-control', 'public, max-age=30');
    return {
      q,
      city,
      specialties: specialties.slice(0, 5).map(({ _id, subSpecialties: _s, conditions: _c, keywords: _k, ...s }) => s),
      conditions: CONDITIONS.filter((c) => re.test(c.name) || c.symptoms.some((s) => re.test(s))).slice(0, 4).map((c) => ({ slug: c.slug, name: c.name, specialty: c.specialty, summary: c.summary })),
      doctors: doctors.map(({ schedule: _s, slotsThrough: _t, ...d }) => toDto(d)),
      medicines: medicines.map((m) => toDto(m)),
      labTests: labTests.map((t) => toDto(t)),
      facilities: facilities.map((f) => toDto(f)),
      articles: articles.map((a) => toDto(a)),
    };
  });
}
