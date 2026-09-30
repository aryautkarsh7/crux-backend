/**
 * Imports admin-verified doctors from Doctar's database (DOCTAR_DB_URL), plus the hospitals and clinics
 * they consult at, into Curxx's `doctors` and `facilities` collections (MONGODB_URI).
 *
 *   npm run import:doctar -- --dry-run --limit 20
 *   npm run import:doctar -- --limit 20 --db curxx-dev      (writes: --db must name the target database)
 *   npm run import:doctar -- --only facilities --db curxx-dev
 *
 * - Switching from Doctar staging to production only means changing DOCTAR_DB_URL.
 * - Practo-scraped records (still present in Doctar staging) are skipped; see PRACTO below.
 * - Doctar is read-only: the script only ever calls find / aggregate / countDocuments there.
 * - Re-running is safe: records are upserted by `doctarId` and keep the slug they were given first.
 * - Imported doctors are listing-only (`bookable: false`), start with no rating or reviews, and are
 *   marked `source: 'doctar'` so the catalogue sync never overwrites or deletes them.
 * - Anything messy (no gender, no qualification, unmatched city or specialty, organisation instead of
 *   a person…) is skipped and counted in the summary rather than guessed.
 */
import 'dotenv/config';
import mongoose, { type Types } from 'mongoose';
import { describeSchedule, type Schedule, type Session } from '../src/db/data/doctor-network.js';
import { FACILITY_TYPES } from '../src/db/data/facility-network.js';
import { withSampleData } from '../src/lib/sample-data.js';
import { CityModel } from '../src/models/catalogue.model.js';
import { DoctorModel } from '../src/models/doctor.model.js';
import { FacilityModel } from '../src/models/facility.model.js';
import { SpecialtyModel } from '../src/models/specialty.model.js';

// ---------------------------------------------------------------- Options

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const DRY_RUN = args.includes('--dry-run');
const LIMIT = flag('--limit') === undefined ? Infinity : Number(flag('--limit'));
const ONLY = flag('--only') as 'doctors' | 'facilities' | undefined;
/** Writes must name the Curxx database they expect (e.g. --db curxx-dev), so a wrong MONGODB_URI can't hit live. */
const CONFIRM_DB = flag('--db');
if (!(LIMIT === Infinity || (Number.isInteger(LIMIT) && LIMIT > 0))) throw new Error('--limit takes a positive whole number');
if (ONLY && ONLY !== 'doctors' && ONLY !== 'facilities') throw new Error('--only takes "doctors" or "facilities"');

// ---------------------------------------------------------------- Mapping rules (agreed with the team)

/** Doctar specialisations with no identical Curxx slug. Anything else unmatched is skipped. */
const SPECIALTY_ALIASES: Record<string, string> = {
  'orthopaedic-surgeon': 'orthopedist',
  'spine-surgeon': 'orthopedist',
  'gynaecologist-obstetric-surgeon': 'gynecologist',
  'laparoscopic-surgeon-obs-and-gyn': 'gynecologist',
  'oncology-surgeon': 'oncologist',
  'maxillofacial-surgeon': 'dentist',
  'dental-surgeon': 'dentist',
  'fertility-ivf-surgeon': 'fertility-infertility-specialist',
  'urology-surgeon': 'urologist',
  'dermatosurgeon': 'dermatologist',
  'ent-surgeon': 'ent-specialist',
  'ophthalmic-surgeon': 'ophthalmologist',
  'laparoscopic-surgeon': 'general-surgeon',
  'bariatric-surgeon': 'general-surgeon',
  'colorectal-surgeon': 'general-surgeon',
};

/** Places Doctar lists separately that belong to a Curxx city (on top of city names and aliases). */
const CITY_ALIASES: Record<string, string> = {
  'secunderabad': 'hyderabad',
  'kukatpalli': 'hyderabad',
  'greater-noida': 'noida',
  'bhubaneshwar': 'bhubaneswar',
  'cochin': 'kochi',
  'ernakulam': 'kochi',
  'new-delhi': 'delhi',
  'dwarka': 'delhi',
  'karol-bagh': 'delhi',
  'ambattur': 'chennai',
  'borivli': 'mumbai',
};

