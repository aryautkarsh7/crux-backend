/**
 * The Doctar directory: every Doctar doctor and hospital that maps onto Curxx (see mapping.ts), held in
 * memory as a lean listing index and rebuilt in the background. Listings, filters, facets, SEO figures,
 * search and the sitemap read it, so no page waits on Doctar.
 * - Built by paging through Doctar (small projections, retries); swapped in only when complete.
 * - The last good index is saved gzipped in the Curxx DB (directory_cache) and loaded at start-up, so a
 *   restart serves listings at once, even while Doctar is unreachable. Both stream (cache.ts).
 * - Curxx-only settings (doctar_overlays: ranking, hiding, featuring, booking, contact overrides) are
 *   applied on top, and re-applied as soon as the admin changes one.
 * - Peak memory during a build is logged, to size the final server.
 */
import { env } from '../../config/env.js';
import { cities as allCities } from '../../lib/catalogue-store.js';
import { matches } from '../../lib/query-match.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { withSampleData } from '../../lib/sample-data.js';
import {
  DOCTOR_INDEX_FIELDS,
  HOSPITAL_INDEX_FIELDS,
  SCHEDULE_FIELDS,
  mapDoctor,
  mapHospital,
  mappingContext,
  matchingPlaces,
  type DoctarDoctor,
  type DoctarHospital,
  type DoctarSchedule,
  type DoctorDoc,
  type FacilityDoc,
  type MappingContext,
} from './mapping.js';
import { loadCache, saveCache } from './cache.js';
import { DoctarOverlayModel } from './models.js';
import { mongoDoctarSource, type DoctarSource } from './source.js';

type Doc = Record<string, unknown>;

export type DirectoryStatus = 'disabled' | 'loading' | 'ready' | 'unavailable';

export type Index = {
  doctors: DoctorDoc[];
  facilities: FacilityDoc[];
  builtAt: Date;
  /** Where the current index came from: a Doctar read, or the saved cache after a restart. */
  from: 'doctar' | 'cache';
  report: BuildReport | null;
};

export type BuildReport = {
  scanned: number;
  doctors: number;
  facilities: number;
  skippedDoctors: Record<string, number>;
  skippedFacilities: Record<string, number>;
  seconds: number;
  peakRssMb: number;
  peakHeapMb: number;
  capped: boolean;
};

/** What the website reads: the index with overlays applied, hidden records removed, plus lookups. */
type Live = {
  doctors: DoctorDoc[];
  facilities: FacilityDoc[];
  doctorBySlug: Map<string, DoctorDoc>;
  facilityBySlug: Map<string, FacilityDoc>;
  doctorsByCity: Map<string, DoctorDoc[]>;
  doctorsByFacility: Map<string, DoctorDoc[]>;
  facilitiesByCity: Map<string, FacilityDoc[]>;
  facilityByDoctarId: Map<string, FacilityDoc>;
};

const EMPTY_LIVE: Live = {
  doctors: [],
  facilities: [],
  doctorBySlug: new Map(),
  facilityBySlug: new Map(),
  doctorsByCity: new Map(),
  doctorsByFacility: new Map(),
  facilitiesByCity: new Map(),
  facilityByDoctarId: new Map(),
};

let source: DoctarSource | null = null;
let index: Index | null = null;
let live: Live = EMPTY_LIVE;
let version = 0;
let status: DirectoryStatus = 'disabled';
let building: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;
let lastError = '';
let enabled = false;

const log = (line: string) => {
  if (env.NODE_ENV !== 'test') console.info(`[doctar] ${line}`);
};

/** Tests (and scripts) swap in a source; `null` turns the directory off. */
export function useDoctarSource(next: DoctarSource | null) {
  source = next;
  enabled = Boolean(next);
  index = null;
  live = EMPTY_LIVE;
  version += 1;
  status = next ? 'loading' : 'disabled';
  lastError = '';
}

export const directoryEnabled = () => enabled;
export const directoryStatus = () => ({
  status,
  builtAt: index?.builtAt ?? null,
  from: index?.from ?? null,
  error: lastError,
  report: index?.report ?? null,
  doctors: live.doctors.length,
  facilities: live.facilities.length,
});
/** True when Doctar listings should be there but aren't yet (cold start with Doctar down). */
/** On, but no Doctar doctors to show yet (first build still running with no saved copy, or Doctar unreachable). */
export const directoryUnavailable = () => enabled && !index;
/** Changes whenever the website's Doctar records change, so caches built from them can start again. */
export const directoryVersion = () => version;
export const liveDirectory = () => live;
/** Everything read from Doctar before overlays (hidden records included), for the admin panel. */
export const directoryIndex = () => index;
export const doctarSource = () => source;

// ---------------------------------------------------------------- Build

