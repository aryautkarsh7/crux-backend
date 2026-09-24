import mongoose from 'mongoose';
import { CITIES, type City } from '../db/data/cities.js';
import { CONDITIONS, type ConditionSeed } from '../db/data/conditions.js';
import { SURGERIES, SURGERY_CATEGORIES, type SurgerySeed } from '../db/data/surgeries.js';
import { CityModel, ConditionModel, SurgeryModel } from '../models/catalogue.model.js';
import { ContentModel } from '../models/site.model.js';

/**
 * Cities, conditions and surgeries as the routes see them: read from MongoDB (where the admin panel
 * edits them) and held in memory, because they are needed synchronously on almost every request.
 * Reloaded at most once a minute, and straight away after an admin edit. Until the database has
 * them (a fresh install before the first catalogue sync) the code data in db/data is used.
 */

export type CityRecord = City & { popularOrder?: number };
export type ConditionRecord = ConditionSeed & { popularOrder?: number };
export type SurgeryRecord = SurgerySeed;

/** Content record holding the order of surgery categories on /{city}/surgeries. */
export const SURGERY_CATEGORIES_SLUG = 'catalogue-surgery-categories';

const TTL_MS = 60_000;

function build(cities: CityRecord[], conditions: ConditionRecord[], surgeries: SurgeryRecord[], categoryOrder: string[]) {
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));
  const aliasToSlug = new Map(cities.flatMap((c) => c.aliases.map((a) => [a.toLowerCase(), c.slug] as const)));
  const localityByPin = new Map<string, { city: string; area: string; lat: number; lng: number }>();
  for (const city of cities) for (const l of city.localities) if (l.pincode && !localityByPin.has(l.pincode)) localityByPin.set(l.pincode, { city: city.slug, area: l.name, lat: l.lat, lng: l.lng });
  const surgeryCategories = [...new Set([...categoryOrder, ...surgeries.map((s) => s.category)])].filter((c) => surgeries.some((s) => s.category === c));
  return {
    cities,
    conditions,
    surgeries,
    surgeryCategories,
    cityBySlug,
    aliasToSlug,
    localityByPin,
    conditionBySlug: new Map(conditions.map((c) => [c.slug, c])),
    surgeryBySlug: new Map(surgeries.map((s) => [s.slug, s])),
  };
}

let snapshot = build(CITIES, CONDITIONS, SURGERIES, SURGERY_CATEGORIES);
let loadedAt = 0;
let loading: Promise<void> | null = null;

const plain = <T>(docs: Record<string, unknown>[]) => docs.map(({ _id: _i, managed: _m, createdAt: _c, updatedAt: _u, order: _o, ...rest }) => rest as T);

async function load() {
  const [cities, conditions, surgeries, categories] = await Promise.all([
    CityModel.find().sort({ order: 1, name: 1 }).lean(),
    ConditionModel.find().sort({ order: 1, name: 1 }).lean(),
    SurgeryModel.find().sort({ order: 1, name: 1 }).lean(),
    ContentModel.findOne({ slug: SURGERY_CATEGORIES_SLUG }, { items: 1 }).lean(),
  ]);
  const conditionRecords = plain<ConditionRecord>(conditions).map((c) => ({ ...c, popular: c.popular || undefined }));
  snapshot = build(
    cities.length ? plain<CityRecord>(cities) : CITIES,
    conditions.length ? conditionRecords : CONDITIONS,
    surgeries.length ? plain<SurgeryRecord>(surgeries) : SURGERIES,
    (categories?.items as string[] | undefined)?.filter((c) => typeof c === 'string') ?? SURGERY_CATEGORIES,
  );
  loadedAt = Date.now();
}

/** Reloads from the database when the copy in memory is older than a minute. Never throws. */
export async function ensureCatalogueFresh() {
  if (Date.now() - loadedAt < TTL_MS || mongoose.connection.readyState !== 1) return;
  loading ??= load()
    .catch(() => {
      // Keep serving the previous copy; try again on a later request.
      loadedAt = Date.now() - TTL_MS + 5_000;
    })
    .finally(() => {
      loading = null;
    });
  await loading;
}

/** After an admin edit: the next request reloads. */
export async function reloadCatalogue() {
  loadedAt = 0;
  await ensureCatalogueFresh();
}

export const cities = () => snapshot.cities;
export const conditions = () => snapshot.conditions;
export const surgeries = () => snapshot.surgeries;
export const surgeryCategories = () => snapshot.surgeryCategories;
export const cityBySlug = (slug: string) => snapshot.cityBySlug.get(slug);
export const conditionBySlug = (slug: string) => snapshot.conditionBySlug.get(slug);
export const surgeryBySlug = (slug: string) => snapshot.surgeryBySlug.get(slug);
export const localityByPin = (pincode: string) => snapshot.localityByPin.get(pincode);

/** URL segment → canonical city slug, following aliases (bengaluru → bangalore). */
export function resolveCitySlug(input: string) {
  const s = input.toLowerCase();
  if (snapshot.cityBySlug.has(s)) return s;
  return snapshot.aliasToSlug.get(s) ?? null;
}

/** Popular cities first (by popularOrder), then the rest alphabetically. */
export const popularCitySlugs = () =>
  snapshot.cities.filter((c) => (c.popularOrder ?? 0) > 0).sort((a, b) => a.popularOrder! - b.popularOrder!).map((c) => c.slug);
