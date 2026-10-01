/**
 * Doctar → Curxx mapping (rules agreed with the team, 30 Sep): pure functions, so the live directory, the
 * report script and the tests share one definition.
 * - Practo and Google Maps records are included; Practo links and ids are scrubbed from every value.
 * - Gender is optional (never guessed). Organisations, generic names ("Specialist", "Doctor", "Clinic")
 *   and records without a name, qualification, clinic, valid experience or fee are skipped.
 * - No Doctar ratings or reviews; fees are "Approx." unless the doctor set them; doctors' own phones and
 *   emails are never read (Call uses the clinic's number); bios come from the website's template.
 * - Speciality and department names lose scraped place tails ("Oral Surgeon In Kolkata" → "Oral Surgeon").
 * - Hospital photos from Doctar (often scraped: adverts, unrelated close-ups) only with
 *   DOCTAR_SHOW_FACILITY_PHOTOS; otherwise the website shows its usual placeholder.
 */
import { describeSchedule, type Schedule, type Session } from '../../db/data/doctor-network.js';
import { FACILITY_TYPES } from '../../db/data/facility-network.js';

// ---------------------------------------------------------------- Rules

/** Doctar specialisations with no identical Curxx slug. Anything else unmatched is skipped. */
export const SPECIALTY_ALIASES: Record<string, string> = {
  'orthopaedic-surgeon': 'orthopedist',
  'spine-surgeon': 'orthopedist',
  'gynaecologist-obstetric-surgeon': 'gynecologist',
  'laparoscopic-surgeon-obs-and-gyn': 'gynecologist',
  'oncology-surgeon': 'oncologist',
  'maxillofacial-surgeon': 'dentist',
  'dental-surgeon': 'dentist',
  'fertility-ivf-surgeon': 'fertility-infertility-specialist',
  'urology-surgeon': 'urologist',
  dermatosurgeon: 'dermatologist',
  'ent-surgeon': 'ent-specialist',
  'ophthalmic-surgeon': 'ophthalmologist',
  'laparoscopic-surgeon': 'general-surgeon',
  'bariatric-surgeon': 'general-surgeon',
  'colorectal-surgeon': 'general-surgeon',
};

/** Places Doctar lists separately that belong to a Curxx city (on top of city names and aliases). */
export const CITY_ALIASES: Record<string, string> = {
  secunderabad: 'hyderabad',
  kukatpalli: 'hyderabad',
  'greater-noida': 'noida',
  bhubaneshwar: 'bhubaneswar',
  cochin: 'kochi',
  ernakulam: 'kochi',
  'new-delhi': 'delhi',
  dwarka: 'delhi',
  'karol-bagh': 'delhi',
  ambattur: 'chennai',
  borivli: 'mumbai',
};

