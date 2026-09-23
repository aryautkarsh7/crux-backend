/**
 * The doctor roster for every city. Bangalore keeps its original 61 doctors (their slugs are
 * referenced by existing bookings) and gains the new specialties; every other city gets a full
 * roster across all 56 specialties. Everything is deterministic so re-seeding is stable.
 */
import { CITIES, type City } from './cities.js';
import { SPECIALTIES, type SpecialtySeed } from './specialties.js';
import type { FacilitySeed } from './facility-network.js';

export type Session = { start: string; end: string };
export type Schedule = {
  /** Days of week the doctor consults, 0 = Sunday. */
  days: number[];
  sessions: Session[];
  /** Minutes between slots. */
  step: number;
  /** Which slots are video: none, every third, or all (online-only doctors). */
  video: 'none' | 'mixed' | 'all';
};

export type RosterDoctor = {
  slug: string; name: string; gender: 'female' | 'male'; qualification: string; title: string; specialty: string; city: string;
  area: string; clinicName: string; facilitySlug: string; experienceYears: number; fee: number; videoFee: number;
  languages: string[]; focusAreas: string[]; education: { degree: string; institute: string; year: number }[]; registration: string;
  schedule: Schedule; freeVideo: boolean; instant: boolean; consultHours: string; photoUrl?: string; about: string;
};

