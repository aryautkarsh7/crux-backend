/**
 * Profile and hospital pages read the Doctar record live (fresher than the hourly index, and with the fields
 * the index leaves out: registration number, a hospital's About, services, gallery). Each read is cached;
 * a stale copy is served while it refreshes; a slow or failing Doctar falls back to the index entry.
 */
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import {
  currentMappingContext,
  directoryEnabled,
  doctarSource,
  liveDirectory,
} from './directory.js';
import {
  DOCTOR_DETAIL_FIELDS,
  HOSPITAL_DETAIL_FIELDS,
  SCHEDULE_FIELDS,
  mapDoctor,
  mapHospital,
  type DoctarDoctor,
  type DoctarHospital,
  type DoctarSchedule,
} from './mapping.js';

type Doc = Record<string, any> & { _id: any };
/** Longest a page waits for Doctar before rendering from the index. */
const WAIT_MS = 3000;
const cache = new Map<string, { at: number; value: Doc | null; pending?: Promise<Doc | null> }>();

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Doctar read timed out')), ms).unref(),
    ),
  ]);

/** Cached read with stale-while-revalidate: fresh → cache; stale → cache now, refresh behind; missing → wait (bounded). */
async function cached(
  key: string,
  read: () => Promise<Doc | null>,
): Promise<Doc | null | undefined> {
  const hit = cache.get(key);
  const fresh = hit && Date.now() - hit.at < env.DOCTAR_DETAIL_TTL_SECONDS * 1000;
  if (hit && fresh) return hit.value;
  if (!hit?.pending) {
    const pending = read().then(
      (value) => {
        cache.set(key, { at: Date.now(), value });
        if (cache.size > 5000) cache.delete(cache.keys().next().value!);
        return value;
      },
      (error) => {
        if (hit) cache.set(key, { ...hit, pending: undefined });
        else cache.delete(key);
        throw error;
      },
    );
    // Nobody awaits a background refresh: its failure must not become an unhandled rejection (a crash).
    pending.catch(() => {});
    cache.set(key, { at: hit?.at ?? 0, value: hit?.value ?? null, pending });
  }
  if (hit) return hit.value; // stale: serve now, the refresh runs behind
  try {
    return await withTimeout(cache.get(key)!.pending!, WAIT_MS);
  } catch {
    return undefined; // unknown: caller falls back to the index entry
  }
}

/** Fields Curxx decides (overlay, URL, hospital link) always come from the index entry. */
const KEEP_DOCTOR = [
  'slug',
  'facilitySlug',
  'clinicName',
  'area',
  'rank',
  'rankScore',
  'featured',
  'bookable',
  'phone',
  'whatsapp',
] as const;

/** A Doctar doctor from the index, refreshed from Doctar (profile page). Other records pass through. */
export async function doctorDetail(doc: Doc): Promise<Doc> {
  const src = doctarSource();
  if (doc.source !== 'doctar' || !directoryEnabled() || !src) return doc;
  const id = String(doc.doctarId);
  const fresh = await cached(`doctor:${id}`, async () => {
    if (!Types.ObjectId.isValid(id)) return null;
    const [d] = await src.find(
      'doctors',
      { _id: new Types.ObjectId(id) },
      { projection: DOCTOR_DETAIL_FIELDS, limit: 1 },
    );
    if (!d) return null;
    const schedules = (await src.find(
      'doctorschedules',
      { doctor: d._id },
      { projection: SCHEDULE_FIELDS },
    )) as unknown as DoctarSchedule[];
    const facilities = liveDirectory().facilityByDoctarId;
    const mapped = mapDoctor(
      d as DoctarDoctor,
      schedules,
      (hid) => facilities.get(hid),
      await currentMappingContext(),
      true,
    );
    return 'doc' in mapped ? mapped.doc : null;
  }).catch(() => undefined);
  if (!fresh) return doc;
  const merged: Doc = { ...fresh, _id: doc._id };
  for (const key of KEEP_DOCTOR) merged[key] = doc[key];
  if (doc.photoUrl && !fresh.photoUrl) merged.photoUrl = doc.photoUrl;
  return merged;
}

/** A Doctar hospital from the index, refreshed from Doctar with its page-only fields. */
export async function facilityDetail(doc: Doc): Promise<Doc> {
  const src = doctarSource();
  if (doc.source !== 'doctar' || !directoryEnabled() || !src) return doc;
  const id = String(doc.doctarId);
  const fresh = await cached(`facility:${id}`, async () => {
    if (!Types.ObjectId.isValid(id)) return null;
    const [h] = await src.find(
      'hospitals',
      { _id: new Types.ObjectId(id) },
      { projection: HOSPITAL_DETAIL_FIELDS, limit: 1 },
    );
    if (!h) return null;
    const mapped = mapHospital(h as DoctarHospital, await currentMappingContext(), true);
    return 'doc' in mapped ? mapped.doc : null;
  }).catch(() => undefined);
  if (!fresh) return doc;
  return {
    ...fresh,
    _id: doc._id,
    slug: doc.slug,
    // As in the listing and its filters: departments cleaned with every place name the last build knew.
    departments: doc.departments,
    specialties: doc.specialties,
    rank: doc.rank,
    rankScore: doc.rankScore,
    featured: doc.featured,
    phone: doc.phone || fresh.phone,
    // A photo set in the admin panel wins; Doctar's own only when DOCTAR_SHOW_FACILITY_PHOTOS is on.
    photoUrl: doc.photoUrl || fresh.photoUrl,
  };
}

export const clearDetailCache = () => cache.clear();