/** Doctar facility type → one of Curxx's 19 facility types. Unlisted (gyms, pharmacies, stores…) are skipped. */
const FACILITY_CATEGORY: Record<string, string> = {
  ...Object.fromEntries(
    ['hospital', 'general-hospital', 'private-hospital', 'medical-center'].map((t) => [
      t,
      'Private Hospital',
    ]),
  ),
  'multispecialty-hospital': 'Multispecialty Hospital',
  ...Object.fromEntries(
    [
      'specialty-hospital',
      'specialized-hospital',
      'heart-hospital',
      'children-hospital',
      "children's-hospital",
      'cancer-treatment-center',
      'psychiatric-hospital',
      'mental-hospital',
    ].map((t) => [t, 'Specialty Hospital']),
  ),
  'government-hospital': 'Government Hospital',
  'nursing-home': 'Nursing Home',
  'eye-hospital': 'Eye Hospital',
  'ayurvedic-hospital': 'Ayurvedic Hospital',
  ...Object.fromEntries(
    ['maternity-home', 'maternity-hospital', 'maternity-centre'].map((t) => [t, 'Maternity Home']),
  ),
  'teaching-hospital': 'Teaching Hospital',
  ...Object.fromEntries(
    ['rehabilitation-center', 'physiotherapy-center', 'addiction-treatment-center'].map((t) => [
      t,
      'Rehabilitation Center',
    ]),
  ),
  'day-care-center': 'Day Care Center',
  'community-health-center': 'Community Health Center',
  'primary-health-center': 'Primary Health Center',
  ...Object.fromEntries(
    ['diagnostic-center', 'medical-diagnostic-imaging-center', 'medical-laboratory'].map((t) => [
      t,
      'Diagnostic Center',
    ]),
  ),
  ...Object.fromEntries(
    ['dental-clinic', 'dentist', 'cosmetic-dentist', 'pediatric-dentist', 'orthodontist'].map(
      (t) => [t, 'Dental Clinic'],
    ),
  ),
  ...Object.fromEntries(['homeopath', 'homeopathy-clinic'].map((t) => [t, 'Homeopathy Clinic'])),
  polyclinic: 'Polyclinic',
  ...Object.fromEntries(
    [
      'veterinary-hospital',
      'animal-hospital',
      'veterinarian',
      'veterinary-care',
      'emergency-veterinarian-service',
    ].map((t) => [t, 'Veterinary Hospital']),
  ),
  // Doctor-led practices, including those Doctar files under the doctor's specialty.
  ...Object.fromEntries(
    [
      'clinic',
      'medical-clinic',
      'doctor',
      'general-practitioner',
      'surgical-center',
      'dialysis-center',
      'fertility-clinic',
      'skin-care-clinic',
      'orthopedic-clinic',
      "women's-health-clinic",
      'pediatric-clinic',
      'urology-clinic',
      'ayurvedic-clinic',
      'hair-transplantation-clinic',
      'diabetes-center',
      'otolaryngology-clinic',
      'ophthalmology-clinic',
      'eye-care-center',
      'specialized-clinic',
      'plastic-surgery-clinic',
      'cardiologist',
      'dermatologist',
      'pediatrician',
      'gynecologist',
      'obstetrician-gynecologist',
      'orthopedic-surgeon',
      'ent-specialist',
      'psychiatrist',
      'neurologist',
      'gastroenterologist',
      'oncologist',
      'surgical-oncologist',
      'urologist',
      'nephrologist',
      'pulmonologist',
      'endocrinologist',
      'diabetologist',
      'neurosurgeon',
      'surgeon',
      'plastic-surgeon',
      'physiotherapist',
      'psychologist',
      'sexologist',
      'gastrointestinal-surgeon',
      'rheumatologist',
      'hematologist',
      'pathologist',
      'pain-management-physician',
      'neonatal-physician',
      'cardiovascular-and-thoracic-surgeon',
      'fertility-physician',
      'transplant-surgeon',
      'ophthalmologist',
      'pediatric-cardiologist',
      'pediatric-neurologist',
      'pediatric-surgeon',
    ].map((t) => [t, 'Clinic']),
  ),
};
const CATEGORY_GROUP = new Map(FACILITY_TYPES.map((t) => [t.name, t.group]));

/** Words that mark a business rather than a person ("Dental Secrets", "Alivio Physio Pvt Ltd"). */
const ORGANISATION =
  /\b(pvt|private|ltd|limited|llp|inc|clinics?|hospitals?|centres?|centers?|care|dental|dentistry|physio|physiotherapy|diagnostics?|healthcare|health|foundation|trust|institute|polyclinic|nursing|labs?|laboratory|pharmacy|medical|medicare|speciality|specialty|multispeciality|wellness|enterprises?|solutions|services|associates|orthodontics|homoeopathy|homeopathy)\b|[&@\d]/i;