/** Doctar facility type → one of Curxx's 19 facility types. Unlisted (gyms, pharmacies, stores…) are skipped. */
const FACILITY_CATEGORY: Record<string, string> = {
  ...Object.fromEntries(['hospital', 'general-hospital', 'private-hospital', 'medical-center'].map((t) => [t, 'Private Hospital'])),
  'multispecialty-hospital': 'Multispecialty Hospital',
  ...Object.fromEntries(['specialty-hospital', 'specialized-hospital', 'heart-hospital', 'children-hospital', "children's-hospital", 'cancer-treatment-center', 'psychiatric-hospital', 'mental-hospital'].map((t) => [t, 'Specialty Hospital'])),
  'government-hospital': 'Government Hospital',
  'nursing-home': 'Nursing Home',
  'eye-hospital': 'Eye Hospital',
  'ayurvedic-hospital': 'Ayurvedic Hospital',
  ...Object.fromEntries(['maternity-home', 'maternity-hospital', 'maternity-centre'].map((t) => [t, 'Maternity Home'])),
  'teaching-hospital': 'Teaching Hospital',
  ...Object.fromEntries(['rehabilitation-center', 'physiotherapy-center', 'addiction-treatment-center'].map((t) => [t, 'Rehabilitation Center'])),
  'day-care-center': 'Day Care Center',
  'community-health-center': 'Community Health Center',
  'primary-health-center': 'Primary Health Center',
  ...Object.fromEntries(['diagnostic-center', 'medical-diagnostic-imaging-center', 'medical-laboratory'].map((t) => [t, 'Diagnostic Center'])),
  ...Object.fromEntries(['dental-clinic', 'dentist', 'cosmetic-dentist', 'pediatric-dentist', 'orthodontist'].map((t) => [t, 'Dental Clinic'])),
  ...Object.fromEntries(['homeopath', 'homeopathy-clinic'].map((t) => [t, 'Homeopathy Clinic'])),
  'polyclinic': 'Polyclinic',
  ...Object.fromEntries(['veterinary-hospital', 'animal-hospital', 'veterinarian', 'veterinary-care', 'emergency-veterinarian-service'].map((t) => [t, 'Veterinary Hospital'])),
  // Doctor-led practices, including those Doctar files under the doctor's specialty.
  ...Object.fromEntries([
    'clinic', 'medical-clinic', 'doctor', 'general-practitioner', 'surgical-center', 'dialysis-center', 'fertility-clinic', 'skin-care-clinic',
    'orthopedic-clinic', "women's-health-clinic", 'pediatric-clinic', 'urology-clinic', 'ayurvedic-clinic', 'hair-transplantation-clinic',
    'diabetes-center', 'otolaryngology-clinic', 'ophthalmology-clinic', 'eye-care-center', 'specialized-clinic', 'plastic-surgery-clinic',
    'cardiologist', 'dermatologist', 'pediatrician', 'gynecologist', 'obstetrician-gynecologist', 'orthopedic-surgeon', 'ent-specialist',
    'psychiatrist', 'neurologist', 'gastroenterologist', 'oncologist', 'surgical-oncologist', 'urologist', 'nephrologist', 'pulmonologist',
    'endocrinologist', 'diabetologist', 'neurosurgeon', 'surgeon', 'plastic-surgeon', 'physiotherapist', 'psychologist', 'sexologist',
    'gastrointestinal-surgeon', 'rheumatologist', 'hematologist', 'pathologist', 'pain-management-physician', 'neonatal-physician',
    'cardiovascular-and-thoracic-surgeon', 'fertility-physician', 'transplant-surgeon', 'ophthalmologist', 'pediatric-cardiologist',
    'pediatric-neurologist', 'pediatric-surgeon',
  ].map((t) => [t, 'Clinic'])),
};

/** Words that mark a business rather than a person ("Dental Secrets", "Alivio Physio Pvt Ltd"). */
const ORGANISATION = /\b(pvt|private|ltd|limited|llp|inc|clinics?|hospitals?|centres?|centers?|care|dental|dentistry|physio|physiotherapy|diagnostics?|healthcare|health|foundation|trust|institute|polyclinic|nursing|labs?|laboratory|pharmacy|medical|medicare|speciality|specialty|multispeciality|wellness|enterprises?|solutions|services|associates|orthodontics|homoeopathy|homeopathy)\b|[&@\d]/i;

/**
 * A role in place of a name ("Swati Specialist", "Anil Dermatologist"): a placeholder, not a person's name.
 * Words from Curxx's specialty names are added at run time. "Doctor" is left out: it's a real (Parsi) surname.
 */
const ROLE_WORDS = new Set(['specialist', 'specialists', 'consultant', 'physician', 'surgeon', 'dentist', 'practitioner', 'therapist', 'sexologist']);

/**
 * Doctar removed Practo-scraped records from its production database, but staging still has them. A record
 * is treated as Practo-origin when any field mentions Practo (hospitalSourceId / sourceUrl / sourceId are
 * practo.com links; a few names and bios mention it too). Doctors whose clinic would come only from the
 * scraped `hospitals[]` list are skipped as well. On production data these rules simply match nothing.
 */
const PRACTO = /practo/i;
/**
 * Most of staging is scraped: 24k of 31k doctors have a Practo source id or URL, and most of the rest are
 * Google Maps listings with no gender. Both are skipped in the query itself so they aren't downloaded;
 * the checks below would skip every one of them anyway.
 */
