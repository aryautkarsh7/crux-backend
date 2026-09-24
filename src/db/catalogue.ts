/**
 * Brings the catalogue (specialties, facilities, doctors, labs, tests, articles, reviews) in line
 * with the data files. Idempotent and non-destructive for patient data: users, appointments, orders,
 * records and patient-written reviews are never touched. Runs from `npm run seed` and automatically
 * on server start whenever DATA_VERSION changes, so a deploy updates the live database by itself.
 */
import { ARTICLE_CATEGORIES, ARTICLES } from './data/articles.js';
import { DOCTORS, FOCUS_AREAS } from './data/bangalore-doctors.js';
import { CITIES } from './data/cities.js';
import { buildConditionArticles } from './data/condition-articles.js';
import { DEPARTMENTS, buildDirectory } from './data/diagnostic-directory.js';
import { buildRoster, scheduleForExisting } from './data/doctor-network.js';
import { ORIGINAL_DOCTOR_META, generateDoctors } from './data/doctors.js';
import { buildFacilities } from './data/facility-network.js';
import { LAB_CATEGORIES, LAB_TESTS } from './data/lab-tests.js';
import { BANGALORE_IMAGING, BASIC_TESTS, LABS, REFERENCE_ONLY, buildCityLabs, type LabProfile } from './data/labs.js';
import { MEDICINES, MEDICINE_CATEGORIES } from './data/medicines.js';
import { FEMALE_PORTRAITS, MALE_PORTRAITS } from './data/portraits.js';
import { generateReviews } from './data/reviews.js';
import { SPECIALTIES } from './data/specialties.js';
import { AccessGrantModel } from '../models/access-grant.model.js';
import { AppointmentModel } from '../models/appointment.model.js';
import { ArticleModel } from '../models/article.model.js';
import { DoctorModel } from '../models/doctor.model.js';
import { FacilityModel } from '../models/facility.model.js';
import { HealthRecordModel } from '../models/health-record.model.js';
import { LabCategoryModel, LabTestModel } from '../models/lab-test.model.js';
import { LabModel } from '../models/lab.model.js';
import { LeadModel } from '../models/lead.model.js';
import { MedicineCategoryModel, MedicineModel } from '../models/medicine.model.js';
import { MessageModel } from '../models/message.model.js';
import { MetaModel } from '../models/meta.model.js';
import { OrderModel } from '../models/order.model.js';
import { ReviewModel } from '../models/review.model.js';
import { SlotModel } from '../models/slot.model.js';
import { SpecialtyModel } from '../models/specialty.model.js';
import { UserModel } from '../models/user.model.js';

/** Bump whenever the data files change; the next server start re-syncs the live database. */
export const DATA_VERSION = '2026-09-24.5';

type Log = (message: string) => void;

const upsertAll = async (model: { bulkWrite: (ops: any[], opts?: any) => Promise<unknown> }, docs: readonly { slug: string }[]) => {
  for (let i = 0; i < docs.length; i += 500) {
    await model.bulkWrite(docs.slice(i, i + 500).map((d) => ({ updateOne: { filter: { slug: d.slug }, update: { $set: d }, upsert: true } })), { ordered: false });
  }
};

