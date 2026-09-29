/**
 * The numbers behind the dynamic SEO copy on /{city}/doctors, /{city}/{specialty}, /india/doctors and
 * /india/{specialty} (templates in docs/content-templates). Everything is computed from the live doctors
 * so the copy never contradicts the listing. Rules from the templates:
 * - Clinic figures count clinic doctors only (online-only 24x7 doctors are left out); video figures count
 *   video doctors only.
 * - Availability ("today", earliest slot) comes from each doctor's weekly hours minus booked times, for
 *   doctors who can actually be booked.
 * - A fee the doctor hasn't confirmed (feeVerified: false) marks the range it sets as approximate.
 */
import { cities as allCities } from '../../lib/catalogue-store.js';
import { bookingModeOf } from '../../lib/booking-mode.js';
import { requestTimes, slotsForDay } from '../../lib/slot-gen.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';

const DOCTOR_FIELDS = {
  slug: 1, name: 1, specialty: 1, city: 1, area: 1, fee: 1, videoFee: 1, feeVerified: 1, schedule: 1, freeVideo: 1, instant: 1,
  experienceYears: 1, rating: 1, reviewCount: 1, languages: 1, facilitySlug: 1, source: 1, bookable: 1,
} as const;

type Lite = {
  _id: unknown; slug: string; name: string; specialty: string; city: string; area: string; fee: number; videoFee: number;
  feeVerified?: boolean | null; schedule?: any; freeVideo?: boolean | null; instant?: boolean | null; experienceYears: number;
  rating: number; reviewCount: number; languages?: string[]; facilitySlug?: string; source?: string | null; bookable?: boolean | null;
};

export type FeeRange = { min: number; max: number; approx: boolean };
type Availability = { next: Date | null; clinicToday: boolean; videoToday: boolean };

/** A top-rated ranking only trusts ratings with at least this many reviews (one 5★ review isn't "top-rated"). */
const MIN_REVIEWS_FOR_RANK = 5;
const DAYS_AHEAD = 7;
const CACHE_MS = 10 * 60 * 1000;

export const offersClinic = (d: Lite) => !d.instant && d.schedule?.video !== 'all';
export const offersVideo = (d: Lite) => (d.schedule?.video ?? 'mixed') !== 'none';

function feeRange(docs: Lite[], fee: (d: Lite) => number): FeeRange | null {
  const priced = docs.filter((d) => fee(d) > 0);
  if (!priced.length) return null;
  const values = priced.map(fee);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Approximate when an unconfirmed fee sets either end of the range.
  const approx = priced.some((d) => d.feeVerified === false && (fee(d) === min || fee(d) === max));
  return { min, max, approx };
}

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Next open time and today's availability per bookable doctor, from their hours minus booked or held times. */
async function availabilityOf(docs: Lite[], now: Date) {
  const bookable = docs.filter((d) => bookingModeOf(d) !== 'none');
  const out = new Map<string, Availability>();
  if (!bookable.length) return out;
  const until = new Date(dayStart(now).getTime() + DAYS_AHEAD * 86_400_000);
  const busyRows = await SlotModel.find(
    { doctorSlug: { $in: bookable.map((d) => d.slug) }, startsAt: { $gte: now, $lte: until }, $or: [{ status: 'booked' }, { status: 'held', holdExpiresAt: { $gte: now } }] },
    { doctorSlug: 1, startsAt: 1 },
  ).lean();
  const busy = new Set(busyRows.map((b) => `${b.doctorSlug}|${b.startsAt.getTime()}`));
  const today = dayStart(now).getTime();
  for (const d of bookable) {
    const times = bookingModeOf(d) === 'request'
      ? requestTimes(d as never, now, DAYS_AHEAD)
      : Array.from({ length: DAYS_AHEAD }, (_, i) => slotsForDay(d as never, new Date(today + i * 86_400_000), now)).flat();
    const open = times.filter((t) => !busy.has(`${d.slug}|${t.startsAt.getTime()}`));
    const isToday = (t: { startsAt: Date }) => dayStart(t.startsAt).getTime() === today;
    out.set(d.slug, {
      next: open[0]?.startsAt ?? null,
      clinicToday: open.some((t) => t.mode === 'clinic' && isToday(t)),
      videoToday: open.some((t) => t.mode === 'video' && isToday(t)),
    });
  }
  return out;
}