const NOT_PRACTO_SOURCE = { $nor: [{ sourceId: PRACTO }, { hospitalSourceId: PRACTO }, { sourceUrl: PRACTO }] };
const HAS_GENDER = { gender: { $in: ['male', 'female'] } };
/** Field paths ("hospitals[].name") whose text mentions Practo. */
function practoFields(value: unknown, path = '', out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (PRACTO.test(value)) out.add(path || '(value)');
  } else if (Array.isArray(value)) {
    for (const v of value) practoFields(v, `${path}[]`, out);
  } else if (value && typeof value === 'object' && !('_bsontype' in value) && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) practoFields(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** Numbers Doctar fills in when it has none. */
const PLACEHOLDER_PHONES = new Set(['8877772277']);
/** Registration numbers Doctar generated (REG-12345, AUTO-…), not real council numbers. */
const GENERATED_REGISTRATION = /^(REG|AUTO)-/i;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// ---------------------------------------------------------------- Helpers

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
/** Same as the admin panel and seed generator, so imported URLs look like every other Curxx URL. */
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((x) => text(typeof x === 'object' && x ? (x as { name?: unknown }).name : x)).filter(Boolean))];
const phoneOf = (v: unknown) => {
  const raw = text(v);
  return PLACEHOLDER_PHONES.has(raw.replace(/\D/g, '').slice(-10)) ? '' : raw;
};

/** "10:00 AM" → "10:00"; "11:59 PM" → "23:59". */
const to24 = (t: unknown) => {
  const m = text(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3]!.toUpperCase() === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

/** Doctar's { monday: { slots: [{ startTime, endTime }] } } → Curxx days / sessions / perDay. */
function weekly(week: unknown, keys: { open: string; start: string; end: string }): Pick<Schedule, 'days' | 'sessions' | 'perDay'> | null {
  if (!week || typeof week !== 'object') return null;
  const byDay: { day: number; sessions: Session[] }[] = [];
  DAYS.forEach((name, day) => {
    const entry = (week as Record<string, { slots?: Record<string, unknown>[] } & Record<string, unknown>>)[name];
    if (!entry?.[keys.open]) return;
    const sessions = (entry.slots ?? [])
      .map((s) => ({ start: to24(s[keys.start]), end: to24(s[keys.end]) }))
      .filter((s): s is Session => Boolean(s.start && s.end && s.start < s.end));
    if (sessions.length) byDay.push({ day, sessions });
  });
  if (!byDay.length) return null;
  const common = byDay[0]!.sessions;
  const same = (a: Session[]) => JSON.stringify(a) === JSON.stringify(common);
  return { days: byDay.map((d) => d.day), sessions: common, perDay: byDay.filter((d) => !same(d.sessions)) };
}

class Tally {
  private counts = new Map<string, number>();
  add(key: string, n = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + n);
  }
  get total() {
    return [...this.counts.values()].reduce((a, b) => a + b, 0);
  }
  lines(top = 25) {
    return [...this.counts].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `      ${String(n).padStart(6)}  ${k}`);
  }
}

// ---------------------------------------------------------------- Doctar shapes (only the fields we read)

type Id = Types.ObjectId;
type DoctarDoctor = {
  _id: Id; firstName?: string; lastName?: string; gender?: string; qualification?: string; experience?: unknown;
  specialization?: string; specializationList?: string[]; location?: string; locality?: string; bio?: string; avatar?: string;
  languages?: unknown; phone?: string; registrationNumber?: string; consultationFee?: unknown; feeSource?: string | null;
  hospitals?: { name?: string }[]; extraData?: unknown[];
};
type DoctarSchedule = { _id: Id; doctor: Id; hospital: Id; weeklySchedule?: unknown; slotDuration?: number; consultationFee?: unknown; isActive?: boolean };
type DoctarHospital = {
  _id: Id; name?: string; type?: string; city?: string; locality?: string; address?: string; pincode?: string; phone?: string;
  coordinates?: { latitude?: unknown; longitude?: unknown }; operatingHours?: unknown; emergency24x7?: boolean; totalBeds?: unknown;
  accreditations?: unknown; departments?: unknown; services?: unknown; amenities?: unknown; insuranceAccepted?: unknown;
  description?: string; logo?: string; coverImage?: string; gallery?: { url?: string }[];
};

// Everything except private fields, so the Practo check sees every field that could carry a marker.
const DOCTOR_FIELDS = { password: 0, email: 0, subscription: 0, razorpayCustomerId: 0, documents: 0 };
const SCHEDULE_FIELDS = { doctor: 1, hospital: 1, weeklySchedule: 1, slotDuration: 1, consultationFee: 1, isActive: 1 };
const HOSPITAL_FIELDS = { email: 0, owner: 0, documents: 0 };

type Doc = Record<string, unknown>;
type Planned = { doctarId: string; doc: Doc; action: 'insert' | 'update' };

// ---------------------------------------------------------------- Main

