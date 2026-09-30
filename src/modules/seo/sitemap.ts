/**
 * What the website's sitemap lists: only pages with something real on them. Listings with no doctors,
 * city surgery pages that fail the template's index rule, and hidden sample data are all left out.
 */
import {
  cities as allCities,
  conditions as allConditions,
  surgeries as allSurgeries,
} from '../../lib/catalogue-store.js';
import { ArticleModel } from '../../models/article.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { MedicineModel } from '../../models/medicine.model.js';
import { directoryVersion } from '../doctar/directory.js';
import { Doctors, Facilities } from '../doctar/store.js';
import { surgeryStats } from './surgery-stats.js';

const CACHE_MS = 10 * 60 * 1000;

type Dated = { slug: string; updatedAt?: Date | null };
type Listed = Dated & { city: string; specialty: string; area?: string; type?: string };
const dated = (d: Dated) => ({ slug: d.slug, updatedAt: d.updatedAt ?? null });

async function compute() {
  const [doctors, facilities, articles, labTests, medicines] = await Promise.all([
    Doctors.find(
      {},
      { projection: { slug: 1, city: 1, specialty: 1, area: 1, updatedAt: 1 }, sort: { slug: 1 } },
    ) as unknown as Promise<Listed[]>,
    Facilities.find(
      {},
      { projection: { slug: 1, city: 1, type: 1, updatedAt: 1 }, sort: { slug: 1 } },
    ) as unknown as Promise<Listed[]>,
    ArticleModel.find({}, { slug: 1, updatedAt: 1 }).lean(),
    LabTestModel.find({}, { slug: 1, updatedAt: 1 }).lean(),
    MedicineModel.find({}, { slug: 1, updatedAt: 1 }).lean(),
  ]);

  const byCity = (docs: Listed[]) => {
    const m = new Map<string, Listed[]>();
    for (const d of docs) if (d.city) (m.get(d.city) ?? m.set(d.city, []).get(d.city)!).push(d);
    return m;
  };
  const doctorsIn = byCity(doctors);
  const facilitiesIn = byCity(facilities);
  const cities = [];
  for (const city of allCities()) {
    const here = doctorsIn.get(city.slug) ?? [];
    const places = facilitiesIn.get(city.slug) ?? [];
    const surgery = await surgeryStats(city.slug);
    if (!here.length && !places.length && !surgery.indexable) continue;
    const specialties = [...new Set(here.map((d) => d.specialty))].sort();
    // Locality pages that have doctors: "doctors" (all specialties) and each specialty.
    const localities: Record<string, Set<string>> = {};
    for (const d of here) {
      const locality = city.localities.find(
        (l) => l.name.toLowerCase() === (d.area ?? '').toLowerCase(),
      );
      if (!locality) continue;
      for (const key of ['doctors', d.specialty])
        (localities[key] ??= new Set()).add(locality.slug);
    }
    cities.push({
      slug: city.slug,
      doctors: here.length,
      specialties,
      localities: Object.fromEntries(
        Object.entries(localities).map(([k, v]) => [k, [...v].sort()]),
      ),
      conditions: allConditions()
        .filter((c) => specialties.includes(c.specialty))
        .map((c) => c.slug),
      hospitals: places.filter((f) => f.type === 'hospital').length,
      clinics: places.filter((f) => f.type === 'clinic').length,
      /** 2+ hospitals and 3+ surgeons: the city's surgery pages are indexed. */
      surgeries: surgery.indexable ? allSurgeries().map((s) => s.slug) : [],
    });
  }

  return {
    cities,
    india: {
      doctors: doctors.length,
      specialties: [...new Set(doctors.map((d) => d.specialty))].sort(),
    },
    doctors: doctors.map(dated),
    facilities: facilities.map(dated),
    articles: articles.map(dated),
    labTests: labTests.map(dated),
    medicines: medicines.map(dated),
    generatedAt: new Date(),
  };
}

export type SitemapData = Awaited<ReturnType<typeof compute>>;

let cache: { at: number; version: number; value: Promise<SitemapData> } | null = null;

/** URLs per sitemap file (Google's limit is 50,000). */
export const SITEMAP_PART_SIZE = 45_000;

/** Everything except the doctor and hospital lists, which are fetched in parts (sitemapPart). */
export async function sitemapIndex() {
  const { doctors, facilities, ...rest } = await sitemapData();
  return {
    ...rest,
    partSize: SITEMAP_PART_SIZE,
    counts: { doctors: doctors.length, facilities: facilities.length },
  };
}

export async function sitemapPart(kind: 'doctors' | 'facilities', part: number) {
  const list = (await sitemapData())[kind];
  return {
    kind,
    part,
    parts: Math.ceil(list.length / SITEMAP_PART_SIZE),
    entries: list.slice(part * SITEMAP_PART_SIZE, (part + 1) * SITEMAP_PART_SIZE),
  };
}

export function sitemapData() {
  if (cache && Date.now() - cache.at < CACHE_MS && cache.version === directoryVersion())
    return cache.value;
  const value = compute();
  cache = { at: Date.now(), version: directoryVersion(), value };
  value.catch(() => (cache = null));
  return value;
}