const earliestOf = (docs: Lite[], avail: Map<string, Availability>) => {
  const times = docs.map((d) => avail.get(d.slug)?.next?.getTime()).filter((t): t is number => t !== undefined);
  return times.length ? new Date(Math.min(...times)) : null;
};

function core(docs: Lite[], avail: Map<string, Availability>) {
  const clinic = docs.filter(offersClinic);
  const video = docs.filter(offersVideo);
  const reviewed = docs.filter((d) => d.reviewCount > 0 && d.rating > 0);
  const reviews = reviewed.reduce((n, d) => n + d.reviewCount, 0);
  const weighted = reviewed.reduce((n, d) => n + d.rating * d.reviewCount, 0);
  const withExp = docs.filter((d) => d.experienceYears > 0);
  return {
    total: docs.length,
    clinicCount: clinic.length,
    videoCount: video.length,
    clinicOnlyCount: docs.length - video.length,
    freeVideoCount: docs.filter((d) => d.freeVideo && offersVideo(d)).length,
    todayCount: docs.filter((d) => { const a = avail.get(d.slug); return a && (a.clinicToday || a.videoToday); }).length,
    clinicTodayCount: clinic.filter((d) => avail.get(d.slug)?.clinicToday).length,
    videoTodayCount: video.filter((d) => avail.get(d.slug)?.videoToday).length,
    clinicFee: feeRange(clinic, (d) => d.fee),
    videoFee: feeRange(video, (d) => d.videoFee),
    earliest: earliestOf(docs, avail),
    avgExperience: withExp.length ? Math.round(withExp.reduce((n, d) => n + d.experienceYears, 0) / withExp.length) : null,
    reviewCount: reviews,
    avgRating: reviews ? Math.round((weighted / reviews) * 10) / 10 : null,
  };
}

/** Rated doctors (enough reviews) by rating, then everyone else by experience. */
function topDoctors(docs: Lite[], avail: Map<string, Availability>, limit: number, cityName: (slug: string) => string) {
  const trusted = (d: Lite) => d.reviewCount >= MIN_REVIEWS_FOR_RANK && d.rating > 0;
  return [...docs]
    .sort((a, b) => Number(trusted(b)) - Number(trusted(a)) || (trusted(a) ? b.rating - a.rating : 0) || b.experienceYears - a.experienceYears || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      city: d.city,
      cityName: cityName(d.city),
      area: d.area,
      experienceYears: d.experienceYears,
      rating: d.reviewCount > 0 ? d.rating : null,
      reviewCount: d.reviewCount,
      fee: offersClinic(d) ? d.fee : null,
      videoFee: offersVideo(d) ? d.videoFee : null,
      feeApprox: d.feeVerified === false,
      next: avail.get(d.slug)?.next ?? null,
    }));
}