async function main() {
  const curxxUri = process.env.MONGODB_URI;
  const doctarUri = process.env.DOCTAR_DB_URL;
  if (!curxxUri || !doctarUri) throw new Error('MONGODB_URI and DOCTAR_DB_URL must be set in backend/.env');

  // No automatic index or collection creation: a dry run must not write anything. A read that stalls on a
  // dropped connection fails after two minutes instead of hanging.
  await mongoose.connect(curxxUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15_000, socketTimeoutMS: 120_000 });
  const doctarConn = await mongoose.createConnection(doctarUri, { autoIndex: false, autoCreate: false, readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 15_000, socketTimeoutMS: 120_000 }).asPromise();
  try {
    const target = mongoose.connection.db!.databaseName;
    if (!DRY_RUN && CONFIRM_DB !== target) throw new Error(`Refusing to write: MONGODB_URI points at Curxx database "${target}". Re-run with --db ${target} to confirm.`);
    console.log(`Curxx database: ${target} · Doctar database: ${doctarConn.db!.databaseName} (read-only)`);
    // Read-only views of Doctar: nothing else is reachable from here.
    const doctar = (name: string) => {
      const c = doctarConn.db!.collection(name);
      return { find: c.find.bind(c), aggregate: c.aggregate.bind(c), countDocuments: c.countDocuments.bind(c) };
    };
    // Sees hidden sample records too, so new slugs never collide with theirs.
    await withSampleData(() => run(doctar));
  } finally {
    await Promise.all([mongoose.disconnect(), doctarConn.close()]);
  }
}

