/**
 * Doctor roster. The first twelve were hand-written for the original screens; the rest
 * are generated deterministically so every specialty has a full, filterable listing.
 */

type Gender = 'female' | 'male';

export type DoctorSeed = {
  slug: string;
  name: string;
  gender: Gender;
  qualification: string;
  title: string;
  specialty: string;
  facilitySlug: string;
  experienceYears: number;
  fee: number;
  videoFee: number;
  rating: number;
  reviewCount: number;
  recommendPercent: number;
  languages: string[];
  focusAreas: string[];
  education: { degree: string; institute: string; year: number }[];
  registration: string;
  /** Explicit portrait; otherwise one is assigned from the gender-matched pool. */
  photoUrl?: string;
};

/** Where the original twelve practise, and their gender for portrait matching. */
export const ORIGINAL_DOCTOR_META: Record<string, { facilitySlug: string; gender: Gender; keepPhoto: boolean }> = {
  'dr-priya-sharma': { facilitySlug: 'skincare-super-specialty-clinic', gender: 'female', keepPhoto: true },
  'dr-rajeshwari-iyer': { facilitySlug: 'skincare-super-specialty-clinic', gender: 'female', keepPhoto: true },
  'dr-ananya-sen': { facilitySlug: 'whitefield-skin-hair-clinic', gender: 'female', keepPhoto: true },
  'dr-kavya-menon': { facilitySlug: 'apollo-clinic-koramangala', gender: 'female', keepPhoto: true },
  'dr-nikhil-rao': { facilitySlug: 'jayanagar-multispeciality-clinic', gender: 'male', keepPhoto: true },
  'dr-sneha-patil': { facilitySlug: 'hsr-family-health-centre', gender: 'female', keepPhoto: true },
  'dr-meera-nambiar': { facilitySlug: 'curxx-family-clinic', gender: 'female', keepPhoto: true },
  // These two had female portraits against male names; they get male ones from the pool.
  'dr-imran-qureshi': { facilitySlug: 'apollo-clinic-koramangala', gender: 'male', keepPhoto: false },
  'dr-arvind-swaminathan': { facilitySlug: 'koramangala-ortho-centre', gender: 'male', keepPhoto: true },
  'dr-vikram-desai': { facilitySlug: 'manipal-hospital', gender: 'male', keepPhoto: true },
  'dr-lakshmi-narayan': { facilitySlug: 'cloudnine-hospital', gender: 'female', keepPhoto: true },
  'dr-rahul-bhatt': { facilitySlug: 'aster-cmi-hospital', gender: 'male', keepPhoto: false },
};

const FEMALE_FIRST = ['Aishwarya', 'Deepa', 'Nandini', 'Shalini', 'Pooja', 'Radhika', 'Swathi', 'Divya', 'Anjali', 'Harini', 'Ritu', 'Sowmya', 'Nisha', 'Bhavana', 'Kiran', 'Madhuri', 'Tanvi', 'Vidya', 'Rekha', 'Sunita', 'Gayathri', 'Preethi', 'Lavanya', 'Neha'];
const MALE_FIRST = ['Arjun', 'Karthik', 'Siddharth', 'Vivek', 'Rohan', 'Aditya', 'Sanjay', 'Manish', 'Harish', 'Pradeep', 'Ashwin', 'Naveen', 'Rakesh', 'Suresh', 'Varun', 'Anand', 'Kiran', 'Gautam', 'Ravi', 'Deepak', 'Mohan', 'Sameer'];
const SURNAMES = ['Reddy', 'Krishnan', 'Hegde', 'Shetty', 'Kulkarni', 'Iyengar', 'Menon', 'Pillai', 'Rao', 'Nair', 'Joshi', 'Deshpande', 'Gowda', 'Bhat', 'Mehta', 'Kapoor', 'Srinivasan', 'Chandra', 'Agarwal', 'Das', 'Mukherjee', 'Varma', 'Patel', 'Naidu', 'Kamath', 'Prasad'];
const INSTITUTES = ['AIIMS New Delhi', 'CMC Vellore', 'Bangalore Medical College', 'St. John’s Medical College, Bengaluru', 'Kasturba Medical College, Manipal', 'JIPMER Puducherry', 'Maulana Azad Medical College, Delhi', 'Grant Medical College, Mumbai', 'MS Ramaiah Medical College', 'Madras Medical College'];
const REGIONAL = ['Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali'];

type SpecialtyProfile = {
  count: number;
  titles: string[];
  degrees: string[];
  feeRange: [number, number];
  videoRange: [number, number];
  facilities: string[];
  /** Share of generated doctors who are women, so the roster mirrors the specialty. */
  femaleShare: number;
};