let context: { at: number; value: Promise<MappingContext> } | null = null;
/** The city and location names Doctar uses (read by the last build), all of them places for the mapping. */
let doctarPlaces: unknown[] = [];
/** Curxx's cities and specialties, Doctar's place names and the settings, for the mapping; reused for 10 minutes. */
export function currentMappingContext() {
  if (!context || Date.now() - context.at > 10 * 60_000) {
    context = {
      at: Date.now(),
      value: SpecialtyModel.find({}, { slug: 1, name: 1 })
        .lean()
        .then((specialties) =>
          mappingContext(allCities(), specialties, {
            places: doctarPlaces,
            facilityPhotos: env.DOCTAR_SHOW_FACILITY_PHOTOS,
          }),
        ),
    };
    context.value.catch(() => (context = null));
  }
  return context.value;
}

async function retry<T>(what: string, read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (attempt === 3) throw error;
      log(
        `${what}: ${String((error as Error)?.message ?? error)
          .replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')
          .slice(0, 120)}; retrying (${attempt}/2)`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/** Pages through a Doctar collection by _id, so a dropped connection only repeats one page. */
async function* pages(
  src: DoctarSource,
  collection: 'doctors' | 'hospitals',
  filter: Doc,
  projection: Doc,
) {
  for (let last: unknown; ;) {
    const after = last;
    const page = await retry(collection, () =>
      src.find(collection, after ? { ...filter, _id: { $gt: after } } : filter, {
        projection,
        sort: { _id: 1 },
        limit: env.DOCTAR_PAGE_SIZE,
      }),
    );
    if (!page.length) return;
    last = page.at(-1)!._id;
    yield page;
    if (page.length < env.DOCTAR_PAGE_SIZE) return;
  }
}

const tally = (map: Record<string, number>, key: string) => (map[key] = (map[key] ?? 0) + 1);

/** Reads Doctar and maps it (no writes anywhere). Exported for the read-only report script. */
export async function buildIndex(src: DoctarSource): Promise<Index> {
  const started = Date.now();
  let peakRss = 0;
  let peakHeap = 0;
  const sample = () => {
    const m = process.memoryUsage();
    peakRss = Math.max(peakRss, m.rss);
    peakHeap = Math.max(peakHeap, m.heapUsed);
  };
  sample();
  // Every place Doctar names. Only those spelled like a Curxx city are read (indexed on city / location), but
  // all of them are places the mapping cuts off speciality names ("Oral Surgeon In Agra" → "Oral Surgeon").
  const [hospitalCities, doctorLocations] = await Promise.all([
    retry('hospital cities', () => src.distinct('hospitals', 'city')),
    retry('doctor locations', () => src.distinct('doctors', 'location')),
  ]);
  doctarPlaces = [...hospitalCities, ...doctorLocations];
  context = null;
  const ctx = await currentMappingContext();
  const hospitalPlaces = matchingPlaces(ctx, hospitalCities);
  const doctorPlaces = matchingPlaces(ctx, doctorLocations);

  const skippedFacilities: Record<string, number> = {};
  const facilityById = new Map<string, FacilityDoc>();
  for await (const page of pages(
    src,
    'hospitals',
    { city: { $in: hospitalPlaces } },
    HOSPITAL_INDEX_FIELDS,
  )) {
    for (const h of page) {
      const mapped = mapHospital(h as DoctarHospital, ctx);
      if ('skip' in mapped) tally(skippedFacilities, mapped.skip);
      else facilityById.set(String(h._id), mapped.doc);
    }
    sample();
  }

  const skippedDoctors: Record<string, number> = {};
  const doctors: DoctorDoc[] = [];
  let scanned = 0;
  let capped = false;
  const doctorFilter: Doc = {
    location: { $in: doctorPlaces },
    ...(env.DOCTAR_VERIFIED_ONLY ? { isAdminVerified: true } : {}),
  };
  outer: for await (const page of pages(src, 'doctors', doctorFilter, DOCTOR_INDEX_FIELDS)) {
    const ids = page.map((d) => d._id);
    const schedules = (await retry('schedules', () =>
      src.find('doctorschedules', { doctor: { $in: ids } }, { projection: SCHEDULE_FIELDS }),
    )) as unknown as DoctarSchedule[];
    const schedulesOf = new Map<string, DoctarSchedule[]>();
    for (const s of schedules)
      (
        schedulesOf.get(String(s.doctor)) ??
        schedulesOf.set(String(s.doctor), []).get(String(s.doctor))!
      ).push(s);
    for (const d of page) {
      scanned += 1;
      const mapped = mapDoctor(
        d as DoctarDoctor,
        schedulesOf.get(String(d._id)) ?? [],
        (id) => facilityById.get(id),
        ctx,
      );
      if ('skip' in mapped) {
        tally(skippedDoctors, mapped.skip);
        continue;
      }
      doctors.push(mapped.doc);
      if (env.DOCTAR_MAX_DOCTORS && doctors.length >= env.DOCTAR_MAX_DOCTORS) {
        capped = true;
        break outer;
      }
    }
    sample();
  }

  // Hospitals list the specialties of the doctors who consult there.
  const facilityBySlug = new Map([...facilityById.values()].map((f) => [f.slug, f]));
  for (const d of doctors) {
    const f = d.facilitySlug ? facilityBySlug.get(d.facilitySlug) : undefined;
    if (f && !(f.specialties as string[]).includes(d.specialty))
      (f.specialties as string[]).push(d.specialty);
  }
  sample();
  const facilities = [...facilityById.values()];
  const report: BuildReport = {
    scanned,
    doctors: doctors.length,
    facilities: facilities.length,
    skippedDoctors,
    skippedFacilities,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    peakRssMb: Math.round(peakRss / 1e6),
    peakHeapMb: Math.round(peakHeap / 1e6),
    capped,
  };
  // Plain string ids, as in the saved copy. Set in place: the records are this build's own, and copying
  // every one of them would briefly hold the index twice.
  for (const d of doctors) d._id = String(d._id);
  for (const f of facilities) f._id = String(f._id);
  return {
    doctors,
    facilities,
    builtAt: new Date(),
    from: 'doctar',
    report,
  };
}

// ---------------------------------------------------------------- Overlays and lookups

/** rank 1 → the highest score, as the admin rankings do for Curxx records. */
const rankScoreOf = (rank: number) => (rank > 0 ? 100_000 - rank : null);

/** Applies overlays and unique slugs, drops hidden records, and builds the lookups. */
async function publish() {
  if (!index) {
    live = EMPTY_LIVE;
    return;
  }
  const overlays = await DoctarOverlayModel.find({}).lean();
  const byKey = new Map(overlays.map((o) => [`${o.kind}:${o.doctarId}`, o]));
  // Curxx's own records keep their URLs: a Doctar record with the same slug gets a short id suffix.
  const [curxxDoctorSlugs, curxxFacilitySlugs] = await withSampleData(() =>
    Promise.all([
      DoctorModel.distinct('slug', { source: { $ne: 'doctar' } }),
      FacilityModel.distinct('slug', { source: { $ne: 'doctar' } }),
    ]),
  );
  const apply = <T extends DoctorDoc | FacilityDoc>(
    docs: T[],
    kind: 'doctor' | 'facility',
    taken: Set<string>,
  ): T[] => {
    const out: T[] = [];
    for (const base of docs) {
      const o = byKey.get(`${kind}:${base.doctarId}`);
      if (o?.hidden) continue;
      let doc = base;
      if (o || taken.has(base.slug)) {
        doc = { ...base };
        if (taken.has(doc.slug)) doc.slug = `${doc.slug}-${String(doc.doctarId).slice(-6)}`;
        if (o) {
          doc.rankScore = rankScoreOf(o.rank ?? 0);
          doc.rank = o.rank ?? 0;
          doc.featured = Boolean(o.featured);
          if (o.bookable === false) doc.bookable = false;
          if (o.phone) doc.phone = o.phone;
          if (o.whatsapp) doc.whatsapp = o.whatsapp;
          if (o.photoUrl) doc.photoUrl = o.photoUrl;
        }
      }
      taken.add(doc.slug);
      out.push(doc);
    }
    return out;
  };
  const facilities = apply(index.facilities, 'facility', new Set(curxxFacilitySlugs as string[]));
  // A doctor links to its hospital by slug: follow the hospital if its slug changed, drop the link if hidden.
  const baseIdBySlug = new Map(index.facilities.map((f) => [f.slug, String(f.doctarId)]));
  const shownSlugById = new Map(facilities.map((f) => [String(f.doctarId), f.slug]));
  const doctors = apply(index.doctors, 'doctor', new Set(curxxDoctorSlugs as string[])).map((d) => {
    if (!d.facilitySlug) return d;
    const slug = shownSlugById.get(baseIdBySlug.get(d.facilitySlug) ?? '') ?? '';
    return slug === d.facilitySlug ? d : { ...d, facilitySlug: slug };
  });
  const group = <T>(docs: T[], key: (d: T) => string | undefined) => {
    const m = new Map<string, T[]>();
    for (const d of docs) {
      const k = key(d);
      if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(d);
    }
    return m;
  };
  version += 1;
  live = {
    doctors,
    facilities,
    doctorBySlug: new Map(doctors.map((d) => [d.slug, d])),
    facilityBySlug: new Map(facilities.map((f) => [f.slug, f])),
    doctorsByCity: group(doctors, (d) => d.city),
    doctorsByFacility: group(doctors, (d) => d.facilitySlug),
    facilitiesByCity: group(facilities, (f) => f.city),
    facilityByDoctarId: new Map(facilities.map((f) => [String(f.doctarId), f])),
  };
}

/** Re-applies overlays after an admin change (no Doctar read). */
export async function refreshOverlays() {
  if (enabled) await publish();
}

/** Records in memory matching a MongoDB filter (fast paths for slug and city). */
export function directoryMatches<T extends DoctorDoc | FacilityDoc>(
  kind: 'doctors' | 'facilities',
  filter: Doc,
): T[] {
  const bySlug = kind === 'doctors' ? live.doctorBySlug : live.facilityBySlug;
  const byCity = kind === 'doctors' ? live.doctorsByCity : live.facilitiesByCity;
  let candidates: (DoctorDoc | FacilityDoc)[] = kind === 'doctors' ? live.doctors : live.facilities;
  const slugIn = (filter.slug as { $in?: unknown } | undefined)?.$in;
  if (typeof filter.slug === 'string') {
    const hit = bySlug.get(filter.slug);
    candidates = hit ? [hit] : [];
  } else if (Array.isArray(slugIn) && slugIn.every((s) => typeof s === 'string')) {
    candidates = [...new Set(slugIn as string[])]
      .map((s) => bySlug.get(s))
      .filter((d): d is DoctorDoc | FacilityDoc => Boolean(d));
  } else if (kind === 'doctors' && typeof filter.facilitySlug === 'string')
    candidates = live.doctorsByFacility.get(filter.facilitySlug) ?? [];
  else if (typeof filter.city === 'string') candidates = byCity.get(filter.city) ?? [];
  return candidates.filter((d) => matches(d, filter)) as T[];
}

// ---------------------------------------------------------------- Lifecycle

/** Rebuilds from Doctar; on failure the previous index keeps serving. Concurrent calls share one build. */
export function refreshDirectory(): Promise<void> {
  if (!enabled || !source) return Promise.resolve();
  if (building) return building;
  const src = source;
  building = (async () => {
    try {
      const next = await buildIndex(src);
      if (src !== source) return; // switched while building (tests)
      index = next;
      await publish();
      status = 'ready';
      lastError = '';
      const r = next.report!;
      log(
        `index built in ${r.seconds}s: ${r.doctors} doctors (${r.scanned} scanned${r.capped ? ', capped by DOCTAR_MAX_DOCTORS' : ''}), ${r.facilities} hospitals · peak memory ${r.peakRssMb} MB RSS / ${r.peakHeapMb} MB heap`,
      );
      await saveCache(next).then(
        (saved) =>
          log(
            `cache saved: ${(saved.bytes / 1e6).toFixed(1)} MB gzipped in ${saved.parts} part(s)`,
          ),
        (error) => log(`cache not saved: ${(error as Error).message}`),
      );
    } catch (error) {
      lastError = String((error as Error)?.message ?? error)
        .replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')
        .slice(0, 200);
      if (!index) status = 'unavailable';
      log(
        `build failed (${index ? 'still serving the previous index' : 'no index yet'}): ${lastError}`,
      );
    } finally {
      building = null;
    }
  })();
  return building;
}

/** Serves the last index saved in the Curxx DB, if there is one (start-up, or Doctar down with nothing loaded). */
export async function loadSavedIndex() {
  if (!enabled || index) return false;
  try {
    const cached = await loadCache();
    if (!cached || index) return false;
    // A copy saved while Doctar's hospital photos were on doesn't bring them back once they're off.
    if (!env.DOCTAR_SHOW_FACILITY_PHOTOS) for (const f of cached.facilities) f.photoUrl = '';
    index = cached;
    await publish();
    status = 'ready';
    log(
      `serving the saved index from ${cached.builtAt.toISOString()} (${cached.doctors.length} doctors) until the rebuild finishes`,
    );
    return true;
  } catch (error) {
    log(`saved index not loaded: ${(error as Error).message}`);
    return false;
  }
}

/** Start-up: load the saved index (served at once), then rebuild in the background and on a timer. */
export async function startDirectory() {
  if (!env.DOCTAR_ENABLED || !env.DOCTAR_DB_URL) {
    status = 'disabled';
    return;
  }
  if (!source)
    useDoctarSource(
      mongoDoctarSource(env.DOCTAR_DB_URL, {
        poolSize: env.DOCTAR_POOL_SIZE,
        timeoutMs: env.DOCTAR_TIMEOUT_MS,
      }),
    );
  await loadSavedIndex();
  void refreshDirectory();
  timer = setInterval(() => void refreshDirectory(), env.DOCTAR_REFRESH_MINUTES * 60_000);
  timer.unref();
}

export async function stopDirectory() {
  if (timer) clearInterval(timer);
  timer = null;
  await building?.catch(() => {});
  await source?.close();
}
