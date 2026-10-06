/**
 * The numbers behind the copy on /{city}/hospitals ("city hospitals" template, content-spec/07): how many
 * hospitals, by type, area and speciality, plus the category counts the callouts need. Only real listings:
 * the website leaves out any sentence, row or section whose figure is missing.
 */
import { cleanAreaCounts } from '../../lib/areas.js';
import { cities as allCities } from '../../lib/catalogue-store.js';
import { directoryStatus, directoryVersion } from '../doctar/directory.js';
import { Facilities } from '../doctar/store.js';

const CACHE_MS = 10 * 60 * 1000;
/** A speciality name that reads like one: no brackets, digits or sentence-length text. */
const CLEAN_SPECIALITY = /^[A-Za-z][A-Za-z &/'.-]{2,30}$/;

const GOVERNMENT = 'Government Hospital';
const PRIVATE = 'Private Hospital';
const EYE = 'Eye Hospital';
const MATERNITY = 'Maternity Home';
const TEACHING = 'Teaching Hospital';

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

async function compute(citySlug: string) {
  const city = allCities().find((c) => c.slug === citySlug)!;
  const hospitals = await Facilities.find(
    { city: citySlug, type: 'hospital' },
    { projection: { category: 1, area: 1, departments: 1 } },
  );
  const total = hospitals.length;

  const typeCounts = new Map<string, number>();
  for (const h of hospitals)
    if (h.category) typeCounts.set(h.category, (typeCounts.get(h.category) ?? 0) + 1);
  const types = [...typeCounts]
    .map(([name, count]) => ({ name, count, share: pct(count, total) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const of = (name: string) => typeCounts.get(name) ?? 0;

  const areas = cleanAreaCounts(
    hospitals.map((h) => h.area),
    city.name,
    city.localities.map((l) => l.name),
  ).map((a) => ({ ...a, share: pct(a.count, total) }));

  // Hospitals offering each speciality (a hospital counts once per speciality).
  const specCounts = new Map<string, number>();
  for (const h of hospitals)
    for (const d of new Set<string>((h.departments ?? []).map((x: string) => x.trim())))
      if (CLEAN_SPECIALITY.test(d)) specCounts.set(d, (specCounts.get(d) ?? 0) + 1);
  const specialities = [...specCounts]
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const status = directoryStatus();
  return {
    city: { slug: city.slug, name: city.name, tier: city.tier },
    total,
    types,
    areas,
    areaCount: areas.length,
    specialities,
    specialityCount: specialities.length,
    governmentCount: of(GOVERNMENT),
    privateCount: of(PRIVATE),
    eyeCount: of(EYE),
    maternityCount: of(MATERNITY),
    teachingCount: of(TEACHING),
    /** When the listings were last read from the source (not when each hospital last changed). */
    refreshedAt: status.builtAt,
    generatedAt: new Date(),
  };
}

export type HospitalStats = Awaited<ReturnType<typeof compute>>;

const cache = new Map<string, { at: number; value: Promise<HospitalStats> }>();
let cacheVersion = -1;

export function hospitalStats(city: string) {
  if (cacheVersion !== directoryVersion()) {
    cache.clear();
    cacheVersion = directoryVersion();
  }
  const hit = cache.get(city);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = compute(city);
  cache.set(city, { at: Date.now(), value });
  value.catch(() => cache.delete(city));
  return value;
}