type Region = 'south' | 'west' | 'north' | 'east';
const REGION: Record<string, Region> = {
  Karnataka: 'south', 'Tamil Nadu': 'south', Kerala: 'south', Telangana: 'south', 'Andhra Pradesh': 'south',
  Maharashtra: 'west', Gujarat: 'west',
  Delhi: 'north', 'Uttar Pradesh': 'north', Haryana: 'north', Chandigarh: 'north', Rajasthan: 'north', 'Madhya Pradesh': 'north',
  'West Bengal': 'east', Bihar: 'east', Jharkhand: 'east', Odisha: 'east', Assam: 'east',
};
const NAMES: Record<Region, { female: string[]; male: string[]; surnames: string[] }> = {
  south: {
    female: ['Aishwarya', 'Deepa', 'Nandini', 'Shalini', 'Radhika', 'Swathi', 'Divya', 'Harini', 'Sowmya', 'Bhavana', 'Gayathri', 'Preethi', 'Lavanya', 'Keerthana', 'Anusha', 'Meenakshi', 'Revathi', 'Sruthi'],
    male: ['Arjun', 'Karthik', 'Siddharth', 'Vivek', 'Ashwin', 'Naveen', 'Suresh', 'Varun', 'Anand', 'Pradeep', 'Harish', 'Srinivas', 'Venkatesh', 'Raghav', 'Vignesh', 'Sandeep', 'Mahesh', 'Rajesh'],
    surnames: ['Reddy', 'Krishnan', 'Hegde', 'Shetty', 'Iyengar', 'Menon', 'Pillai', 'Rao', 'Nair', 'Gowda', 'Bhat', 'Srinivasan', 'Naidu', 'Kamath', 'Subramanian', 'Raghavan', 'Varma', 'Chandran'],
  },
  west: {
    female: ['Pooja', 'Neha', 'Priyanka', 'Sneha', 'Tanvi', 'Madhuri', 'Rutuja', 'Aarti', 'Hetal', 'Krupa', 'Manasi', 'Shruti', 'Komal', 'Nikita', 'Rashmi', 'Vaishali', 'Janhavi', 'Dhara'],
    male: ['Rohan', 'Aditya', 'Sameer', 'Nikhil', 'Amit', 'Parth', 'Chirag', 'Hardik', 'Sagar', 'Omkar', 'Tushar', 'Kunal', 'Mihir', 'Prasad', 'Yash', 'Ketan', 'Rahul', 'Mayur'],
    surnames: ['Kulkarni', 'Deshpande', 'Joshi', 'Patil', 'Shah', 'Mehta', 'Desai', 'Gokhale', 'Patel', 'Pandya', 'Bhosale', 'Jadhav', 'Trivedi', 'Kapadia', 'Sawant', 'Gandhi', 'Parikh', 'Thakkar'],
  },
  north: {
    female: ['Ritu', 'Anjali', 'Neha', 'Shweta', 'Kavita', 'Pallavi', 'Nidhi', 'Ruchi', 'Sonia', 'Garima', 'Isha', 'Megha', 'Priya', 'Tanya', 'Simran', 'Aakriti', 'Jyoti', 'Swati'],
    male: ['Rohit', 'Manish', 'Gaurav', 'Vikas', 'Ankit', 'Saurabh', 'Deepak', 'Rajeev', 'Ashish', 'Pankaj', 'Varun', 'Harpreet', 'Amitabh', 'Sanjeev', 'Vineet', 'Abhishek', 'Kapil', 'Tarun'],
    surnames: ['Sharma', 'Verma', 'Gupta', 'Agarwal', 'Singh', 'Kapoor', 'Malhotra', 'Chopra', 'Srivastava', 'Mishra', 'Tiwari', 'Saxena', 'Bansal', 'Arora', 'Khanna', 'Sethi', 'Pandey', 'Chauhan'],
  },
  east: {
    female: ['Ananya', 'Moumita', 'Sreya', 'Debjani', 'Priyanka', 'Rituparna', 'Sayani', 'Tanushree', 'Madhumita', 'Nandita', 'Pritha', 'Swagata', 'Kajal', 'Rimjhim', 'Poonam', 'Archana', 'Barnali', 'Juhi'],
    male: ['Arindam', 'Sourav', 'Debashis', 'Abhijit', 'Subhajit', 'Rajib', 'Anirban', 'Kaushik', 'Prashant', 'Ranjan', 'Nitish', 'Alok', 'Manas', 'Bikash', 'Saurav', 'Sanjib', 'Amitava', 'Pranab'],
    surnames: ['Mukherjee', 'Banerjee', 'Chatterjee', 'Das', 'Bose', 'Ghosh', 'Sen', 'Roy', 'Dutta', 'Sinha', 'Jha', 'Prasad', 'Mohanty', 'Patnaik', 'Sahu', 'Baruah', 'Kumar', 'Mishra'],
  },
};
const LANGUAGE: Record<string, string> = {
  Karnataka: 'Kannada', 'Tamil Nadu': 'Tamil', Kerala: 'Malayalam', Telangana: 'Telugu', 'Andhra Pradesh': 'Telugu', Maharashtra: 'Marathi', Gujarat: 'Gujarati',
  Delhi: 'Punjabi', 'Uttar Pradesh': 'Urdu', Haryana: 'Haryanvi', Chandigarh: 'Punjabi', Rajasthan: 'Rajasthani', 'Madhya Pradesh': 'Hindi',
  'West Bengal': 'Bengali', Bihar: 'Bhojpuri', Jharkhand: 'Hindi', Odisha: 'Odia', Assam: 'Assamese',
};
const INSTITUTES: Record<Region, string[]> = {
  south: ['AIIMS New Delhi', 'CMC Vellore', 'Bangalore Medical College', 'St. John’s Medical College, Bengaluru', 'Kasturba Medical College, Manipal', 'JIPMER Puducherry', 'Madras Medical College', 'Osmania Medical College', 'Government Medical College, Kozhikode'],
  west: ['AIIMS New Delhi', 'Grant Medical College, Mumbai', 'Seth GS Medical College, Mumbai', 'BJ Medical College, Pune', 'Armed Forces Medical College, Pune', 'BJ Medical College, Ahmedabad', 'Government Medical College, Nagpur'],
  north: ['AIIMS New Delhi', 'Maulana Azad Medical College, Delhi', 'PGIMER Chandigarh', 'King George’s Medical University, Lucknow', 'SMS Medical College, Jaipur', 'Lady Hardinge Medical College', 'MGM Medical College, Indore'],
  east: ['AIIMS New Delhi', 'Medical College Kolkata', 'IPGMER & SSKM Hospital, Kolkata', 'Patna Medical College', 'RIMS Ranchi', 'SCB Medical College, Cuttack', 'Gauhati Medical College'],
};

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const roundFee = (n: number) => Math.max(0, Math.round(n / 50) * 50 - 1);