export async function syncCatalogue(log: Log = () => {}) {
  const started = Date.now();
  const step = (m: string) => log(`[catalogue] ${m} (${Math.round((Date.now() - started) / 100) / 10}s)`);

  // ---- Specialties ----
  await upsertAll(SpecialtyModel, SPECIALTIES.map((s) => ({
    slug: s.slug, name: s.name, plural: s.plural, icon: s.icon, category: s.category, description: s.description,
    fromPrice: s.feeRange[0], videoFrom: s.videoRange[0], feeRange: s.feeRange, video: s.video, popular: Boolean(s.popular),
    conditions: s.conditions, keywords: s.keywords, whenToSee: s.whenToSee, related: s.related, subSpecialties: s.subSpecialties,
  })));
  await SpecialtyModel.deleteMany({ slug: { $nin: SPECIALTIES.map((s) => s.slug) } });
  step('specialties');

  // ---- Facilities ----
  const facilities = buildFacilities();
  await upsertAll(FacilityModel, facilities);
  await FacilityModel.deleteMany({ slug: { $nin: facilities.map((f) => f.slug) } });
  step(`facilities ${facilities.length}`);

  // ---- Pharmacy ----
  await upsertAll(MedicineCategoryModel, MEDICINE_CATEGORIES);
  await upsertAll(MedicineModel, MEDICINES);

  // ---- Lab catalogue: curated tests + the full diagnostic directory ----
  const directory = buildDirectory();
  await upsertAll(LabCategoryModel, [
    ...LAB_CATEGORIES.map((c, order) => ({ slug: c.slug, name: c.name, icon: c.icon, order, group: 'concern' })),
    ...DEPARTMENTS.map((d, i) => ({ slug: d.slug, name: d.name, icon: d.icon, order: 100 + i, group: 'department' })),
  ]);
  await upsertAll(LabTestModel, LAB_TESTS.map((t) => ({
    ...t,
    homeCollection: true,
    categories: [...new Set([...t.categories, ...(directory.existingTags.get(t.slug) ?? [])])],
  })));
  await upsertAll(LabTestModel, directory.tests);
  const catalogue = await LabTestModel.find({}, { slug: 1, kind: 1, homeCollection: 1, department: 1, price: 1 }).lean();
  await LabTestModel.deleteMany({ slug: { $nin: catalogue.map((t) => t.slug) } });
  step(`lab tests ${catalogue.length}`);

  // ---- Labs: each lab's menu comes from its profile ----
  const curatedRoutine = LAB_TESTS.map((t) => t.slug).filter((s) => !REFERENCE_ONLY.includes(s));
  const routineDepts = new Set(['blood-tests', 'urine-tests', 'stool-tests', 'rapid-tests']);
  const menu: Record<LabProfile, string[]> = {
    reference: catalogue.filter((t) => t.kind === 'package' || t.kind === 'test').map((t) => t.slug),
    routine: [...curatedRoutine, ...catalogue.filter((t) => t.kind === 'test' && routineDepts.has(t.department ?? '') && t.price <= 1500).map((t) => t.slug)],
    imaging: [...catalogue.filter((t) => t.kind === 'scan' || t.kind === 'procedure').map((t) => t.slug), 'complete-blood-count', 'fasting-blood-sugar', 'urine-routine', 'lipid-profile', 'hba1c'],
    basic: BASIC_TESTS,
  };
  const labs = [
    ...LABS.map((l) => ({ ...l, city: 'bangalore', tests: menu[l.profile as LabProfile] })),
    ...BANGALORE_IMAGING.map((l) => ({ ...l, city: 'bangalore', tests: menu.imaging })),
    ...CITIES.filter((c) => c.slug !== 'bangalore').flatMap((c) => buildCityLabs(c).map((l) => ({ ...l, city: c.slug, tests: menu[l.profile] }))),
  ];
  await upsertAll(LabModel, labs);
  await LabModel.deleteMany({ slug: { $nin: labs.map((l) => l.slug) } });
  step(`labs ${labs.length}`);

  // ---- Doctors ----
  const facilityBySlug = new Map(facilities.map((f) => [f.slug, f]));
  const legacySubs = Object.fromEntries(SPECIALTIES.map((sp) => [sp.slug, sp.subSpecialties.map((sub) => sub.slug)]));
  const existingCount: Record<string, number> = {};
  for (const d of DOCTORS) existingCount[d.specialty] = (existingCount[d.specialty] ?? 0) + 1;
  const legacyGenerated = generateDoctors(existingCount, new Set(DOCTORS.map((d) => d.slug)), legacySubs);

  // Portraits: keep the originals that match, then hand out gender-matched ones round-robin.
  const usedPhotos = new Set(DOCTORS.filter((d) => ORIGINAL_DOCTOR_META[d.slug]?.keepPhoto).map((d) => d.photoUrl));
  const pools = { female: FEMALE_PORTRAITS.filter((u) => !usedPhotos.has(u)), male: MALE_PORTRAITS.filter((u) => !usedPhotos.has(u)) };
  const cursor = { female: 0, male: 0 };
  const nextPortrait = (gender: 'female' | 'male') => {
    const pool = pools[gender].length ? pools[gender] : gender === 'female' ? FEMALE_PORTRAITS : MALE_PORTRAITS;
    return pool[cursor[gender]++ % pool.length]!;
  };

  const INSTITUTES = ['AIIMS New Delhi', 'Bangalore Medical College', 'CMC Vellore', 'Kasturba Medical College, Manipal', 'St. John’s Medical College, Bengaluru', 'JIPMER Puducherry'];
  const bangalore = [
    ...DOCTORS.map((d, i) => {
      const meta = ORIGINAL_DOCTOR_META[d.slug]!;
      const parts = d.qualification.split(',').map((q) => q.trim()).filter(Boolean);
      const graduated = 2026 - d.experienceYears - 3;
      return {
        ...d,
        gender: meta.gender,
        facilitySlug: meta.facilitySlug,
        photoUrl: meta.keepPhoto ? d.photoUrl : nextPortrait(meta.gender),
        focusAreas: FOCUS_AREAS[d.slug] ?? [],
        education: parts.map((degree, k) => ({ degree, institute: INSTITUTES[(i + k * 2) % INSTITUTES.length]!, year: graduated - (parts.length - 1 - k) * 3 })),
        registration: `KMC ${48000 + i * 1379}`,
      };
    }),
    ...legacyGenerated.map((d) => ({ ...d, photoUrl: nextPortrait(d.gender) })),
  ].map((d) => {
    const facility = facilityBySlug.get(d.facilitySlug);
    const specialtyName = SPECIALTIES.find((sp) => sp.slug === d.specialty)?.name.toLowerCase() ?? 'doctor';
    const { schedule, consultHours, freeVideo } = scheduleForExisting(facility, d.specialty, d.slug);
    return {
      ...d,
      city: 'bangalore',
      clinicName: facility?.name ?? d.facilitySlug,
      area: facility?.area ?? 'Indiranagar',
      schedule,
      consultHours,
      freeVideo,
      instant: false,
      about: `${d.name} is a ${d.title.toLowerCase()} with ${d.experienceYears} years of experience, consulting at ${facility?.name}, ${facility?.area}, Bengaluru. ${d.name.split(' ')[1]} sees patients in person and on video for ${specialtyName} concerns, and follows up on chat for 7 days after every consultation.`,
    };
  });

  const roster = buildRoster({ facilities, bangaloreExisting: bangalore.map((d) => ({ slug: d.slug, specialty: d.specialty, facilitySlug: d.facilitySlug })) })
    .map((d) => ({ ...d, photoUrl: nextPortrait(d.gender) }));
  const everyone = [...bangalore, ...roster].map((d) => ({ ...d, verified: true, slotsThrough: null }));
  await upsertAll(DoctorModel, everyone as never);
  const slugs = everyone.map((d) => d.slug);
  await DoctorModel.deleteMany({ slug: { $nin: slugs } });
  step(`doctors ${everyone.length}`);

  // ---- Slots: schedules may have changed, so clear unbooked future slots; they regenerate on demand ----
  await SlotModel.deleteMany({ status: 'open' });
  await SlotModel.deleteMany({ doctorSlug: { $nin: slugs }, status: { $ne: 'booked' } });
  step('slots reset');

  // ---- Reviews: regenerate seeded ones, keep patient-written ones, then derive every count from them ----
  await ReviewModel.deleteMany({ user: { $exists: false } });
  const seeded = generateReviews(everyone.map((d) => ({ slug: d.slug, specialty: d.specialty })));
  for (let i = 0; i < seeded.length; i += 2000) await ReviewModel.insertMany(seeded.slice(i, i + 2000), { ordered: false });
  await refreshDoctorRatings();
  step(`reviews ${seeded.length}`);

  // ---- Articles: curated + one per condition, authored by a matching Bangalore doctor ----
  const authorFor = new Map<string, { name: string; slug: string; title: string }>();
  for (const d of bangalore) if (!authorFor.has(d.specialty)) authorFor.set(d.specialty, { name: d.name, slug: d.slug, title: d.title });
  const roster1 = new Map<string, { name: string; slug: string; title: string }>();
  for (const d of roster) if (d.city === 'bangalore' && !roster1.has(d.specialty)) roster1.set(d.specialty, { name: d.name, slug: d.slug, title: d.title });
  const conditionArticles = buildConditionArticles().map(({ authorSpecialty, ...a }) => ({
    ...a,
    author: authorFor.get(authorSpecialty) ?? roster1.get(authorSpecialty) ?? authorFor.get('general-physician')!,
  }));
  await upsertAll(ArticleModel, [...ARTICLES, ...conditionArticles]);
  step(`articles ${ARTICLES.length + conditionArticles.length}`);

  await Promise.all(
    [SpecialtyModel, DoctorModel, SlotModel, FacilityModel, MedicineModel, MedicineCategoryModel, LabTestModel, LabCategoryModel, LabModel, ArticleModel, ReviewModel, OrderModel, HealthRecordModel, AccessGrantModel, AppointmentModel, MessageModel, LeadModel, UserModel].map((m) => (m as { syncIndexes: () => Promise<unknown> }).syncIndexes()),
  );
  step('indexes');
  return { categories: ARTICLE_CATEGORIES.length };
}

