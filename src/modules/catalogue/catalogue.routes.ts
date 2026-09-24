import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SPECIALTY_ALIASES } from '../../db/data/specialties.js';
import { cities as allCities, cityBySlug, conditionBySlug, conditions as allConditions, resolveCitySlug, surgeries as allSurgeries, surgeryBySlug, surgeryCategories, type ConditionRecord, type SurgeryRecord } from '../../lib/catalogue-store.js';
import { notFound } from '../../lib/errors.js';
import { CATALOGUE_CACHE, escapeRegex, toDto } from '../../lib/http.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';

const cityQuery = z.object({ city: z.string().default('bangalore') });
const cityOf = (raw: string) => {
  const city = cityBySlug(resolveCitySlug(raw) ?? '');
  if (!city) throw notFound('We don’t serve this city yet');
  return city;
};

/** Tier-2 cities are about 15% cheaper than metros for the same procedure. */
const cityCost = (cost: number[], tier: number): [number, number] => {
  const f = tier === 1 ? 1 : 0.85;
  const round = (n: number) => Math.round((n * f) / 500) * 500;
  return [round(cost[0] ?? 0), round(cost[1] ?? 0)];
};

const conditionSummary = (c: ConditionRecord) => ({ slug: c.slug, name: c.name, specialty: c.specialty, summary: c.summary, popular: c.popular ?? null });
const surgerySummary = (s: SurgeryRecord, tier = 1) => ({
  slug: s.slug,
  name: s.name,
  category: s.category,
  specialty: s.specialty,
  icon: s.icon,
  popular: Boolean(s.popular),
  description: s.description,
  stay: s.stay,
  recovery: s.recovery,
  cost: cityCost(s.cost, tier),
  insurance: s.insurance,
});