const pad = (n: number) => String(n).padStart(2, '0');
const toLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon–Sat · 10:00 AM – 1:30 PM, 5:00 PM – 9:00 PM" */
export function describeSchedule(s: Schedule) {
  const days = s.days.length === 7 ? 'All days' : s.days.join(',') === '1,2,3,4,5,6' ? 'Mon–Sat' : s.days.join(',') === '1,2,3,4,5' ? 'Mon–Fri' : s.days.map((d) => DAY_NAMES[d]).join(', ');
  if (s.sessions.length === 1 && s.sessions[0]!.start === '00:00' && s.sessions[0]!.end === '24:00') return `${days} · 24 hours (online)`;
  return `${days} · ${s.sessions.map((x) => `${toLabel(x.start)} – ${toLabel(x.end)}`).join(', ')}`;
}

/** Parses "9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM" into sessions. */
function parseOpd(opd: string): Session[] {
  const to24 = (t: string) => {
    const m = t.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (m[3]!.toUpperCase() === 'PM') h += 12;
    return `${pad(h)}:${m[2]}`;
  };
  return opd.split(',').map((range) => {
    const [a, b] = range.split(/–|-/);
    return { start: to24(a ?? '') ?? '09:00', end: to24(b ?? '') ?? '13:00' };
  });
}

/** A doctor's hours sit inside the facility's OPD hours, so clinic timing and slots agree. */
export function scheduleFor(facility: Pick<FacilitySeed, 'opdHours'>, specialty: SpecialtySeed, random: () => number, opts: { instant?: boolean } = {}): Schedule {
  if (opts.instant) return { days: [0, 1, 2, 3, 4, 5, 6], sessions: [{ start: '00:00', end: '24:00' }], step: 15, video: 'all' };
  const sessions = parseOpd(facility.opdHours);
  // Some doctors only do one of the facility's sessions; most do both.
  const chosen = sessions.length > 1 && random() < 0.25 ? [sessions[Math.floor(random() * sessions.length)]!] : sessions;
  const days = random() < 0.2 ? [1, 2, 3, 4, 5] : random() < 0.15 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  return { days, sessions: chosen, step: 30, video: specialty.video ? 'mixed' : 'none' };
}

export type RosterInput = {
  facilities: FacilitySeed[];
  /** Bangalore doctors that already exist and must keep their slugs. */
  bangaloreExisting: { slug: string; specialty: string; facilitySlug: string }[];
};

