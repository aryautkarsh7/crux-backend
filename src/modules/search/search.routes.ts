import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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
    const { q } = z.object({ q: z.string().trim().min(2).max(80) }).parse(request.query);
    const re = new RegExp(escapeRegex(q), 'i');

    const catalogue = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, icon: 1, fromPrice: 1, subSpecialties: 1 }).lean();
    const specialties = catalogue.filter((s) => re.test(s.name) || re.test(s.plural) || s.subSpecialties.some((sub) => re.test(sub.name)));
    const focusSlugs = catalogue.flatMap((s) => s.subSpecialties.filter((sub) => re.test(sub.name) || re.test(sub.description ?? '')).map((sub) => sub.slug));

    const [doctors, medicines, labTests, facilities, articles] = await Promise.all([
      DoctorModel.find({ $or: [{ name: re }, { clinicName: re }, { title: re }, { area: re }, { specialty: { $in: specialties.map((s) => s.slug) } }, { focusAreas: { $in: focusSlugs } }] }).sort({ rating: -1 }).limit(5).lean(),
      MedicineModel.find({ $or: [{ name: re }, { composition: re }, { uses: re }] }, { slug: 1, name: 1, subtitle: 1, price: 1, mrp: 1, icon: 1, imageUrl: 1, rxRequired: 1 }).sort({ popularity: -1 }).limit(5).lean(),
      LabTestModel.find({ $or: [{ name: re }, { covers: re }, { 'parameterGroups.parameters': re }] }, { slug: 1, name: 1, kind: 1, price: 1, mrp: 1, testsIncluded: 1 }).sort({ popularity: -1 }).limit(5).lean(),
      FacilityModel.find({ $or: [{ name: re }, { area: re }, { departments: re }] }, { slug: 1, name: 1, type: 1, area: 1, rating: 1 }).sort({ rating: -1 }).limit(4).lean(),
      ArticleModel.find({ $or: [{ title: re }, { excerpt: re }, { tags: re }] }, { slug: 1, title: 1, category: 1, readMinutes: 1 }).sort({ publishedAt: -1 }).limit(3).lean(),
    ]);

    reply.header('cache-control', 'public, max-age=30');
    return {
      q,
      specialties: specialties.slice(0, 5).map(({ _id, subSpecialties: _s, ...s }) => s),
      doctors: doctors.map((d) => toDto(d)),
      medicines: medicines.map((m) => toDto(m)),
      labTests: labTests.map((t) => toDto(t)),
      facilities: facilities.map((f) => toDto(f)),
      articles: articles.map((a) => toDto(a)),
    };
  });
}
