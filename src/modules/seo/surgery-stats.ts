/**
 * The numbers behind /{city}/surgeries and /india/surgeries ("for all surgery card page" template).
 * Procedures and costs are the same catalogue everywhere (tier-2 cities are ~15% cheaper, as on the
 * surgery cards); hospitals and surgeons are counted per city.
 */
import { PROCEDURE_DIRECTORY } from '../../db/data/procedure-directory.js';
import { cities as allCities, surgeries as allSurgeries } from '../../lib/catalogue-store.js';
import { directoryVersion } from '../doctar/directory.js';
import { Doctors, Facilities } from '../doctar/store.js';

/** Specialties counted as surgeons: the six in the template's surgeon table, plus any "…-surgeon". */
const SURGEON_TABLE = ['general-surgeon', 'orthopedist', 'urologist', 'gynecologist', 'ent-specialist', 'ophthalmologist'];
const isSurgical = (slug: string) => SURGEON_TABLE.includes(slug) || slug.endsWith('-surgeon');
const CACHE_MS = 10 * 60 * 1000;

/** Same rounding as the surgery cards (catalogue.routes cityCost). */
const tierCost = (cost: number[], tier: number): [number, number] => {
  const f = tier === 1 ? 1 : 0.85;
  const round = (n: number) => Math.round((n * f) / 500) * 500;
  return [round(cost[0] ?? 0), round(cost[1] ?? 0)];
};

/** Day care: no overnight stay. Short stay: one day or less. */
function stayKind(stay: string) {
  const s = stay.toLowerCase();
  const sameDay = /day care|daycare|same day|day procedure|day visit/.test(s);
  if (sameDay && !/\b1\s*day\b|night/.test(s)) return 'daycare';
  if (sameDay || /^1 day$|^1 night$/.test(s.trim())) return 'short';
  return 'longer';
}