/** A role in place of a name ("Swati Specialist", "Skin Doctor"). Long words from specialty names are added per context. */
const ROLE_WORDS = [
  'specialist',
  'specialists',
  'consultant',
  'physician',
  'surgeon',
  'dentist',
  'practitioner',
  'therapist',
  'sexologist',
  'doctor',
  'doctors',
];
/** Titles at the start of a name ("Dr.", "Doctor", "Prof."): dropped before the name is checked. */
const TITLES = /^(?:(?:dr|doctor|prof|professor)\b\.?\s*)+/i;
const PRACTO = /practo/i;
const PRACTO_URL = /(?:https?:\/\/|www\.)\S*practo\S*/gi;
/** Numbers Doctar fills in when it has none. */
const PLACEHOLDER_PHONES = new Set(['8877772277']);
/** Registration numbers Doctar generated (REG-12345, AUTO-…), not real council numbers. */
const GENERATED_REGISTRATION = /^(REG|AUTO)-/i;
const DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

// ---------------------------------------------------------------- Doctar shapes (only the fields we read)

export type DoctarId = { toString(): string };
export type DoctarDoctor = {
  _id: DoctarId;
  slug?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  qualification?: string;
  experience?: unknown;
  specialization?: string;
  specializationList?: string[];
  location?: string;
  locality?: string;
  avatar?: string;
  languages?: unknown;
  registrationNumber?: string;
  consultationFee?: unknown;
  feeSource?: string | null;
  clinicName?: string;
  hospitalName?: string;
  hospitals?: { name?: string }[];
  extraData?: unknown[];
  isAdminVerified?: boolean;
};
export type DoctarSchedule = {
  _id?: DoctarId;
  doctor: DoctarId;
  hospital: DoctarId;
  weeklySchedule?: unknown;
  slotDuration?: number;
  consultationFee?: unknown;
  isActive?: boolean;
};
export type DoctarHospital = {
  _id: DoctarId;
  slug?: string;
  name?: string;
  type?: string;
  city?: string;
  locality?: string;
  address?: string;
  pincode?: string;
  phone?: string;
  coordinates?: { latitude?: unknown; longitude?: unknown };
  operatingHours?: unknown;
  emergency24x7?: boolean;
  totalBeds?: unknown;
  accreditations?: unknown;
  departments?: unknown;
  services?: unknown;
  amenities?: unknown;
  insuranceAccepted?: unknown;
  description?: string;
  logo?: string;
  coverImage?: string;
  gallery?: { url?: string }[];
};

/**
 * Projections: the listing index keeps doctors and hospitals lean (no bios, galleries or free text); a
 * profile or hospital page reads the rest on demand. Nothing private (emails, own phones, documents).
 */
export const DOCTOR_INDEX_FIELDS = {
  slug: 1,
  firstName: 1,
  lastName: 1,
  gender: 1,
  qualification: 1,
  experience: 1,
  specialization: 1,
  specializationList: 1,
  location: 1,
  locality: 1,
  avatar: 1,
  languages: 1,
  consultationFee: 1,
  feeSource: 1,
  clinicName: 1,
  hospitalName: 1,
  'hospitals.name': 1,
  extraData: { $elemMatch: { name: 'Clinic Name' } },
  isAdminVerified: 1,
} as const;
export const DOCTOR_DETAIL_FIELDS = { ...DOCTOR_INDEX_FIELDS, registrationNumber: 1 } as const;
export const SCHEDULE_FIELDS = {
  doctor: 1,
  hospital: 1,
  weeklySchedule: 1,
  slotDuration: 1,
  consultationFee: 1,
  isActive: 1,
} as const;
export const HOSPITAL_INDEX_FIELDS = {
  slug: 1,
  name: 1,
  type: 1,
  city: 1,
  locality: 1,
  address: 1,
  pincode: 1,
  phone: 1,
  coordinates: 1,
  operatingHours: 1,
  emergency24x7: 1,
  totalBeds: 1,
  accreditations: 1,
  departments: 1,
  logo: 1,
  coverImage: 1,
} as const;
export const HOSPITAL_DETAIL_FIELDS = {
  ...HOSPITAL_INDEX_FIELDS,
  services: 1,
  amenities: 1,
  insuranceAccepted: 1,
  description: 1,
  gallery: 1,
} as const;

// ---------------------------------------------------------------- Helpers