function groupBy<K extends string>(docs: Lite[], key: (d: Lite) => K) {
  const groups = new Map<K, Lite[]>();
  for (const d of docs) {
    const k = key(d);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return groups;
}

const FEE_BANDS = [
  { label: 'Under ₹500', min: 0, max: 499 },
  { label: '₹500 – ₹999', min: 500, max: 999 },
  { label: '₹1,000 – ₹1,499', min: 1000, max: 1499 },
  { label: '₹1,500 – ₹1,999', min: 1500, max: 1999 },
  { label: '₹2,000 and above', min: 2000, max: Infinity },
];

async function feeBands(docs: Lite[]) {
  const clinic = docs.filter(offersClinic).filter((d) => d.fee > 0);
  const facilities = await FacilityModel.find({ slug: { $in: [...new Set(clinic.map((d) => d.facilitySlug).filter(Boolean))] } }, { slug: 1, category: 1 }).lean();
  const settingOf = new Map(facilities.map((f) => [f.slug, f.category ?? '']));
  return FEE_BANDS.map((band) => {
    const inBand = clinic.filter((d) => d.fee >= band.min && d.fee <= band.max);
    // "Typical setting": the most common kind of place these doctors practise at, when known.
    const settings = [...groupBy(inBand, (d) => settingOf.get(d.facilitySlug ?? '') ?? '')].sort((a, b) => b[1].length - a[1].length);
    return { label: band.label, count: inBand.length, setting: settings[0]?.[0] ?? null };
  }).filter((b) => b.count > 0);
}

async function compute(city: string | null, specialtySlug: string | null) {
  const now = new Date();
  const filter: Record<string, unknown> = {};
  if (city) filter.city = city;
  if (specialtySlug) filter.specialty = specialtySlug;
  const [docs, specialtyDocs] = await Promise.all([
    DoctorModel.find(filter, DOCTOR_FIELDS).lean() as unknown as Promise<Lite[]>,
    SpecialtyModel.find({}, { slug: 1, name: 1, plural: 1, conditions: 1, whenToSee: 1, video: 1 }).lean(),
  ]);
  const cityList = allCities();
  const cityName = (slug: string) => cityList.find((c) => c.slug === slug)?.name ?? slug;
  const specialtyOf = new Map(specialtyDocs.map((s) => [s.slug, s]));
  const avail = await availabilityOf(docs, now);
  const specialty = specialtySlug ? specialtyOf.get(specialtySlug) : undefined;

  const specialties = [...groupBy(docs, (d) => d.specialty)]
    .map(([slug, group]) => ({
      slug,
      name: specialtyOf.get(slug)?.name ?? slug,
      plural: specialtyOf.get(slug)?.plural ?? slug,
      count: group.length,
      cityCount: new Set(group.map((d) => d.city)).size,
      clinicFee: feeRange(group.filter(offersClinic), (d) => d.fee),
      videoFee: feeRange(group.filter(offersVideo), (d) => d.videoFee),
      earliest: earliestOf(group, avail),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const cityRows = [...groupBy(docs, (d) => d.city)]
    .map(([slug, group]) => ({
      slug,
      name: cityName(slug),
      count: group.length,
      clinicFee: feeRange(group.filter(offersClinic), (d) => d.fee),
      videoFee: feeRange(group.filter(offersVideo), (d) => d.videoFee),
      earliest: earliestOf(group, avail),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const areaRows = city
    ? [...groupBy(docs, (d) => d.area)]
        .map(([name, group]) => {
          const locality = cityList.find((c) => c.slug === city)?.localities.find((l) => l.name.toLowerCase() === name.toLowerCase());
          return { name, slug: locality?.slug ?? null, count: group.length, clinicFee: feeRange(group.filter(offersClinic), (d) => d.fee) };
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    : [];

  const languageCounts = new Map<string, number>();
  for (const d of docs) for (const l of new Set(d.languages ?? [])) if (l) languageCounts.set(l, (languageCounts.get(l) ?? 0) + 1);
  const languages = [...languageCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const clinicCities = new Set(docs.filter(offersClinic).map((d) => d.city));
  return {
    scope: {
      city: city ? { slug: city, name: cityName(city) } : null,
      specialty: specialty
        ? { slug: specialty.slug, name: specialty.name, plural: specialty.plural, conditions: specialty.conditions ?? [], whenToSee: specialty.whenToSee ?? [] }
        : null,
    },
    ...core(docs, avail),
    specialtyCount: specialties.length,
    cityCount: cityRows.length,
    clinicCityCount: clinicCities.size,
    smallCityCount: cityRows.filter((c) => c.count < 5).length,
    specialties,
    cities: cityRows,
    areas: areaRows,
    languages,
    feeBands: specialtySlug ? await feeBands(docs) : [],
    topDoctors: topDoctors(docs, avail, 10, cityName),
    generatedAt: now,
  };
}

export type DoctorStats = Awaited<ReturnType<typeof compute>>;

const cache = new Map<string, { at: number; value: Promise<DoctorStats> }>();

/** Cached for 10 minutes per scope; concurrent requests share one computation. */
export function doctorStats(city: string | null, specialty: string | null) {
  const key = `${city ?? 'india'}|${specialty ?? '*'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = compute(city, specialty);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

export const clearDoctorStats = () => cache.clear();
