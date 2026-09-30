/**
 * What the website's sitemap lists: only pages with something real on them. Listings with no doctors,
 * city surgery pages that fail the template's index rule, and hidden sample data are all left out.
 */
import { cities as allCities, conditions as allConditions, surgeries as allSurgeries } from '../../lib/catalogue-store.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { surgeryStats } from './surgery-stats.js';

const CACHE_MS = 10 * 60 * 1000;

type Dated = { slug: string; updatedAt?: Date | null };
const dated = (d: Dated) => ({ slug: d.slug, updatedAt: d.updatedAt ?? null });

async function compute() {
  const [doctors, facilities, articles] = await Promise.all([
    DoctorModel.find({}, { slug: 1, city: 1, specialty: 1, area: 1, updatedAt: 1 }).lean(),
    FacilityModel.find({}, { slug: 1, city: 1, type: 1, updatedAt: 1 }).lean(),
    ArticleModel.find({}, { slug: 1, updatedAt: 1 }).lean(),
  ]);

  const cities = [];
  for (const city of allCities()) {
    const here = doctors.filter((d) => d.city === city.slug);
    const places = facilities.filter((f) => f.city === city.slug);
    const surgery = await surgeryStats(city.slug);
    if (!here.length && !places.length && !surgery.indexable) continue;
    const specialties = [...new Set(here.map((d) => d.specialty))].sort();
    // Locality pages that have doctors: "doctors" (all specialties) and each specialty.
    const localities: Record<string, Set<string>> = {};
    for (const d of here) {
      const locality = city.localities.find((l) => l.name.toLowerCase() === (d.area ?? '').toLowerCase());
      if (!locality) continue;
      for (const key of ['doctors', d.specialty]) (localities[key] ??= new Set()).add(locality.slug);
    }
    cities.push({
      slug: city.slug,
      doctors: here.length,
      specialties,
      localities: Object.fromEntries(Object.entries(localities).map(([k, v]) => [k, [...v].sort()])),
      conditions: allConditions().filter((c) => specialties.includes(c.specialty)).map((c) => c.slug),
      hospitals: places.filter((f) => f.type === 'hospital').length,
      clinics: places.filter((f) => f.type === 'clinic').length,
      /** 2+ hospitals and 3+ surgeons: the city's surgery pages are indexed. */
      surgeries: surgery.indexable ? allSurgeries().map((s) => s.slug) : [],
    });
  }

  return {
    cities,
    india: { doctors: doctors.length, specialties: [...new Set(doctors.map((d) => d.specialty))].sort() },
    doctors: doctors.map(dated),
    facilities: facilities.map(dated),
    articles: articles.map(dated),
    generatedAt: new Date(),
  };
}

export type SitemapData = Awaited<ReturnType<typeof compute>>;

let cache: { at: number; value: Promise<SitemapData> } | null = null;

export function sitemapData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = compute();
  cache = { at: Date.now(), value };
  value.catch(() => (cache = null));
  return value;
}