export const norm = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
/** Same as the admin panel and seed generator, so URLs look like every other Curxx URL. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
/** Search-ad wording: "… in Ahmedabad" after "Best/Top", "near me", or just "Best Urologist". */
const AD =
  /\bnear me\b|\b(?:best|top|no\.?\s*1)\b.*\b(?:in|at|near)\s+[a-z]|^(?:best|top)\b.*\b(?:doctor|specialist|surgeon|dentist|[a-z]+ologist|physician|gyn(?:a)?ecologist|orthop(?:a)?edic|p(?:a)?ediatrician)s?\b/i;
/**
 * A clinic or hospital name without search-ad tails: "Nova IVF Centre - Best IVF Center in Naroda" → "Nova IVF
 * Centre", "Dr. Sameer Dani, 27+ yrs of Exp" → "Dr. Sameer Dani". Styled Unicode (𝗗𝗿) becomes plain text. A
 * name that is only an advert ("Best Urologist in Ahmedabad") comes back empty.
 */
export const placeName = (v: unknown) => {
  const plainText = text(v)
    .normalize('NFKC')
    .replace(/,?\s*\d+\s*\+?\s*(?:yrs?|years?)\.?\s*(?:of\s*)?exp(?:erience)?\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const first =
    plainText
      .split(/\s*[|｜]\s*|\s+[-–—:/]\s+|\s*[–—]\s*|\s*[-,]\s*(?=(?:best|top)\b)/i)[0]
      ?.trim()
      .replace(/[\s,.:;-]+$/, '') ?? '';
  return AD.test(first) ? '' : first;
};
const strings = (v: unknown) => [
  ...new Set(
    (Array.isArray(v) ? v : [])
      .map((x) => text(typeof x === 'object' && x ? (x as { name?: unknown }).name : x))
      .filter(Boolean),
  ),
];
const phoneOf = (v: unknown) => {
  const raw = text(v);
  return PLACEHOLDER_PHONES.has(raw.replace(/\D/g, '').slice(-10)) ? '' : raw;
};

/** Removes Practo links from every string; a value still mentioning Practo afterwards is dropped. */
export function scrubPracto<T>(value: T): T {
  if (typeof value === 'string') {
    if (!PRACTO.test(value)) return value;
    const cleaned = value
      .replace(PRACTO_URL, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return (PRACTO.test(cleaned) ? '' : cleaned) as T;
  }
  if (Array.isArray(value)) return value.map((v) => scrubPracto(v)).filter((v) => v !== '') as T;
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !('_bsontype' in (value as object))
  ) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubPracto(v)])) as T;
  }
  return value;
}