const normalise = (name: string) => name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function compute(city: string | null) {
  const cityInfo = city ? allCities().find((c) => c.slug === city) : null;
  const tier = cityInfo?.tier ?? 1;
  const costed = allSurgeries().filter((s) => (s.cost?.[1] ?? 0) > 0);
  const procedures = costed.map((s) => {
    // India pages quote the widest range: the tier-2 low end to the metro high end.
    const [low, high] = city ? tierCost(s.cost, tier) : [tierCost(s.cost, 2)[0], tierCost(s.cost, 1)[1]];
    return { slug: s.slug, name: s.name, category: s.category, stay: s.stay ?? '', low, high, kind: stayKind(s.stay ?? '') };
  });
  const byLow = [...procedures].sort((a, b) => a.low - b.low);
  const byHigh = [...procedures].sort((a, b) => b.high - a.high);
  const daycare = procedures.filter((p) => p.kind === 'daycare');
  const bands = [
    { label: 'under ₹50,000', count: procedures.filter((p) => p.low < 50_000).length },
    { label: 'between ₹50,000 and ₹99,999', count: procedures.filter((p) => p.low >= 50_000 && p.low < 100_000).length },
    { label: 'between ₹1,00,000 and ₹1,99,999', count: procedures.filter((p) => p.low >= 100_000 && p.low < 200_000).length },
    { label: 'at ₹2,00,000 or more', count: procedures.filter((p) => p.low >= 200_000).length },
  ].filter((b) => b.count > 0);

  const hospitalFilter: Record<string, unknown> = { type: 'hospital' };
  if (city) hospitalFilter.city = city;
  const surgeonFilter: Record<string, unknown> = {};
  if (city) surgeonFilter.city = city;
  const [hospitals, doctors] = await Promise.all([
    Facilities.find(hospitalFilter, { projection: { slug: 1, name: 1, city: 1, area: 1, rating: 1, rankScore: 1, nabh: 1, beds: 1, departments: 1 }, sort: { rankScore: -1, rating: -1, slug: 1 } }),
    Doctors.find(surgeonFilter, { projection: { specialty: 1, city: 1, facilitySlug: 1, experienceYears: 1 } }),
  ]);
  const surgeons = doctors.filter((d) => isSurgical(d.specialty));
  const surgeonsAt = new Map<string, number>();
  for (const d of surgeons) if (d.facilitySlug) surgeonsAt.set(d.facilitySlug, (surgeonsAt.get(d.facilitySlug) ?? 0) + 1);

  const areaCounts = new Map<string, number>();
  for (const h of hospitals) if (h.area) areaCounts.set(h.area, (areaCounts.get(h.area) ?? 0) + 1);
  const areas = [...areaCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const surgeonTable = SURGEON_TABLE.map((slug) => {
    const group = surgeons.filter((d) => d.specialty === slug);
    const withExp = group.filter((d) => d.experienceYears > 0);
    return { slug, count: group.length, avgExperience: withExp.length ? Math.round(withExp.reduce((n, d) => n + d.experienceYears, 0) / withExp.length) : null };
  }).filter((r) => r.count > 0);

  // Procedures from the complete list with no cost data yet (matched loosely by name).
  const known = procedures.map((p) => normalise(p.name));
  const directory = PROCEDURE_DIRECTORY.map((g) => ({
    category: g.category,
    procedures: g.procedures.filter((name) => {
      const n = normalise(name);
      return !known.some((k) => k === n || (k.length > 5 && n.startsWith(k)) || (n.length > 5 && k.startsWith(n)));
    }),
  })).filter((g) => g.procedures.length);

  const cityRows = city
    ? []
    : allCities()
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          hospitals: hospitals.filter((h) => h.city === c.slug).length,
          surgeons: surgeons.filter((d) => d.city === c.slug).length,
        }))
        .filter((c) => c.hospitals > 0 || c.surgeons > 0)
        .sort((a, b) => b.hospitals - a.hospitals || b.surgeons - a.surgeons || a.name.localeCompare(b.name));

  return {
    city: cityInfo ? { slug: cityInfo.slug, name: cityInfo.name } : null,
    hospitalCount: hospitals.length,
    surgeonCount: surgeons.length,
    procedureCount: procedures.length,
    categoryCount: new Set(procedures.map((p) => p.category)).size,
    minCost: byLow[0]?.low ?? null,
    maxCost: byHigh[0]?.high ?? null,
    cheapest: byLow[0]?.name ?? null,
    priciest: byHigh[0]?.name ?? null,
    costBands: bands,
    shortStayCount: procedures.filter((p) => p.kind !== 'longer').length,
    daycareCount: daycare.length,
    daycare: daycare.map((p) => ({ slug: p.slug, name: p.name })),
    hospitals: hospitals.slice(0, 10).map((h) => ({
      slug: h.slug,
      name: h.name,
      area: h.area,
      city: h.city,
      surgeons: surgeonsAt.get(h.slug) ?? 0,
      departments: (h.departments ?? []).slice(0, 3),
      nabh: Boolean(h.nabh),
      beds: h.beds && h.beds > 0 ? h.beds : null,
    })),
    areas,
    surgeonTable,
    cities: cityRows,
    cityCount: cityRows.filter((c) => c.hospitals > 0).length,
    directory,
    /** Template rule: index a city page only with at least 2 hospitals and 3 surgeons. */
    indexable: city ? hospitals.length >= 2 && surgeons.length >= 3 : true,
    generatedAt: new Date(),
  };
}

export type SurgeryStats = Awaited<ReturnType<typeof compute>>;

const cache = new Map<string, { at: number; value: Promise<SurgeryStats> }>();
let cacheVersion = -1;

export function surgeryStats(city: string | null) {
  if (cacheVersion !== directoryVersion()) {
    cache.clear();
    cacheVersion = directoryVersion();
  }
  const key = city ?? 'india';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = compute(city);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

export const clearSurgeryStats = () => cache.clear();