/** Conditions, surgeries and the search autosuggest. */
export async function catalogueRoutes(app: FastifyInstance) {
  app.get('/conditions', async (_request, reply) => {
    reply.header('cache-control', CATALOGUE_CACHE);
    return { conditions: allConditions().map(conditionSummary) };
  });

  app.get('/conditions/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const city = cityOf(cityQuery.parse(request.query).city);
    const condition = conditionBySlug(slug);
    if (!condition) throw notFound('Condition not found');

    const [specialty, doctorCount, article] = await Promise.all([
      SpecialtyModel.findOne({ slug: condition.specialty }, { slug: 1, name: 1, plural: 1, icon: 1, subSpecialties: 1, video: 1 }).lean(),
      DoctorModel.countDocuments({ city: city.slug, specialty: condition.specialty }),
      ArticleModel.findOne({ condition: condition.slug }, { slug: 1, title: 1, excerpt: 1, readMinutes: 1 }).lean(),
    ]);
    const focus = specialty?.subSpecialties.find((s) => s.slug === condition.focus);
    const place = city.name;
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      condition,
      city: { slug: city.slug, name: city.name },
      specialty: specialty ? { slug: specialty.slug, name: specialty.name, plural: specialty.plural, icon: specialty.icon, video: specialty.video !== false } : null,
      focus: focus ?? null,
      doctorCount,
      article: article ? toDto(article) : null,
      related: allConditions().filter((c) => c.slug !== slug && c.specialty === condition.specialty).map(conditionSummary),
      otherCities: allCities().filter((c) => c.slug !== city.slug).map((c) => ({ slug: c.slug, name: c.name })),
      faqs: [
        { question: `Which doctor should I see for ${condition.name.toLowerCase()} in ${place}?`, answer: `A ${specialty?.name ?? 'doctor'} treats ${condition.name.toLowerCase()}. Curxx lists ${doctorCount} verified ${specialty?.plural ?? 'doctors'} in ${place} you can book for a clinic visit${specialty?.video !== false ? ' or an online consultation' : ''}.` },
        { question: `What are the common symptoms of ${condition.name.toLowerCase()}?`, answer: `${condition.symptoms.join('; ')}.` },
        { question: `When should I see a doctor for ${condition.name.toLowerCase()}?`, answer: `See a doctor if you notice: ${condition.whenToSee.join('; ')}.` },
        { question: `How is ${condition.name.toLowerCase()} treated?`, answer: `${condition.treatments.join('; ')}. Your doctor will tailor treatment after examining you.` },
      ],
    };
  });

  app.get('/surgeries', async (request, reply) => {
    const city = cityOf(cityQuery.parse(request.query).city);
    reply.header('cache-control', CATALOGUE_CACHE);
    return { categories: surgeryCategories(), city: { slug: city.slug, name: city.name }, surgeries: allSurgeries().map((s) => surgerySummary(s, city.tier)) };
  });

  app.get('/surgeries/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const city = cityOf(cityQuery.parse(request.query).city);
    const surgery = surgeryBySlug(slug);
    if (!surgery) throw notFound('Surgery not found');

    const departments = surgery.departments.map((d) => new RegExp(`^${escapeRegex(d)}`, 'i'));
    const [hospitals, surgeons, specialty] = await Promise.all([
      FacilityModel.find(
        { city: city.slug, $or: [{ departments: { $in: departments } }, { specialties: surgery.specialty }], category: { $nin: ['Clinic', 'Diagnostic Center', 'Homeopathy Clinic', 'Primary Health Center'] } },
        { slug: 1, name: 1, area: 1, category: 1, rating: 1, reviewCount: 1, nabh: 1, beds: 1, insurers: 1, emergency24x7: 1 },
      )
        .sort({ nabh: -1, rating: -1 })
        .limit(6)
        .lean(),
      DoctorModel.find({ city: city.slug, specialty: surgery.specialty }, { slug: 1, name: 1, title: 1, experienceYears: 1, rating: 1, reviewCount: 1, area: 1, clinicName: 1, photoUrl: 1, qualification: 1, fee: 1 })
        .sort({ experienceYears: -1, rating: -1 })
        .limit(4)
        .lean(),
      SpecialtyModel.findOne({ slug: surgery.specialty }, { slug: 1, name: 1, plural: 1 }).lean(),
    ]);
    const [low, high] = cityCost(surgery.cost, city.tier);
    const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      surgery: { ...surgery, cost: [low, high] },
      city: { slug: city.slug, name: city.name },
      specialty: specialty ? toDto(specialty) : null,
      hospitals: hospitals.map((h) => toDto(h)),
      surgeons: surgeons.map((d) => toDto(d)),
      related: allSurgeries().filter((s) => s.slug !== slug && s.category === surgery.category).map((s) => surgerySummary(s, city.tier)),
      otherCities: allCities().filter((c) => c.slug !== city.slug).map((c) => ({ slug: c.slug, name: c.name })),
      faqs: [
        { question: `What is the cost of ${surgery.name.toLowerCase()} in ${city.name}?`, answer: `${surgery.name} in ${city.name} typically costs ${inr(low)} to ${inr(high)}, depending on the hospital, technique (${surgery.techniques.slice(0, 2).join(' or ')}), room type and insurance. Curxx care coordinators share an itemised estimate before you decide.` },
        { question: `Is ${surgery.name.toLowerCase()} covered by insurance?`, answer: surgery.insurance ? `Yes, it is usually covered under health insurance when medically necessary. Partner hospitals in ${city.name} offer cashless treatment with most insurers, and we help with pre-authorisation.` : `It is usually considered elective and not covered by most insurance plans. No-cost EMI options are available at partner hospitals.` },
        { question: `How long is the hospital stay and recovery?`, answer: `Hospital stay: ${surgery.stay}. Recovery: ${surgery.recovery}. The procedure itself takes about ${surgery.durationMinutes[0]}–${surgery.durationMinutes[1]} minutes under ${surgery.anaesthesia.toLowerCase()}.` },
        { question: `How do I book ${surgery.name.toLowerCase()} with Curxx?`, answer: `Share your details in the free consultation form. A Curxx care coordinator calls you, books a surgeon consultation in ${city.name}, and helps with the estimate, insurance paperwork and admission.` },
      ],
    };
  });

  /** Autosuggest for the header and hero search: specialties, symptoms, doctors, hospitals, surgeries, tests. */
  app.get('/search/suggest', async (request, reply) => {
    const { q, city: rawCity } = z.object({ q: z.string().trim().min(1).max(60), city: z.string().default('bangalore') }).parse(request.query);
    const city = resolveCitySlug(rawCity) ?? 'bangalore';
    const re = new RegExp(`(^|\\s|-)${escapeRegex(q)}`, 'i');
    const anywhere = new RegExp(escapeRegex(q), 'i');

    const catalogue = await SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, icon: 1, keywords: 1, conditions: 1 }).lean();
    const keywordHit = (keywords?: string | null) => {
      if (!keywords || q.length < 3) return false;
      try {
        return new RegExp(`\\b(${keywords})`, 'i').test(q);
      } catch {
        return false;
      }
    };
    const aliasTarget = SPECIALTY_ALIASES[q.toLowerCase().replace(/\s+/g, '-')];
    const fromConditions = new Set(allConditions().filter((c) => anywhere.test(c.name) || c.symptoms.some((s) => re.test(s))).map((c) => c.specialty));
    const specialties = catalogue
      .map((s) => ({ s, score: re.test(s.name) || re.test(s.plural) || s.slug === aliasTarget ? 3 : fromConditions.has(s.slug) ? 2 : keywordHit(s.keywords) || s.conditions?.some((c) => anywhere.test(c)) ? 1 : 0 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .slice(0, 5)
      .map(({ s }) => ({ slug: s.slug, name: s.name, plural: s.plural, icon: s.icon }));
    const conditions = allConditions().filter((c) => anywhere.test(c.name) || c.symptoms.some((s) => re.test(s)))
      .slice(0, 4)
      .map((c) => ({ slug: c.slug, name: c.name, specialty: c.specialty }));
    const surgeries = allSurgeries().filter((s) => anywhere.test(s.name) || s.treats.some((t) => re.test(t)))
      .slice(0, 3)
      .map((s) => ({ slug: s.slug, name: s.name, category: s.category }));

    const [doctors, facilities, tests] = q.length < 2
      ? [[], [], []]
      : await Promise.all([
          DoctorModel.find({ city, name: re }, { slug: 1, name: 1, specialty: 1, area: 1, photoUrl: 1 }).sort({ rating: -1 }).limit(4).lean(),
          FacilityModel.find({ city, $or: [{ name: re }, { category: re }] }, { slug: 1, name: 1, area: 1, category: 1 }).sort({ rating: -1 }).limit(3).lean(),
          LabTestModel.find({ name: re }, { slug: 1, name: 1, kind: 1, price: 1 }).sort({ popularity: -1 }).limit(3).lean(),
        ]);
    const specialtyName = new Map(catalogue.map((s) => [s.slug, s.name]));

    reply.header('cache-control', 'public, max-age=60, s-maxage=300');
    return {
      q,
      city,
      specialties,
      conditions,
      doctors: doctors.map((d) => ({ slug: d.slug, name: d.name, specialty: specialtyName.get(d.specialty) ?? d.specialty, area: d.area, photoUrl: d.photoUrl })),
      facilities: facilities.map((f) => ({ slug: f.slug, name: f.name, area: f.area, category: f.category })),
      surgeries,
      tests: tests.map((t) => ({ slug: t.slug, name: t.name, kind: t.kind, price: t.price })),
    };
  });
}