/** Rating, review count and recommend % on every doctor, computed from the reviews themselves. */
export async function refreshDoctorRatings(doctorSlugs?: string[]) {
  const match = doctorSlugs ? { doctorSlug: { $in: doctorSlugs } } : {};
  const stats = await ReviewModel.aggregate<{ _id: string; average: number; total: number; positive: number }>([
    { $match: match },
    { $group: { _id: '$doctorSlug', average: { $avg: '$rating' }, total: { $sum: 1 }, positive: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } } } },
  ]);
  for (let i = 0; i < stats.length; i += 1000) {
    await DoctorModel.bulkWrite(stats.slice(i, i + 1000).map((r) => ({
      updateOne: {
        filter: { slug: r._id },
        update: { $set: { rating: Math.round(r.average * 10) / 10, reviewCount: r.total, recommendPercent: Math.round((r.positive / r.total) * 100) } },
      },
    })) as never);
  }
}

/**
 * Runs the sync once per DATA_VERSION. Safe with several instances starting at once: a lock in the
 * meta collection lets only one of them work, and a stale lock (crashed instance) expires.
 */
export async function ensureCatalogue(log: Log) {
  const current = await MetaModel.findById('catalogue').lean();
  if (current?.version === DATA_VERSION && !current.error) return false;
  const staleBefore = new Date(Date.now() - 20 * 60 * 1000);
  const lock = await MetaModel.findOneAndUpdate(
    { _id: 'catalogue', $or: [{ running: { $ne: true } }, { startedAt: { $lt: staleBefore } }] },
    { $set: { running: true, startedAt: new Date() } },
    { upsert: true, new: true },
  ).catch(() => null);
  if (!lock) return false;
  try {
    await syncCatalogue(log);
    await MetaModel.updateOne({ _id: 'catalogue' }, { $set: { version: DATA_VERSION, running: false, syncedAt: new Date(), error: '' } });
    return true;
  } catch (error) {
    await MetaModel.updateOne({ _id: 'catalogue' }, { $set: { running: false, error: String(error).slice(0, 500) } });
    throw error;
  }
}