const PROFILES: Record<string, SpecialtyProfile> = {
  'general-physician': { count: 5, titles: ['General Physician', 'Consultant Physician', 'Family Physician'], degrees: ['MD - General Medicine', 'MD - Internal Medicine', 'DNB - Family Medicine'], feeRange: [399, 599], videoRange: [249, 349], facilities: ['curxx-family-clinic', 'hsr-family-health-centre', 'apollo-clinic-koramangala', 'manipal-hospital'], femaleShare: 0.5 },
  cardiologist: { count: 5, titles: ['Interventional Cardiologist', 'Consultant Cardiologist', 'Clinical Cardiologist'], degrees: ['MD, DM - Cardiology', 'MD, DNB - Cardiology', 'MD - Medicine, DM - Cardiology'], feeRange: [799, 1199], videoRange: [499, 699], facilities: ['manipal-hospital', 'fortis-hospital-bannerghatta', 'narayana-health-city', 'fortis-medical-centre'], femaleShare: 0.4 },
  dermatologist: { count: 6, titles: ['Consultant Dermatologist', 'Dermatologist & Trichologist', 'Cosmetic Dermatologist'], degrees: ['MD - Dermatology', 'DDVL', 'DNB - Dermatology'], feeRange: [549, 799], videoRange: [299, 449], facilities: ['skincare-super-specialty-clinic', 'whitefield-skin-hair-clinic', 'apollo-clinic-koramangala'], femaleShare: 0.7 },
  pediatrician: { count: 5, titles: ['Consultant Paediatrician', 'Paediatrician & Neonatologist', 'Child Specialist'], degrees: ['MD - Paediatrics', 'DCH, DNB - Paediatrics', 'MD - Paediatrics, Fellowship Neonatology'], feeRange: [499, 749], videoRange: [299, 449], facilities: ['cloudnine-hospital', 'aster-cmi-hospital', 'curxx-family-clinic', 'narayana-health-city'], femaleShare: 0.6 },
  gynecologist: { count: 5, titles: ['Senior Gynaecologist', 'Obstetrician & Gynaecologist', 'Fertility Specialist'], degrees: ['MS - Obstetrics & Gynaecology', 'MD, DGO', 'DNB - Obstetrics & Gynaecology'], feeRange: [649, 999], videoRange: [399, 549], facilities: ['cloudnine-hospital', 'hsr-family-health-centre', 'aster-cmi-hospital', 'apollo-clinic-koramangala'], femaleShare: 0.9 },
  orthopedist: { count: 5, titles: ['Orthopaedic Surgeon', 'Joint Replacement Surgeon', 'Sports Medicine Specialist'], degrees: ['MS - Orthopaedics', 'DNB - Orthopaedics', 'MS - Orthopaedics, Fellowship Arthroplasty'], feeRange: [699, 1099], videoRange: [449, 599], facilities: ['koramangala-ortho-centre', 'sakra-world-hospital', 'manipal-hospital', 'fortis-medical-centre'], femaleShare: 0.25 },
  psychiatrist: { count: 5, titles: ['Consultant Psychiatrist', 'Psychiatrist & Therapist', 'Child & Adolescent Psychiatrist'], degrees: ['MD - Psychiatry', 'DPM, DNB - Psychiatry', 'MD - Psychiatry, Fellowship Addiction Medicine'], feeRange: [899, 1499], videoRange: [699, 999], facilities: ['curxx-family-clinic', 'hsr-family-health-centre', 'narayana-health-city', 'manipal-hospital'], femaleShare: 0.55 },
  'ent-specialist': { count: 5, titles: ['ENT Surgeon', 'Consultant Otolaryngologist', 'ENT & Head-Neck Specialist'], degrees: ['MS - ENT', 'DLO, DNB - ENT', 'MS - Otorhinolaryngology'], feeRange: [499, 799], videoRange: [299, 449], facilities: ['jayanagar-multispeciality-clinic', 'fortis-medical-centre', 'sakra-world-hospital', 'manipal-hospital'], femaleShare: 0.4 },
  gastroenterologist: { count: 5, titles: ['Consultant Gastroenterologist', 'Gastroenterologist & Hepatologist', 'Medical Gastroenterologist'], degrees: ['MD, DM - Gastroenterology', 'MD, DNB - Gastroenterology', 'MD - Medicine, DM - Hepatology'], feeRange: [749, 1199], videoRange: [449, 649], facilities: ['jayanagar-multispeciality-clinic', 'aster-cmi-hospital', 'fortis-hospital-bannerghatta', 'manipal-hospital'], femaleShare: 0.35 },
  neurologist: { count: 5, titles: ['Consultant Neurologist', 'Neurologist & Epileptologist', 'Stroke Specialist'], degrees: ['MD, DM - Neurology', 'MD, DNB - Neurology', 'MD - Medicine, DM - Neurology'], feeRange: [999, 1499], videoRange: [599, 899], facilities: ['sakra-world-hospital', 'aster-cmi-hospital', 'jayanagar-multispeciality-clinic', 'narayana-health-city'], femaleShare: 0.35 },
  ophthalmologist: { count: 5, titles: ['Consultant Ophthalmologist', 'Cataract & Refractive Surgeon', 'Retina Specialist'], degrees: ['MS - Ophthalmology', 'DNB - Ophthalmology', 'MS - Ophthalmology, Fellowship Retina'], feeRange: [499, 799], videoRange: [299, 449], facilities: ['jayanagar-multispeciality-clinic', 'fortis-medical-centre', 'sakra-world-hospital'], femaleShare: 0.5 },
  dentist: { count: 5, titles: ['Dental Surgeon', 'Orthodontist', 'Endodontist'], degrees: ['BDS, MDS - Conservative Dentistry', 'BDS, MDS - Orthodontics', 'BDS, MDS - Periodontics'], feeRange: [349, 599], videoRange: [199, 349], facilities: ['jayanagar-multispeciality-clinic', 'hsr-family-health-centre', 'apollo-clinic-koramangala'], femaleShare: 0.55 },
};