/** "10:00 AM" → "10:00"; "11:59 PM" → "23:59". */
const to24 = (t: unknown) => {
  const m = text(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3]!.toUpperCase() === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

/** Doctar's { monday: { slots: [{ startTime, endTime }] } } → Curxx days / sessions / perDay. */
export function weekly(
  week: unknown,
  keys: { open: string; start: string; end: string },
): Pick<Schedule, 'days' | 'sessions' | 'perDay'> | null {
  if (!week || typeof week !== 'object') return null;
  const byDay: { day: number; sessions: Session[] }[] = [];
  DAYS.forEach((name, day) => {
    const entry = (
      week as Record<string, { slots?: Record<string, unknown>[] } & Record<string, unknown>>
    )[name];
    if (!entry?.[keys.open]) return;
    const sessions = (entry.slots ?? [])
      .map((s) => ({ start: to24(s[keys.start]), end: to24(s[keys.end]) }))
      .filter((s): s is Session => Boolean(s.start && s.end && s.start < s.end));
    if (sessions.length) byDay.push({ day, sessions });
  });
  if (!byDay.length) return null;
  const common = byDay[0]!.sessions;
  const same = (a: Session[]) => JSON.stringify(a) === JSON.stringify(common);
  return {
    days: byDay.map((d) => d.day),
    sessions: common,
    perDay: byDay.filter((d) => !same(d.sessions)),
  };
}

// ---------------------------------------------------------------- Context (Curxx cities and specialties, settings)

type City = { slug: string; name: string; aliases?: string[]; localities: { name: string }[] };
type SpecialtyRef = { slug: string; name: string };

export type MappingContext = {
  cityBy: Map<string, City>;
  specialtyBy: Map<string, SpecialtyRef>;
  roleWords: Set<string>;
  /** Every place name known (normalised): Curxx's cities and aliases, and the cities and locations Doctar uses. */
  places: Set<string>;
  /** Doctar's own hospital photos are shown (DOCTAR_SHOW_FACILITY_PHOTOS). */
  facilityPhotos: boolean;
};

/**
 * `places`: the raw city / location names Doctar uses (any city, not only Curxx's), for cutting place tails
 * off speciality names.
 */
export function mappingContext(
  cities: City[],
  specialties: SpecialtyRef[],
  options: { places?: unknown[]; facilityPhotos?: boolean } = {},
): MappingContext {
  const cityBy = new Map<string, City>();
  for (const c of cities)
    for (const k of [c.slug, c.name, ...(c.aliases ?? [])]) cityBy.set(norm(k), c);
  for (const [alias, slug] of Object.entries(CITY_ALIASES)) {
    const c = cities.find((x) => x.slug === slug);
    if (c && !cityBy.has(alias)) cityBy.set(alias, c);
  }
  const specialtyBy = new Map<string, SpecialtyRef>();
  for (const s of specialties) for (const k of [s.slug, s.name]) specialtyBy.set(norm(k), s);
  for (const [alias, slug] of Object.entries(SPECIALTY_ALIASES)) {
    const s = specialties.find((x) => x.slug === slug);
    if (s && !specialtyBy.has(alias)) specialtyBy.set(alias, s);
  }
  // "Dermatologist", "Gynecologist"…: a long word from a specialty name is a role, not a name.
  const roleWords = new Set([
    ...ROLE_WORDS,
    ...specialties
      .flatMap((sp) => sp.name.toLowerCase().split(/[^a-z]+/))
      .filter((w) => w.length >= 7),
  ]);
  const places = new Set(cityBy.keys());
  for (const p of options.places ?? []) if (typeof p === 'string' && p.trim()) places.add(norm(p));
  return {
    cityBy,
    specialtyBy,
    roleWords,
    places,
    facilityPhotos: options.facilityPhotos === true,
  };
}

/** Raw Doctar city strings (from `distinct`) that map onto a Curxx city: used to narrow the reads. */
export const matchingPlaces = (ctx: MappingContext, raw: unknown[]) =>
  raw.filter((v): v is string => typeof v === 'string' && ctx.cityBy.has(norm(v)));

/** A trailing "In <place>" (a full stop allowed), as scraped search pages add to speciality names. */
const PLACE_TAIL = /^(.*\S)\s+in\s+([a-z][a-z .'-]*[a-z])\.?$/i;

/**
 * A speciality or department name without a scraped place tail: "Oral Surgeon In Kolkata" → "Oral Surgeon",
 * "cancer surgeon in pimpri-chinchwad" → "cancer surgeon". Only a known place is cut, so "Blood In Urine"
 * and "Problems In Elderly" stay as they are.
 */
export function withoutPlace(name: string, ctx: MappingContext) {
  const m = name.trim().match(PLACE_TAIL);
  return m && ctx.places.has(norm(m[2])) ? m[1]! : name;
}

/** A hospital's departments without place tails, each name once (whatever its case), at most 30. */
function departmentsOf(value: unknown, ctx: MappingContext) {
  const byKey = new Map<string, string>();
  for (const d of scrubPracto(strings(value))) {
    const name = withoutPlace(d, ctx);
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  }
  return [...byKey.values()].slice(0, 30);
}

/** A Curxx locality named in the text, else Doctar's locality when it reads like one, else ''. */
function areaFor(city: City, locality: string, address = '') {
  const hay = `${locality} ${address}`.toLowerCase();
  const known = city.localities.find((l) =>
    new RegExp(`\\b${l.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay),
  );
  if (known) return known.name;
  if (/^[A-Za-z][A-Za-z .'-]{2,39}$/.test(locality)) return locality;
  return '';
}

/** Doctar's own slug when it's URL-safe, else one made from the name plus a short id. Unique either way. */
export const slugFor = (raw: string | undefined, name: string, id: string) => {
  const own = text(raw).toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(own) && own.length <= 120 && !PRACTO.test(own)) return own;
  return `${slugify(name)}-${id.slice(-6)}`;
};

// ---------------------------------------------------------------- Mapping

export type Mapped<T> = { doc: T } | { skip: string };
export type FacilityDoc = Record<string, unknown> & {
  _id: DoctarId;
  slug: string;
  city: string;
  name: string;
  area: string;
};
export type DoctorDoc = Record<string, unknown> & {
  _id: DoctarId;
  slug: string;
  city: string;
  specialty: string;
  facilitySlug: string;
};

/** A Doctar hospital as a Curxx facility, or why it can't be one. `detail` adds the page-only fields. */
export function mapHospital(
  h: DoctarHospital,
  ctx: MappingContext,
  detail = false,
): Mapped<FacilityDoc> {
  const id = String(h._id);
  const name = scrubPracto(placeName(h.name));
  if (!name) return { skip: 'no name' };
  const city = ctx.cityBy.get(norm(h.city));
  if (!city) return { skip: 'city not on Curxx' };
  const address = scrubPracto(text(h.address));
  if (!address) return { skip: 'no address' };
  let category = FACILITY_CATEGORY[norm(h.type)];
  if (!category) return { skip: 'not a medical facility type' };
  let type = CATEGORY_GROUP.get(category) ?? 'clinic';
  // Doctar's types are unreliable ("Manipal Hospitals" filed as a diagnostic centre): the name wins.
  if (/\bhospitals?\b/i.test(name) && type !== 'hospital') {
    category = 'Private Hospital';
    type = 'hospital';
  }
  const hours = weekly(h.operatingHours, { open: 'open', start: 'openTime', end: 'closeTime' });
  const allDay =
    hours &&
    hours.days.length === 7 &&
    !hours.perDay?.length &&
    hours.sessions.length === 1 &&
    hours.sessions[0]!.start === '00:00' &&
    hours.sessions[0]!.end >= '23:59';
  const lat = Number(h.coordinates?.latitude);
  const lng = Number(h.coordinates?.longitude);
  const departments = departmentsOf(h.departments, ctx);
  const doc: FacilityDoc = {
    _id: h._id,
    doctarId: id,
    source: 'doctar',
    slug: slugFor(h.slug, name, id),
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
    // No hours in Doctar: empty (the website hides them), never invented.
    openHours: !hours
      ? ''
      : allDay
        ? 'Open 24 hours'
        : describeSchedule({ ...hours, step: 30, video: 'none' }),
    opdHours: '',
    emergency24x7: h.emergency24x7 === true,
    beds:
      Number.isFinite(Number(h.totalBeds)) && Number(h.totalBeds) > 0
        ? Math.round(Number(h.totalBeds))
        : 0,
    nabh: strings(h.accreditations).some((a) => /nabh/i.test(a)),
    departments,
    specialties: [
      ...new Set(
        departments
          .map((d) => ctx.specialtyBy.get(norm(d))?.slug)
          .filter((s): s is string => Boolean(s)),
      ),
    ],
    photoUrl: ctx.facilityPhotos ? scrubPracto(text(h.coverImage) || text(h.logo)) : '',
    tagline: '',
    // No invented ratings: unrated until patients review it on Curxx.
    rating: 0,
    reviewCount: 0,
    distanceKm: 0,
    rankScore: null,
  };
  if (detail) {
    Object.assign(
      doc,
      scrubPracto({
        about: text(h.description),
        services: strings(h.services).slice(0, 30),
        amenities: strings(h.amenities).slice(0, 30),
        insurers: strings(h.insuranceAccepted).slice(0, 30),
        gallery: ctx.facilityPhotos
          ? (h.gallery ?? [])
              .map((g) => text(g.url))
              .filter(Boolean)
              .slice(0, 12)
          : [],
      }),
    );
  } else Object.assign(doc, { about: '', services: [], amenities: [], insurers: [], gallery: [] });
  return { doc };
}

/**
 * A Doctar doctor as a Curxx doctor, or why not. `schedules` are the doctor's Doctar schedules; `facilityFor`
 * turns a Doctar hospital id into its mapped facility (same city only).
 */
export function mapDoctor(
  d: DoctarDoctor,
  schedules: DoctarSchedule[],
  facilityFor: (hospitalId: string) => FacilityDoc | undefined,
  ctx: MappingContext,
  detail = false,
): Mapped<DoctorDoc> {
  const id = String(d._id);
  const fullName = scrubPracto(`${text(d.firstName)} ${text(d.lastName)}`.normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TITLES, '')
    .trim();
  if (!fullName) return { skip: 'no name' };
  if (ORGANISATION.test(fullName)) return { skip: 'organisation, not a person' };
  if (
    fullName
      .toLowerCase()
      .split(/[^a-z]+/)
      .some((w) => ctx.roleWords.has(w))
  )
    return { skip: 'generic name (a role, e.g. "Specialist")' };
  const qualification = scrubPracto(text(d.qualification));
  if (!qualification) return { skip: 'no qualification' };
  const experience = Number(d.experience);
  if (
    typeof d.experience !== 'number' ||
    !Number.isFinite(experience) ||
    experience < 0 ||
    experience > 70
  )
    return { skip: 'experience missing or invalid' };
  const specialty =
    ctx.specialtyBy.get(norm(withoutPlace(text(d.specialization), ctx))) ??
    ctx.specialtyBy.get(norm(withoutPlace(text(d.specializationList?.[0]), ctx)));
  if (!specialty) return { skip: 'specialty not on Curxx' };
  const city = ctx.cityBy.get(norm(d.location));
  if (!city) return { skip: 'city not on Curxx' };

  // Where they consult: a linked hospital in the same city (active schedules first), else names on the record.
  let facility: FacilityDoc | undefined;
  let schedule: DoctarSchedule | undefined;
  for (const s of [...schedules].sort(
    (a, b) => Number(b.isActive === true) - Number(a.isActive === true),
  )) {
    const f = facilityFor(String(s.hospital));
    if (!f || f.city !== city.slug) continue;
    facility = f;
    schedule = s;
    break;
  }
  const extraClinic = (d.extraData ?? []).find(
    (x): x is { name: string; description: string } =>
      typeof x === 'object' && x !== null && (x as { name?: unknown }).name === 'Clinic Name',
  );
  const namedClinic =
    [extraClinic?.description, d.clinicName, d.hospitalName, d.hospitals?.[0]?.name]
      .map((n) => scrubPracto(placeName(n)))
      .find(Boolean) ?? '';
  const clinicName = facility ? String(facility.name) : namedClinic;
  if (!clinicName) return { skip: 'no clinic or hospital name' };

  const ownFee = Number(d.consultationFee);
  const scheduleFee = Number(schedule?.consultationFee);
  const fee =
    typeof d.consultationFee === 'number' && ownFee > 0
      ? ownFee
      : scheduleFee > 0
        ? scheduleFee
        : NaN;
  if (!Number.isFinite(fee) || fee < 50 || fee > 20_000)
    return { skip: 'fee missing or out of range' };
  // Only a fee the doctor set themselves counts as confirmed; "system" or no feeSource reads "Approx.".
  const feeVerified =
    typeof d.consultationFee === 'number' &&
    ownFee > 0 &&
    d.feeSource != null &&
    d.feeSource !== 'system';

  const hours = schedule
    ? weekly(schedule.weeklySchedule, { open: 'isAvailable', start: 'startTime', end: 'endTime' })
    : null;
  const curxxSchedule = {
    ...(hours ?? { days: [], sessions: [], perDay: [] }),
    step: schedule?.slotDuration || 30,
    video: 'none' as const,
  };
  const gender = d.gender === 'male' || d.gender === 'female' ? d.gender : undefined;
  const name = `Dr. ${fullName}`;
  const languages = scrubPracto(strings(d.languages));
  const registration = text(d.registrationNumber);
  const doc: DoctorDoc = {
    _id: d._id,
    doctarId: id,
    source: 'doctar',
    doctarVerified: d.isAdminVerified === true,
    slug: slugFor(d.slug, name, id),
    name,
    qualification,
    title: specialty.name,
    specialty: specialty.slug,
    city: city.slug,
    area: facility ? String(facility.area) : areaFor(city, text(d.locality)) || city.name,
    clinicName,
    facilitySlug: facility ? facility.slug : '',
    // Optional: nothing stored (or guessed) when Doctar has no gender.
    ...(gender ? { gender } : {}),
    education: [],
    registration:
      detail && registration && !GENERATED_REGISTRATION.test(registration)
        ? scrubPracto(registration)
        : '',
    experienceYears: Math.round(experience),
    fee,
    videoFee: fee,
    feeVerified,
    rating: 0,
    reviewCount: 0,
    recommendPercent: 0,
    languages: languages.length ? languages : ['English'],
    focusAreas: [],
    photoUrl: /^https?:\/\//.test(text(d.avatar)) ? scrubPracto(text(d.avatar)) : '',
    // Bios come from the website's template (lib/doctor-content.ts), not from Doctar.
    about: '',
    // `verified` means Curxx checked the credentials; Doctar's check doesn't count.
    verified: false,
    schedule: curxxSchedule,
    consultHours: hours ? describeSchedule(curxxSchedule) : '',
    freeVideo: false,
    instant: false,
    slotsThrough: null,
    // A doctor's own Doctar number is their sign-in phone: never read or published. Call uses the clinic's.
    phone: '',
    whatsapp: '',
    bookable: true,
    rankScore: null,
    managed: false,
  };
  // Profile page only: every listed place the doctor consults at, with its own hours and fee.
  if (detail) doc.practices = practicesOf(schedules, facilityFor, fee);
  return { doc };
}

export type Practice = {
  facilitySlug: string;
  name: string;
  area: string;
  address: string;
  city: string;
  /** Curxx weekly schedule from Doctar's (null when Doctar has no hours for this place). */
  schedule: Schedule | null;
  consultHours: string;
  fee: number;
  /** True when the fee is this place's own (Doctar schedule), not the doctor's general one. */
  feeFromSchedule: boolean;
};

/**
 * The places a doctor consults at, from Doctar's schedules: only places Curxx lists (`facilityFor`), each
 * once, active schedules first and inactive ones left out. Hours and fee are that schedule's; never
 * invented (no hours → none shown; no fee → the doctor's own).
 */
export function practicesOf(
  schedules: DoctarSchedule[],
  facilityFor: (hospitalId: string) => FacilityDoc | undefined,
  doctorFee: number,
): Practice[] {
  const out: Practice[] = [];
  for (const s of [...schedules].sort(
    (a, b) => Number(b.isActive === true) - Number(a.isActive === true),
  )) {
    if (s.isActive === false) continue;
    const f = facilityFor(String(s.hospital));
    if (!f || out.some((p) => p.facilitySlug === f.slug)) continue;
    const hours = weekly(s.weeklySchedule, {
      open: 'isAvailable',
      start: 'startTime',
      end: 'endTime',
    });
    const schedule: Schedule | null = hours
      ? { ...hours, step: s.slotDuration || 30, video: 'none' }
      : null;
    const ownFee = Number(s.consultationFee);
    const feeFromSchedule = ownFee >= 50 && ownFee <= 20_000;
    out.push({
      facilitySlug: f.slug,
      name: String(f.name),
      area: String(f.area),
      address: String(f.address ?? ''),
      city: String(f.city),
      schedule,
      consultHours: schedule ? describeSchedule(schedule) : '',
      fee: feeFromSchedule ? ownFee : doctorFee,
      feeFromSchedule,
    });
  }
  return out;
}
