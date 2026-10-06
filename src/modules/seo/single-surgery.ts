/**
 * The facts behind the single surgery page template (docs/content-templates/single-surgery-dynamic-template.docx):
 * surgeons of the surgery's specialty, hospitals that perform it, area-wise counts, an India-wide city
 * comparison, nearby cities and related procedures. Only real listings and catalogue figures: the website
 * builds the words and leaves out any sentence whose figure is missing. Cached per city and surgery until
 * the directory changes.
 */
import { cities as allCities, surgeries as allSurgeries } from '../../lib/catalogue-store.js';
import type { SurgeryRecord } from '../../lib/catalogue-store.js';
import { cleanAreaCounts } from '../../lib/areas.js';
import { directoryVersion } from '../doctar/directory.js';
import { Doctors, Facilities } from '../doctar/store.js';

const CACHE_MS = 10 * 60 * 1000;
/** Facility types that don't operate (same rule as the surgery page's hospital list). */
const NOT_SURGICAL = ['Clinic', 'Diagnostic Center', 'Homeopathy Clinic', 'Primary Health Center'];

/** Same rounding as the surgery cards (catalogue.routes cityCost). */
export const tierCost = (cost: number[], tier: number): [number, number] => {
  const f = tier === 1 ? 1 : 0.85;
  const round = (n: number) => Math.round((n * f) / 500) * 500;
  return [round(cost[0] ?? 0), round(cost[1] ?? 0)];
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hospitalFilter = (surgery: SurgeryRecord) => ({
  $or: [
    { departments: { $in: surgery.departments.map((d) => new RegExp(`^${escape(d)}`, 'i')) } },
    { specialties: surgery.specialty },
  ],
  category: { $nin: NOT_SURGICAL },
});
const average = (ns: number[]) =>
  ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null;
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

type Doc = Record<string, any>;

async function compute(surgery: SurgeryRecord, citySlug: string) {
  const cities = allCities();
  const city = cities.find((c) => c.slug === citySlug)!;
  const hospitalsWhere = hospitalFilter(surgery);
  const [surgeons, hospitals, everywhereDoctors, hospitalsByCity] = await Promise.all([
    Doctors.find(
      { city: citySlug, specialty: surgery.specialty },
      {
        projection: { slug: 1, name: 1, experienceYears: 1, clinicName: 1, area: 1 },
        sort: { experienceYears: -1, slug: 1 },
      },
    ),
    Facilities.find(
      { city: citySlug, ...hospitalsWhere },
      {
        projection: { slug: 1, name: 1, category: 1, area: 1, beds: 1 },
        sort: { nabh: -1, rankScore: -1, rating: -1, slug: 1 },
      },
    ),
    Doctors.find(
      { specialty: surgery.specialty },
      { projection: { city: 1, experienceYears: 1 } },
    ) as Promise<Doc[]>,
    Facilities.countBy('city', hospitalsWhere),
  ]);

  // Only real localities count as areas (not the city's own name, streets, floors or building names).
  const clean = new Set(
    cleanAreaCounts(
      [...surgeons, ...hospitals].map((x) => x.area),
      city.name,
      city.localities.map((l) => l.name),
    ).map((a) => a.name),
  );
  const isArea = (a?: string) => Boolean(a) && clean.has(a!);
  const byArea = new Map<string, { surgeons: string[]; hospitals: string[] }>();
  const slot = (a: string) =>
    byArea.get(a) ?? byArea.set(a, { surgeons: [], hospitals: [] }).get(a)!;
  for (const d of surgeons) if (isArea(d.area)) slot(d.area).surgeons.push(d.name);
  for (const h of hospitals) if (isArea(h.area)) slot(h.area).hospitals.push(h.name);
  const localities = [...byArea]
    .map(([name, v]) => ({
      name,
      slug: city.localities.find((l) => l.name.toLowerCase() === name.toLowerCase())?.slug ?? null,
      surgeons: v.surgeons.length,
      hospitals: v.hospitals.length,
      surgeonNames: v.surgeons.slice(0, 3),
      hospitalNames: v.hospitals.slice(0, 3),
      total: v.surgeons.length + v.hospitals.length,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const doctorsIn = new Map<string, number[]>();
  for (const d of everywhereDoctors)
    (doctorsIn.get(d.city) ?? doctorsIn.set(d.city, []).get(d.city)!).push(
      Number(d.experienceYears) || 0,
    );
  const hospitalsIn = new Map(hospitalsByCity.map((r) => [r._id, r.count]));
  const costed = (surgery.cost?.[1] ?? 0) > 0;
  const cityRows = cities
    .map((c) => {
      const exp = doctorsIn.get(c.slug) ?? [];
      const [low, high] = tierCost(surgery.cost, c.tier);
      return {
        slug: c.slug,
        name: c.name,
        cost: costed ? ([low, high] as [number, number]) : null,
        surgeons: exp.length,
        hospitals: hospitalsIn.get(c.slug) ?? 0,
        avgExperience: average(exp.filter((n) => n > 0)),
      };
    })
    .filter((c) => c.surgeons > 0 || c.hospitals > 0 || c.slug === citySlug)
    .sort((a, b) => b.surgeons - a.surgeons || a.name.localeCompare(b.name));

  const categories = new Map<string, number>();
  for (const h of hospitals)
    if (h.category) categories.set(h.category, (categories.get(h.category) ?? 0) + 1);
  const exp = surgeons.map((d) => Number(d.experienceYears) || 0).filter((n) => n > 0);

  return {
    state: city.state,
    surgeons: {
      count: surgeons.length,
      top: surgeons.slice(0, 10).map((d) => ({
        slug: d.slug,
        name: d.name,
        experienceYears: Number(d.experienceYears) || 0,
        hospital: d.clinicName ?? '',
        area: isArea(d.area) ? d.area : '',
      })),
      minExperience: exp.length ? Math.min(...exp) : null,
      maxExperience: exp.length ? Math.max(...exp) : null,
      avgExperience: average(exp),
    },
    hospitals: {
      count: hospitals.length,
      top: hospitals.slice(0, 10).map((h) => ({
        slug: h.slug,
        name: h.name,
        category: h.category ?? '',
        area: isArea(h.area) ? h.area : '',
        beds: Number(h.beds) > 0 ? Number(h.beds) : null,
      })),
      categories: [...categories]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name),
    },
    localities: localities.slice(0, 8),
    cities: cityRows,
    nearby: cities
      .filter((c) => c.slug !== citySlug)
      .map((c) => ({ slug: c.slug, name: c.name, km: km(city, c) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5)
      .map(({ slug, name }) => ({ slug, name })),
    related: allSurgeries()
      .filter(
        (s) =>
          s.slug !== surgery.slug &&
          (s.category === surgery.category || s.specialty === surgery.specialty),
      )
      .sort(
        (a, b) =>
          Number(b.category === surgery.category) - Number(a.category === surgery.category) ||
          Number(Boolean(b.popular)) - Number(Boolean(a.popular)) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 6)
      .map((s) => ({ slug: s.slug, name: s.name })),
  };
}

export type SingleSurgery = Awaited<ReturnType<typeof compute>>;

const cache = new Map<string, { at: number; version: number; value: Promise<SingleSurgery> }>();

/** The template's facts for one surgery in one city (cached until the directory changes). */
export function singleSurgery(surgery: SurgeryRecord, citySlug: string) {
  const key = `${surgery.slug}|${citySlug}`;
  const hit = cache.get(key);
  if (hit && hit.version === directoryVersion() && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = compute(surgery, citySlug);
  cache.set(key, { at: Date.now(), version: directoryVersion(), value });
  value.catch(() => cache.delete(key));
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}