/** Small deterministic PRNG so every reseed produces the same roster. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const hashString = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const roundTo = (n: number, step: number) => Math.round(n / step) * step - 1;

/**
 * Tops each specialty up to its target count, avoiding slugs already taken.
 * `existing` maps specialty → number of hand-written doctors already there.
 */
export function generateDoctors(existing: Record<string, number>, takenSlugs: Set<string>, subSpecialties: Record<string, string[]>): DoctorSeed[] {
  const out: DoctorSeed[] = [];
  const usedNames = new Set<string>();

  for (const [specialty, profile] of Object.entries(PROFILES)) {
    const random = rng(hashString(specialty));
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!;
    const need = Math.max(0, profile.count - (existing[specialty] ?? 0));
    const focus = subSpecialties[specialty] ?? [];

    for (let i = 0; i < need; i += 1) {
      const gender: Gender = random() < profile.femaleShare ? 'female' : 'male';
      let name = '';
      let slug = '';
      for (let attempt = 0; attempt < 50; attempt += 1) {
        name = `Dr. ${pick(gender === 'female' ? FEMALE_FIRST : MALE_FIRST)} ${pick(SURNAMES)}`;
        slug = slugify(name);
        if (!usedNames.has(name) && !takenSlugs.has(slug)) break;
      }
      usedNames.add(name);
      takenSlugs.add(slug);

      const experienceYears = 6 + Math.floor(random() * 20);
      const [feeLo, feeHi] = profile.feeRange;
      const [vidLo, vidHi] = profile.videoRange;
      const seniority = Math.min(1, experienceYears / 25);
      const degree = pick(profile.degrees);
      const graduated = 2026 - experienceYears - 3;
      const regional = pick(REGIONAL);

      // Each doctor covers 2–4 of the specialty's focus areas, rotated so all are represented.
      const focusCount = Math.min(focus.length, 2 + Math.floor(random() * 3));
      const focusAreas = Array.from({ length: focusCount }, (_, k) => focus[(i + k * 2) % focus.length]!).filter((v, k, a) => a.indexOf(v) === k);

      out.push({
        slug,
        name,
        gender,
        qualification: `MBBS, ${degree}`.replace('MBBS, BDS', 'BDS'),
        title: pick(profile.titles),
        specialty,
        facilitySlug: profile.facilities[(i + Math.floor(random() * 2)) % profile.facilities.length]!,
        experienceYears,
        fee: Math.max(feeLo, roundTo(feeLo + (feeHi - feeLo) * seniority, 50)),
        videoFee: Math.max(vidLo, roundTo(vidLo + (vidHi - vidLo) * seniority, 50)),
        rating: Math.round((4.5 + random() * 0.45) * 10) / 10,
        reviewCount: 180 + Math.floor(random() * 2000),
        recommendPercent: 93 + Math.floor(random() * 7),
        languages: ['English', random() < 0.5 ? 'Hindi' : 'Kannada', regional].filter((v, k, a) => a.indexOf(v) === k),
        focusAreas,
        education: [
          { degree: degree.startsWith('BDS') ? 'BDS' : 'MBBS', institute: pick(INSTITUTES), year: graduated - 5 },
          { degree: degree.replace(/^BDS, /, ''), institute: pick(INSTITUTES), year: graduated },
        ],
        registration: `KMC ${40000 + Math.floor(random() * 50000)}`,
      });
    }
  }
  return out;
}