/** The generated part of the roster: new Bangalore specialties plus every other city. */
export function buildRoster({ facilities, bangaloreExisting }: RosterInput): RosterDoctor[] {
  const out: RosterDoctor[] = [];
  const taken = new Set(bangaloreExisting.map((d) => d.slug));
  const byCity = new Map<string, FacilitySeed[]>();
  for (const f of facilities) byCity.set(f.city, [...(byCity.get(f.city) ?? []), f]);
  const bangaloreHas = new Set(bangaloreExisting.map((d) => d.specialty));

  for (const city of CITIES) {
    const region = REGION[city.state] ?? 'north';
    const pools = NAMES[region];
    const cityFacilities = byCity.get(city.slug) ?? [];
    const usedNames = new Set<string>();

    for (const specialty of SPECIALTIES) {
      // Bangalore's original doctors already cover some specialties; it still gets its 24x7 online GP.
      const existing = city.slug === 'bangalore' && bangaloreHas.has(specialty.slug);
      const count = existing ? 0 : specialty.popular ? 3 : 2;
      const extraOnline = specialty.slug === 'general-physician' ? 1 : 0;
      if (count + extraOnline === 0) continue;
      const random = rng(hash(`${city.slug}:${specialty.slug}`));
      const pick = <T,>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!;
      const homes = cityFacilities.filter((f) => f.specialties.includes(specialty.slug));
      const fallback = cityFacilities.filter((f) => specialty.facilityTypes.includes(f.category));
      const pool = homes.length ? homes : fallback.length ? fallback : cityFacilities;

      for (let i = 0; i < count + extraOnline; i += 1) {
        const instant = i === count; // the extra GP consults online round the clock
        const gender: 'female' | 'male' = random() < specialty.femaleShare ? 'female' : 'male';
        let name = '';
        let slug = '';
        for (let attempt = 0; attempt < 60; attempt += 1) {
          name = `Dr. ${pick(gender === 'female' ? pools.female : pools.male)} ${pick(pools.surnames)}`;
          slug = slugify(name);
          if (taken.has(slug)) slug = `${slug}-${city.slug}`;
          if (!usedNames.has(name) && !taken.has(slug)) break;
        }
        usedNames.add(name);
        taken.add(slug);

        const facility = pool[(i + Math.floor(random() * pool.length)) % pool.length]!;
        const experienceYears = 5 + Math.floor(random() * 24);
        const seniority = Math.min(1, experienceYears / 26);
        const [feeLo, feeHi] = specialty.feeRange;
        const [vidLo, vidHi] = specialty.videoRange;
        const qualification = pick(specialty.degrees);
        const degrees = qualification.split(',').map((q) => q.trim());
        const graduated = 2026 - experienceYears - 2;
        const institutes = INSTITUTES[region];
        const schedule = scheduleFor(facility, specialty, random, { instant });
        const focus = specialty.subSpecialties.map((s) => s.slug);
        const focusCount = Math.min(focus.length, 2 + Math.floor(random() * 3));
        const focusAreas = Array.from({ length: focusCount }, (_, k) => focus[(i + k) % focus.length]!).filter((v, k, a) => a.indexOf(v) === k);
        const regional = LANGUAGE[city.state] ?? 'Hindi';
        const languages = ['English', 'Hindi', regional].filter((v, k, a) => a.indexOf(v) === k);
        const govt = ['Government Hospital', 'Primary Health Center', 'Community Health Center'].includes(facility.category);
        const title = instant ? 'Online General Physician' : pick(specialty.titles);
        const body = specialty.registrationBody ?? city.council;

        out.push({
          slug,
          name,
          gender,
          qualification,
          title,
          specialty: specialty.slug,
          city: city.slug,
          area: facility.area,
          clinicName: facility.name,
          facilitySlug: facility.slug,
          experienceYears,
          fee: govt ? roundFee(feeLo * 0.4) : Math.max(feeLo, roundFee(feeLo + (feeHi - feeLo) * seniority)),
          videoFee: Math.max(vidLo, roundFee(vidLo + (vidHi - vidLo) * seniority)),
          languages,
          focusAreas,
          education: degrees.map((degree, k) => ({ degree, institute: institutes[(i + k * 3 + hash(slug)) % institutes.length]!, year: graduated - (degrees.length - 1 - k) * 3 })),
          registration: `${body} ${20000 + Math.floor(random() * 70000)}`,
          schedule,
          // Roughly one doctor in eight offers some free video consults.
          freeVideo: specialty.video && random() < 0.13,
          instant,
          consultHours: describeSchedule(schedule),
          about: `${name} is a ${title.toLowerCase()} with ${experienceYears} years of experience, consulting at ${facility.name}, ${facility.area}, ${city.name}. ${gender === 'female' ? 'She' : 'He'} sees patients for ${specialty.conditions.slice(0, 3).map((c) => c.toLowerCase()).join(', ')}${specialty.video ? ', in person and on video,' : ' in person'} and follows up on chat for 7 days after every consultation.`,
        });
      }
    }
  }
  return out;
}

/** Schedules for the original Bangalore doctors, from their facility's OPD hours. */
export function scheduleForExisting(facility: FacilitySeed | undefined, specialtySlug: string, slug: string) {
  const specialty = SPECIALTIES.find((s) => s.slug === specialtySlug)!;
  const random = rng(hash(slug));
  const schedule = scheduleFor(facility ?? { opdHours: '10:00 AM – 1:30 PM, 5:00 PM – 9:00 PM' }, specialty, random);
  return { schedule, consultHours: describeSchedule(schedule), freeVideo: random() < 0.13 };
}

export { type City };