async function run(doctar: (name: string) => Pick<mongoose.mongo.Collection, 'find' | 'aggregate' | 'countDocuments'>) {
  // ---- Curxx reference data ----
  const [cities, specialties, doctorSlugs, facilitySlugs, knownDoctors, knownFacilities] = await Promise.all([
    CityModel.find({}, { slug: 1, name: 1, aliases: 1, localities: 1 }).lean(),
    SpecialtyModel.find({}, { slug: 1, name: 1 }).lean(),
    DoctorModel.distinct('slug').exec() as Promise<string[]>,
    FacilityModel.distinct('slug').exec() as Promise<string[]>,
    DoctorModel.find({ doctarId: { $exists: true } }, { doctarId: 1, slug: 1, managed: 1 }).lean(),
    FacilityModel.find({ doctarId: { $exists: true } }, { doctarId: 1, slug: 1, managed: 1 }).lean(),
  ]);
  const cityBy = new Map<string, (typeof cities)[number]>();
  for (const c of cities) for (const k of [c.slug, c.name, ...c.aliases]) cityBy.set(norm(k), c);
  for (const [alias, slug] of Object.entries(CITY_ALIASES)) {
    const c = cities.find((x) => x.slug === slug);
    if (c && !cityBy.has(alias)) cityBy.set(alias, c);
  }
  const specialtyBy = new Map<string, (typeof specialties)[number]>();
  for (const s of specialties) for (const k of [s.slug, s.name]) specialtyBy.set(norm(k), s);
  for (const [alias, slug] of Object.entries(SPECIALTY_ALIASES)) {
    const s = specialties.find((x) => x.slug === slug);
    if (s && !specialtyBy.has(alias)) specialtyBy.set(alias, s);
  }
  const takenDoctorSlugs = new Set(doctorSlugs);
  const takenFacilitySlugs = new Set(facilitySlugs);
  const existingDoctor = new Map(knownDoctors.map((d) => [d.doctarId!, d]));
  const existingFacility = new Map(knownFacilities.map((f) => [f.doctarId!, f]));
  const categoryGroup = new Map(FACILITY_TYPES.map((t) => [t.name, t.group]));

  const uniqueSlug = (taken: Set<string>, base: string, city: string) => {
    let slug = slugify(base);
    if (taken.has(slug)) slug = slugify(`${base} ${city}`);
    for (let n = 2; taken.has(slug); n += 1) slug = slugify(`${base} ${city} ${n}`);
    taken.add(slug);
    return slug;
  };

  /** A Curxx locality named in the text, else Doctar's locality when it reads like one, else the city. */
  const areaFor = (city: (typeof cities)[number], locality: string, address = '') => {
    const hay = `${locality} ${address}`.toLowerCase();
    const known = city.localities.find((l) => new RegExp(`\\b${l.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay));
    if (known) return known.name;
    if (/^[A-Za-z][A-Za-z .'-]{2,39}$/.test(locality)) return locality;
    return '';
  };

  // ---- Report ----
  const skippedDoctors = new Tally();
  const skippedFacilities = new Tally();
  const unmatchedSpecialties = new Tally();
  const unmatchedCities = new Tally();
  const clinicSource = new Tally();
  const facilityNotes = new Tally();
  const organisationNames: string[] = [];
  const genericNames: string[] = [];
  // "Dermatologist", "Gynecologist"…: any long word from a specialty name is a role, not a name.
  const roleWords = new Set([...ROLE_WORDS, ...specialties.flatMap((sp) => sp.name.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length >= 7)]);
  const practoMarkers = new Tally();
  let scanned = 0;
  let feeApprox = 0;
  let feeSourceMissing = 0;

  // ---- Facility mapping (a Doctar hospital becomes a Curxx facility, or a reason it can't) ----
  const facilityPlan = new Map<string, { doc: Doc; action: 'insert' | 'update' } | { skip: string }>();
  function planFacility(h: DoctarHospital) {
    const id = String(h._id);
    const cached = facilityPlan.get(id);
    if (cached) return cached;
    const result = ((): { doc: Doc; action: 'insert' | 'update' } | { skip: string } => {
      const existing = existingFacility.get(id);
      if (existing?.managed) return { skip: 'edited in the admin panel — left as is' };
      const practo = practoFields(h);
      if (practo.size) {
        for (const f of practo) practoMarkers.add(`facility · ${f}`);
        return { skip: 'Practo origin' };
      }
      const name = text(h.name);
      if (!name) return { skip: 'no name' };
      const city = cityBy.get(norm(h.city));
      if (!city) return { skip: `city not on Curxx: ${text(h.city) || '(empty)'}` };
      const address = text(h.address);
      if (!address) return { skip: 'no address' };
      let category = FACILITY_CATEGORY[norm(h.type)];
      if (!category) return { skip: `not a medical facility type: ${text(h.type) || '(empty)'}` };
      let type = categoryGroup.get(category)!;
      // Doctar's types are unreliable ("Manipal Hospitals" filed as a diagnostic centre): the name wins.
      if (/\bhospitals?\b/i.test(name) && type !== 'hospital') {
        facilityNotes.add(`"Hospital" in name: ${category} → Private Hospital`);
        category = 'Private Hospital';
        type = 'hospital';
      }
      const hours = weekly(h.operatingHours, { open: 'open', start: 'openTime', end: 'closeTime' });
      if (!hours) return { skip: 'no opening hours' };
      const allDay = hours.days.length === 7 && !hours.perDay?.length && hours.sessions.length === 1 && hours.sessions[0]!.start === '00:00' && hours.sessions[0]!.end >= '23:59';
      const lat = Number(h.coordinates?.latitude);
      const lng = Number(h.coordinates?.longitude);
      const departments = strings(h.departments).slice(0, 30);
      return {
        action: existing ? 'update' : 'insert',
        doc: {
          doctarId: id,
          source: 'doctar',
          slug: existing?.slug ?? uniqueSlug(takenFacilitySlugs, name, city.slug),
          name,
          shortName: name.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || name,
          type,
          category,
          city: city.slug,
          area: areaFor(city, text(h.locality), address) || city.name,
          address,
          pincode: /^\d{6}$/.test(text(h.pincode)) ? text(h.pincode) : '',
          ...(lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98 ? { geo: { lat, lng } } : {}),
          phone: phoneOf(h.phone),
          about: text(h.description),
          openHours: allDay ? 'Open 24 hours' : describeSchedule({ ...hours, step: 30, video: 'none' }),
          emergency24x7: h.emergency24x7 === true,
          beds: Number.isFinite(Number(h.totalBeds)) && Number(h.totalBeds) > 0 ? Math.round(Number(h.totalBeds)) : 0,
          nabh: strings(h.accreditations).some((a) => /nabh/i.test(a)),
          departments,
          services: strings(h.services).slice(0, 30),
          amenities: strings(h.amenities).slice(0, 30),
          insurers: strings(h.insuranceAccepted).slice(0, 30),
          specialties: [...new Set(departments.map((d) => specialtyBy.get(norm(d))?.slug).filter((s): s is string => Boolean(s)))],
          photoUrl: text(h.coverImage) || text(h.logo),
          gallery: (h.gallery ?? []).map((g) => text(g.url)).filter(Boolean).slice(0, 12),
          // No invented ratings: a facility starts unrated until patients review it.
          rating: 0,
          reviewCount: 0,
          // Unranked like seed records (no stored rankScore); the schema default 0 would sort above them.
          rankScore: null,
        },
      };
    })();
    if ('skip' in result) skippedFacilities.add(result.skip);
    facilityPlan.set(id, result);
    return result;
  }

  // ---- Doctors ----
  const doctors: Planned[] = [];
  const usedFacilities = new Map<string, Planned>();
  const cursor = doctar('doctors').find({ isAdminVerified: true, ...NOT_PRACTO_SOURCE, ...HAS_GENDER }, { projection: DOCTOR_FIELDS, sort: { _id: 1 }, batchSize: 500 });
  const chunkSize = Math.min(500, Number.isFinite(LIMIT) ? Math.max(50, LIMIT * 5) : 500);
  let chunk: DoctarDoctor[] = [];
  let done = false;

  const processChunk = async (batch: DoctarDoctor[]) => {
    const ids = batch.map((d) => d._id);
    const schedules = (await doctar('doctorschedules').find({ doctor: { $in: ids } }, { projection: SCHEDULE_FIELDS }).toArray()) as unknown as DoctarSchedule[];
    const hospitals = schedules.length
      ? ((await doctar('hospitals').find({ _id: { $in: schedules.map((s) => s.hospital) } }, { projection: HOSPITAL_FIELDS }).toArray()) as unknown as DoctarHospital[])
      : [];
    const hospitalById = new Map(hospitals.map((h) => [String(h._id), h]));
    const schedulesOf = new Map<string, DoctarSchedule[]>();
    for (const s of schedules.sort((a, b) => Number(b.isActive === true) - Number(a.isActive === true))) {
      schedulesOf.set(String(s.doctor), [...(schedulesOf.get(String(s.doctor)) ?? []), s]);
    }

    for (const d of batch) {
      if (doctors.length >= LIMIT) {
        done = true;
        return;
      }
      scanned += 1;
      const id = String(d._id);
      const skip = (reason: string) => skippedDoctors.add(reason);
      const existing = existingDoctor.get(id);
      if (existing?.managed) { skip('edited in the admin panel — left as is'); continue; }
      const practo = practoFields(d);
      if (practo.size) {
        skip('Practo origin: a field mentions Practo');
        for (const f of practo) practoMarkers.add(`doctor · ${f}`);
        continue;
      }

      const first = text(d.firstName).replace(/^dr\.?\s+/i, '');
      const fullName = `${first} ${text(d.lastName)}`.replace(/\s+/g, ' ').trim();
      if (!fullName) { skip('no name'); continue; }
      if (ORGANISATION.test(fullName)) {
        skip('organisation, not a person');
        if (organisationNames.length < 12) organisationNames.push(fullName);
        continue;
      }
      if (fullName.toLowerCase().split(/[^a-z]+/).some((w) => roleWords.has(w))) {
        skip('generic name (a role, e.g. "Specialist")');
        if (genericNames.length < 12) genericNames.push(fullName);
        continue;
      }
      if (d.gender !== 'male' && d.gender !== 'female') { skip('gender missing or not male/female'); continue; }
      const qualification = text(d.qualification);
      if (!qualification) { skip('no qualification'); continue; }
      const experience = Number(d.experience);
      if (typeof d.experience !== 'number' || !Number.isFinite(experience) || experience < 0 || experience > 70) { skip('experience missing or invalid'); continue; }
      const specialty = specialtyBy.get(norm(d.specialization)) ?? specialtyBy.get(norm(d.specializationList?.[0]));
      if (!specialty) { skip('specialty not on Curxx'); unmatchedSpecialties.add(text(d.specialization) || '(empty)'); continue; }
      const city = cityBy.get(norm(d.location));
      if (!city) { skip('city not on Curxx'); unmatchedCities.add(text(d.location) || '(empty)'); continue; }

      // Where they consult: a linked hospital in the same city first, then names Doctar stores on the doctor.
      let facility: { doc: Doc; action: 'insert' | 'update' } | undefined;
      let schedule: DoctarSchedule | undefined;
      for (const s of schedulesOf.get(id) ?? []) {
        const h = hospitalById.get(String(s.hospital));
        if (!h) continue;
        const plan = planFacility(h);
        if ('skip' in plan) continue;
        if (plan.doc.city !== city.slug) continue;
        facility = plan;
        schedule = s;
        break;
      }
      const extraClinic = (d.extraData ?? []).find((x): x is { name: string; description: string } => typeof x === 'object' && x !== null && (x as { name?: unknown }).name === 'Clinic Name');
      if (!facility && !text(extraClinic?.description) && text(d.hospitals?.[0]?.name)) {
        // The embedded hospitals[] list is the scraped one: a clinic known only from it isn't used.
        skip('Practo origin: clinic only from the scraped hospitals[] list');
        continue;
      }
      const clinicName = facility ? String(facility.doc.name) : text(extraClinic?.description);
      if (!clinicName) { skip('no clinic or hospital name'); continue; }
      clinicSource.add(facility ? 'linked Doctar hospital (facilitySlug set)' : '"Clinic Name" in extraData (no facility page)');
      const area = facility ? String(facility.doc.area) : areaFor(city, text(d.locality));
      if (!area) { skip('no usable locality'); continue; }

      const ownFee = Number(d.consultationFee);
      const scheduleFee = Number(schedule?.consultationFee);
      const fee = typeof d.consultationFee === 'number' && ownFee > 0 ? ownFee : scheduleFee > 0 ? scheduleFee : NaN;
      if (!Number.isFinite(fee) || fee < 50 || fee > 20_000) { skip('fee missing or out of range'); continue; }
      // Only a fee the doctor set themselves counts as confirmed; "system" or no feeSource shows as "Approx.".
      const feeVerified = typeof d.consultationFee === 'number' && ownFee > 0 && d.feeSource != null && d.feeSource !== 'system';
      if (!feeVerified) feeApprox += 1;
      if (d.feeSource == null) feeSourceMissing += 1;

      const hours = schedule ? weekly(schedule.weeklySchedule, { open: 'isAvailable', start: 'startTime', end: 'endTime' }) : null;
      const curxxSchedule = { ...(hours ?? { days: [], sessions: [], perDay: [] }), step: schedule?.slotDuration || 30, video: 'none' as const };
      const registration = text(d.registrationNumber);
      const name = `Dr. ${fullName}`;
      const doc: Doc = {
        doctarId: id,
        source: 'doctar',
        slug: existing?.slug ?? uniqueSlug(takenDoctorSlugs, name, city.slug),
        name,
        qualification,
        title: specialty.name,
        specialty: specialty.slug,
        city: city.slug,
        area,
        clinicName,
        facilitySlug: facility ? String(facility.doc.slug) : '',
        gender: d.gender,
        education: [],
        registration: registration && !GENERATED_REGISTRATION.test(registration) ? registration : '',
        experienceYears: Math.round(experience),
        fee,
        videoFee: fee,
        feeVerified,
        // Real doctors never get sample ratings: they start at zero until patients review them.
        rating: 0,
        reviewCount: 0,
        recommendPercent: 0,
        languages: strings(d.languages).length ? strings(d.languages) : ['English'],
        focusAreas: [],
        photoUrl: /^https?:\/\//.test(text(d.avatar)) ? text(d.avatar) : '',
        about: text(d.bio),
        // `verified` means Curxx checked the credentials; Doctar's own check doesn't count, so no Curxx tick.
        verified: false,
        schedule: curxxSchedule,
        consultHours: hours ? describeSchedule(curxxSchedule) : '',
        freeVideo: false,
        instant: false,
        slotsThrough: null,
        // The doctor's own number is their Doctar sign-in phone, often a personal mobile: it isn't published.
        // Call buttons use the clinic's number instead.
        phone: '',
        bookable: false,
        // Unranked like seed records (no stored rankScore); the schema default 0 would put imports first.
        rankScore: null,
      };
      doctors.push({ doctarId: id, doc, action: existing ? 'update' : 'insert' });
      if (facility) usedFacilities.set(String(facility.doc.doctarId), { doctarId: String(facility.doc.doctarId), ...facility });
    }
  };

  for await (const raw of cursor) {
    chunk.push(raw as unknown as DoctarDoctor);
    if (chunk.length >= chunkSize) {
      await processChunk(chunk);
      chunk = [];
      if (done) break;
    }
  }
  if (!done && chunk.length) await processChunk(chunk);
  await cursor.close();

  // Facilities list the specialties of the imported doctors who consult there.
  const facilities = [...usedFacilities.values()];
  const facilityBySlug = new Map(facilities.map((f) => [f.doc.slug, f]));
  for (const d of doctors) {
    const f = facilityBySlug.get(d.doc.facilitySlug);
    if (f) f.doc.specialties = [...new Set([...(f.doc.specialties as string[]), String(d.doc.specialty)])];
  }

  // ---- Validate with the Curxx models (required fields, enums, types) ----
  const invalid = new Tally();
  const validFacilities: Planned[] = [];
  for (const f of facilities) {
    const error = new FacilityModel(f.doc).validateSync();
    if (error) invalid.add(`facility: ${Object.keys(error.errors).join(', ')}`);
    else validFacilities.push(f);
  }
  const validFacilitySlugs = new Set(validFacilities.map((f) => f.doc.slug));
  const validDoctors: Planned[] = [];
  for (const d of doctors) {
    // A doctor whose facility failed validation keeps the clinic name but loses the link.
    if (d.doc.facilitySlug && !validFacilitySlugs.has(d.doc.facilitySlug)) d.doc.facilitySlug = '';
    const error = new DoctorModel(d.doc).validateSync();
    if (error) invalid.add(`doctor: ${Object.keys(error.errors).join(', ')}`);
    else validDoctors.push(d);
  }

  // ---- Write (facilities first, so doctors' facilitySlug points at something) ----
  const upsert = async (model: typeof DoctorModel | typeof FacilityModel, rows: Planned[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      await (model as typeof DoctorModel).bulkWrite(
        rows.slice(i, i + 500).map((r) => ({ updateOne: { filter: { doctarId: r.doctarId }, update: { $set: r.doc }, upsert: true } })) as never,
        { ordered: false },
      );
    }
  };
  const writeFacilities = ONLY !== 'doctors';
  const writeDoctors = ONLY !== 'facilities';
  if (!DRY_RUN) {
    // The unique doctarId index is what makes re-runs safe; create it (and only missing indexes) first.
    await Promise.all([DoctorModel.createIndexes(), FacilityModel.createIndexes()]);
    if (writeFacilities) await upsert(FacilityModel, validFacilities);
    if (writeDoctors) {
      if (!writeFacilities) {
        // --only doctors: link only to facilities that are already in Curxx.
        const present = new Set((await FacilityModel.distinct('slug', { slug: { $in: [...validFacilitySlugs] } })) as string[]);
        for (const d of validDoctors) if (d.doc.facilitySlug && !present.has(String(d.doc.facilitySlug))) d.doc.facilitySlug = '';
      }
      await upsert(DoctorModel, validDoctors);
    }
  }

  // ---- Summary ----
  const count = (rows: Planned[], action: string) => rows.filter((r) => r.action === action).length;
  const bytes = (rows: Planned[]) => rows.reduce((sum, r) => sum + mongoose.mongo.BSON.calculateObjectSize(r.doc), 0);
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  // Index overhead per document, from Curxx's current collections (~0.8 KB per doctor, ~1.5 KB per facility).
  const newBytes = bytes(validDoctors.filter((r) => r.action === 'insert')) + 800 * count(validDoctors, 'insert') + bytes(validFacilities.filter((r) => r.action === 'insert')) + 1500 * count(validFacilities, 'insert');
  const verb = DRY_RUN ? 'would be ' : '';
  const out: string[] = [];
  out.push('', `Doctar → Curxx import${DRY_RUN ? '  (DRY RUN: nothing written)' : ''}${Number.isFinite(LIMIT) ? `  --limit ${LIMIT}` : ''}${ONLY ? `  --only ${ONLY}` : ''}`);
  const [verified, notPracto, withGender] = await Promise.all([
    doctar('doctors').countDocuments({ isAdminVerified: true }),
    doctar('doctors').countDocuments({ isAdminVerified: true, ...NOT_PRACTO_SOURCE }),
    doctar('doctors').countDocuments({ isAdminVerified: true, ...NOT_PRACTO_SOURCE, ...HAS_GENDER }),
  ]);
  out.push(`  Scanned ${scanned} of ${verified} admin-verified Doctar doctors. Skipped in the query: ${verified - notPracto} with a Practo source id or URL, ${notPracto - withGender} with no gender.`);
  out.push('', `  Facilities${writeFacilities ? '' : ' (not written: --only doctors)'}: ${count(validFacilities, 'insert')} ${verb}inserted, ${count(validFacilities, 'update')} ${verb}updated`);
  out.push(`    Linked Doctar hospitals not imported: ${skippedFacilities.total}`, ...skippedFacilities.lines(12));
  if (facilityNotes.total) out.push('    Type overrides:', ...facilityNotes.lines());
  out.push('', `  Doctors${writeDoctors ? '' : ' (not written: --only facilities)'}: ${count(validDoctors, 'insert')} ${verb}inserted, ${count(validDoctors, 'update')} ${verb}updated, ${skippedDoctors.total} skipped`);
  out.push(...skippedDoctors.lines());
  if (organisationNames.length) out.push(`    Organisation names skipped, e.g.: ${organisationNames.join(' · ')}`);
  if (genericNames.length) out.push(`    Generic names skipped: ${genericNames.join(' · ')}`);
  if (practoMarkers.total) out.push('    Practo markers found (field · records):', ...practoMarkers.lines(15));
  out.push('    Clinic name taken from:', ...clinicSource.lines());
  const clinicPhone = new Set(validFacilities.filter((f) => f.doc.phone).map((f) => f.doc.slug));
  const callable = validDoctors.filter((d) => clinicPhone.has(d.doc.facilitySlug)).length;
  out.push(`    Call button: ${callable} with the clinic's number, ${validDoctors.length - callable} without a number (doctors' own numbers aren't published)`);
  out.push(`    Fees: ${validDoctors.length - feeApprox} confirmed, ${feeApprox} shown as "Approx." (feeSource "system" or missing, or no own fee; ${feeSourceMissing} had no feeSource)`);
  if (unmatchedSpecialties.total) out.push('', '  Unmatched specialties (skipped):', ...unmatchedSpecialties.lines(30));
  if (unmatchedCities.total) out.push('', '  Unmatched cities (skipped):', ...unmatchedCities.lines(30));
  if (invalid.total) out.push('', '  Failed Curxx validation (skipped):', ...invalid.lines());
  out.push('', `  New data: ~${mb(newBytes)} including indexes (Atlas M0 limit 512 MB).`);
  const pick = (doc: Doc, keys: string[]) => Object.fromEntries(keys.map((k) => [k, doc[k]]));
  out.push('', '  Sample doctors:');
  for (const d of validDoctors.slice(0, 3)) out.push(`    ${JSON.stringify(pick(d.doc, ['slug', 'name', 'specialty', 'city', 'area', 'clinicName', 'facilitySlug', 'fee', 'feeVerified', 'registration', 'consultHours', 'photoUrl']))}`);
  out.push('  Sample facilities:');
  for (const f of validFacilities.slice(0, 2)) out.push(`    ${JSON.stringify(pick(f.doc, ['slug', 'name', 'type', 'category', 'city', 'area', 'openHours', 'specialties']))}`);
  console.log(out.join('\n'));
}

// A dropped connection can leave a read that never settles; Node then exits quietly with code 0. Say so.
let finished = false;
process.on('beforeExit', () => {
  if (finished) return;
  console.error('Stopped before finishing: a database connection dropped. Upserts are safe to repeat: run it again.');
  process.exitCode = 1;
});

main().then(() => (finished = true)).catch((error: unknown) => {
  finished = true;
  // Driver errors can echo a connection string; print only the message with credentials masked.
  console.error(String((error as Error)?.message ?? error).replace(/mongodb(\+srv)?:\/\/[^\s/]+/g, 'mongodb://***'));
  process.exit(1);
});
