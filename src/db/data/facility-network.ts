/**
 * Hospitals and clinics in every city. Each facility has a `category` (one of the 19 facility
 * types below, e.g. "Eye Hospital") separate from its departments/specialisations, and a
 * `type` (hospital | clinic) that decides which directory lists it.
 */
import { CITIES, type City, type Locality } from './cities.js';
import { FACILITIES as BANGALORE_ORIGINALS } from './facilities.js';
import { FACADES } from './images.js';

export type FacilityTypeInfo = { name: string; slug: string; group: 'hospital' | 'clinic'; icon: string; description: string };

export const FACILITY_TYPES: FacilityTypeInfo[] = [
  { name: 'Government Hospital', slug: 'government-hospital', group: 'hospital', icon: 'account_balance', description: 'State and municipal hospitals with free or subsidised care' },
  { name: 'Private Hospital', slug: 'private-hospital', group: 'hospital', icon: 'local_hospital', description: 'Privately run general hospitals' },
  { name: 'Multispecialty Hospital', slug: 'multispecialty-hospital', group: 'hospital', icon: 'domain', description: 'Large hospitals with many departments under one roof' },
  { name: 'Specialty Hospital', slug: 'specialty-hospital', group: 'hospital', icon: 'cardiology', description: 'Hospitals focused on one area such as heart, cancer or kidneys' },
  { name: 'Clinic', slug: 'clinic', group: 'clinic', icon: 'stethoscope', description: 'Doctor-led clinics for consultations and minor procedures' },
  { name: 'Polyclinic', slug: 'polyclinic', group: 'clinic', icon: 'apartment', description: 'Multi-doctor outpatient centres with several specialties' },
  { name: 'Nursing Home', slug: 'nursing-home', group: 'hospital', icon: 'bed', description: 'Small in-patient facilities for surgery, delivery and recovery' },
  { name: 'Diagnostic Center', slug: 'diagnostic-center', group: 'clinic', icon: 'biotech', description: 'Labs and imaging centres for tests and scans' },
  { name: 'Primary Health Center', slug: 'primary-health-center', group: 'clinic', icon: 'health_and_safety', description: 'Government first point of care for common illness and vaccination' },
  { name: 'Community Health Center', slug: 'community-health-center', group: 'hospital', icon: 'groups', description: 'Government referral centres with specialists and beds' },
  { name: 'Teaching Hospital', slug: 'teaching-hospital', group: 'hospital', icon: 'school', description: 'Medical-college hospitals with training and research' },
  { name: 'Day Care Center', slug: 'day-care-center', group: 'clinic', icon: 'schedule', description: 'Same-day surgery and procedures with no overnight stay' },
  { name: 'Rehabilitation Center', slug: 'rehabilitation-center', group: 'clinic', icon: 'accessible', description: 'Physiotherapy, rehab and recovery centres' },
  { name: 'Maternity Home', slug: 'maternity-home', group: 'hospital', icon: 'pregnant_woman', description: 'Pregnancy, delivery and newborn care' },
  { name: 'Eye Hospital', slug: 'eye-hospital', group: 'hospital', icon: 'visibility', description: 'Eye check-ups, cataract, LASIK and retina care' },
  { name: 'Dental Clinic', slug: 'dental-clinic', group: 'clinic', icon: 'dentistry', description: 'Dental check-ups, root canals, braces and implants' },
  { name: 'Ayurvedic Hospital', slug: 'ayurvedic-hospital', group: 'hospital', icon: 'spa', description: 'Ayurveda, Unani and Siddha treatment centres' },
  { name: 'Homeopathy Clinic', slug: 'homeopathy-clinic', group: 'clinic', icon: 'medication', description: 'Homoeopathic consultations and treatment' },
  { name: 'Veterinary Hospital', slug: 'veterinary-hospital', group: 'hospital', icon: 'pets', description: 'Vaccination, surgery and care for pets' },
];
export const FACILITY_TYPE_BY_NAME = new Map(FACILITY_TYPES.map((t) => [t.name, t]));

const INSURERS = ['Star Health', 'HDFC ERGO', 'ICICI Lombard', 'Niva Bupa', 'Care Health', 'Bajaj Allianz', 'Aditya Birla Health', 'CGHS', 'ECHS', 'Ayushman Bharat PM-JAY'];
const HOSPITAL_AMENITIES = ['24x7 Pharmacy', 'Cashless Insurance Desk', 'Wheelchair Accessible', 'Car Parking', 'Cafeteria', 'Digital Reports', 'Ambulance Service'];
const CLINIC_AMENITIES = ['Wheelchair Accessible', 'Car Parking', 'Digital Reports', 'Online Payments', 'Air-conditioned Waiting'];

type Blueprint = {
  category: string;
  names: string[];
  tagline: string;
  departments: string[];
  specialties: string[];
  services: string[];
  openHours: string;
  opdHours: string;
  emergency: boolean;
  beds: [number, number];
  nabhChance: number;
  about: (name: string, area: string, city: string) => string;
};

/** What a facility of each type offers, and which specialties practise there. */
const BLUEPRINTS: Blueprint[] = [
  {
    category: 'Multispecialty Hospital', names: ['Sunrise Multispeciality Hospital', 'Lifeline Multispeciality Hospital', 'Unity Care Hospital', 'Crescent Multispeciality Hospital'],
    tagline: 'Multispecialty care · 30+ departments', emergency: true, beds: [200, 600], nabhChance: 0.9, openHours: 'Open 24 hours', opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM',
    departments: ['Cardiology', 'Neurology', 'Orthopaedics', 'Gastroenterology', 'Nephrology', 'Urology', 'Pulmonology', 'Oncology', 'General Surgery', 'Obstetrics & Gynaecology', 'Paediatrics', 'ENT', 'Critical Care', 'Emergency Medicine'],
    specialties: ['cardiologist', 'neurologist', 'orthopedist', 'gastroenterologist', 'nephrologist', 'urologist', 'pulmonologist', 'oncologist', 'general-surgeon', 'gynecologist', 'pediatrician', 'ent-specialist', 'critical-care-medicine-specialist', 'emergency-medicine-physician', 'anesthesiologist', 'endocrinologist', 'hepatologist', 'hematologist', 'rheumatologist', 'infectious-disease-physician', 'pain-management-specialist', 'radiologist', 'general-physician'],
    services: ['24x7 Emergency & Trauma', 'ICU & NICU', 'Cath Lab', 'MRI & CT', 'Dialysis', 'Laparoscopic Surgery', 'Health Check Packages'],
    about: (n, a, c) => `${n} is a multispecialty hospital in ${a}, ${c}, with a 24x7 emergency department, intensive care units and outpatient clinics across more than 30 specialties.`,
  },
  {
    category: 'Private Hospital', names: ['Apex City Hospital', 'Harmony Hospital', 'Shree Sai Hospital', 'Pinnacle Hospital'],
    tagline: 'General hospital · medical & surgical care', emergency: true, beds: [60, 200], nabhChance: 0.6, openHours: 'Open 24 hours', opdHours: '9:30 AM – 1:30 PM, 5:00 PM – 8:00 PM',
    departments: ['General Medicine', 'General Surgery', 'Orthopaedics', 'Obstetrics & Gynaecology', 'Paediatrics', 'ENT', 'Pulmonology'],
    specialties: ['general-physician', 'general-surgeon', 'orthopedist', 'gynecologist', 'pediatrician', 'ent-specialist', 'pulmonologist', 'cardiologist', 'urologist', 'emergency-medicine-physician', 'anesthesiologist'],
    services: ['24x7 Emergency', 'Operation Theatres', 'X-Ray & Ultrasound', 'In-house Pharmacy', 'Maternity Ward'],
    about: (n, a, c) => `${n} is a ${c} general hospital in ${a} offering medical, surgical, maternity and emergency care with round-the-clock doctors on duty.`,
  },
  {
    category: 'Government Hospital', names: ['Government General Hospital', 'District Government Hospital'],
    tagline: 'Government hospital · free & subsidised care', emergency: true, beds: [300, 1200], nabhChance: 0.3, openHours: 'Open 24 hours', opdHours: '8:00 AM – 2:00 PM',
    departments: ['General Medicine', 'General Surgery', 'Obstetrics & Gynaecology', 'Paediatrics', 'Orthopaedics', 'Emergency Medicine', 'TB & Chest'],
    specialties: ['general-physician', 'general-surgeon', 'gynecologist', 'pediatrician', 'orthopedist', 'emergency-medicine-physician', 'pulmonologist', 'infectious-disease-physician', 'venereologist', 'critical-care-medicine-specialist'],
    services: ['24x7 Casualty', 'Free Medicines (Jan Aushadhi)', 'Ayushman Bharat PM-JAY', 'Blood Bank', 'Vaccination'],
    about: (n, a, c) => `${n}, ${a} is a government referral hospital for ${c} with free outpatient care, a 24x7 casualty and in-patient wards covering all major specialties.`,
  },
  {
    category: 'Specialty Hospital', names: ['Heartline Cardiac Institute', 'Hope Cancer Centre', 'Nephrolife Kidney & Urology Institute', 'NeuroCare Brain & Spine Hospital'],
    tagline: 'Super-specialty care', emergency: true, beds: [100, 350], nabhChance: 0.85, openHours: 'Open 24 hours', opdHours: '9:00 AM – 5:00 PM',
    departments: ['Cardiology', 'Cardiothoracic Surgery', 'Oncology', 'Nephrology', 'Urology', 'Neurology', 'Neurosurgery'],
    specialties: ['cardiologist', 'oncologist', 'nephrologist', 'urologist', 'neurologist', 'hematologist', 'hepatologist', 'critical-care-medicine-specialist', 'fertility-infertility-specialist', 'andrologist'],
    services: ['24x7 Cardiac Emergency', 'Cath Lab', 'Chemotherapy Day Care', 'Dialysis', 'Neuro ICU'],
    about: (n, a, c) => `${n} in ${a} is a dedicated super-specialty hospital in ${c}, with specialist teams, advanced imaging and intensive care for complex conditions.`,
  },
  {
    category: 'Teaching Hospital', names: ['Institute of Medical Sciences & Research', 'Medical College Hospital'],
    tagline: 'Medical college hospital', emergency: true, beds: [500, 1500], nabhChance: 0.5, openHours: 'Open 24 hours', opdHours: '8:30 AM – 1:30 PM',
    departments: ['General Medicine', 'General Surgery', 'Paediatrics', 'Obstetrics & Gynaecology', 'Orthopaedics', 'Psychiatry', 'Dermatology', 'Radiology', 'Pathology', 'Anaesthesia'],
    specialties: ['general-physician', 'general-surgeon', 'pediatrician', 'gynecologist', 'orthopedist', 'psychiatrist', 'dermatologist', 'radiologist', 'pathologist', 'anesthesiologist', 'rehab-physical-medicine-specialist', 'infectious-disease-physician', 'geriatrician'],
    services: ['24x7 Emergency', 'Specialty OPDs', 'Blood Bank', 'Advanced Imaging', 'Research Clinics'],
    about: (n, a, c) => `${n}, ${a} is a teaching hospital attached to a ${c} medical college, with faculty-led specialty clinics and a busy emergency department.`,
  },
  {
    category: 'Nursing Home', names: ['Sanjeevani Nursing Home', 'Mother Care Nursing Home', 'Arogya Nursing Home'],
    tagline: 'Surgery, delivery & recovery', emergency: false, beds: [20, 50], nabhChance: 0.3, openHours: 'Open 24 hours', opdHours: '10:00 AM – 1:00 PM, 5:00 PM – 8:00 PM',
    departments: ['General Surgery', 'Obstetrics & Gynaecology', 'General Medicine', 'Geriatric Care'],
    specialties: ['general-surgeon', 'gynecologist', 'general-physician', 'geriatrician'],
    services: ['Normal & C-section Delivery', 'Minor Surgery', 'In-patient Recovery', 'Elderly Care'],
    about: (n, a, c) => `${n} is a small in-patient facility in ${a}, ${c}, for planned surgery, deliveries and recovery care with round-the-clock nursing.`,
  },
  {
    category: 'Maternity Home', names: ['Janani Maternity & Child Care', 'Little Steps Mother & Child Hospital', 'Motherhood Care Centre'],
    tagline: 'Maternity & newborn care', emergency: true, beds: [30, 120], nabhChance: 0.6, openHours: 'Open 24 hours', opdHours: '9:00 AM – 1:00 PM, 5:00 PM – 8:00 PM',
    departments: ['Obstetrics & Gynaecology', 'Neonatology', 'Paediatrics', 'Fertility'],
    specialties: ['gynecologist', 'neonatologist', 'pediatrician', 'fertility-infertility-specialist', 'dietician', 'anesthesiologist'],
    services: ['Labour & Delivery Suites', 'Level II NICU', 'Painless Delivery', 'Antenatal Classes', 'Lactation Support'],
    about: (n, a, c) => `${n} in ${a} is a mother-and-child hospital in ${c}, with private labour suites, a newborn intensive care unit and 24x7 obstetricians.`,
  },
  {
    category: 'Eye Hospital', names: ['Drishti Eye Hospital', 'ClearSight Eye Hospital', 'Nayan Eye Care'],
    tagline: 'Complete eye care', emergency: false, beds: [10, 40], nabhChance: 0.6, openHours: '8:00 AM – 8:00 PM', opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:30 PM',
    departments: ['Ophthalmology', 'Cataract', 'Retina', 'Cornea & LASIK', 'Optometry'],
    specialties: ['ophthalmologist', 'optometrist'],
    services: ['Cataract Surgery', 'LASIK', 'Retina Clinic', 'Glaucoma Clinic', 'Spectacles & Contact Lenses'],
    about: (n, a, c) => `${n} is an eye hospital in ${a}, ${c}, offering eye tests, spectacles, cataract and refractive surgery, and retina care.`,
  },
  {
    category: 'Dental Clinic', names: ['Smile Studio Dental Care', 'Pearl Dental Clinic', 'Toothfairy Dental Care'],
    tagline: 'Complete dental care', emergency: false, beds: [0, 0], nabhChance: 0.2, openHours: '10:00 AM – 9:00 PM', opdHours: '10:00 AM – 1:30 PM, 5:00 PM – 9:00 PM',
    departments: ['General Dentistry', 'Endodontics', 'Orthodontics', 'Prosthodontics', 'Implantology'],
    specialties: ['dentist', 'endodontist', 'prosthodontist', 'implantologist'],
    services: ['Root Canal', 'Braces & Aligners', 'Implants', 'Cleaning & Whitening', 'Crowns & Dentures'],
    about: (n, a, c) => `${n} is a dental clinic in ${a}, ${c}, covering check-ups, root canals, braces, crowns and implants.`,
  },
  {
    category: 'Ayurvedic Hospital', names: ['Ayurmitra Ayurveda Hospital', 'Dhanvantari Ayurveda & Wellness', 'Prakriti AYUSH Hospital'],
    tagline: 'Ayurveda, Unani, Siddha & Yoga', emergency: false, beds: [10, 40], nabhChance: 0.3, openHours: '8:00 AM – 8:00 PM', opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM',
    departments: ['Ayurveda', 'Panchakarma', 'Unani', 'Siddha', 'Yoga & Naturopathy'],
    specialties: ['ayurveda', 'unani', 'siddha', 'yoga-naturopathy'],
    services: ['Panchakarma', 'Hijama', 'Varma Therapy', 'Yoga Therapy', 'Herbal Pharmacy'],
    about: (n, a, c) => `${n} in ${a} is an AYUSH hospital in ${c}, offering Ayurveda, Panchakarma, Unani, Siddha and yoga therapy.`,
  },
  {
    category: 'Homeopathy Clinic', names: ['Samyak Homoeopathy Clinic', 'Healwell Homoeopathy', 'Similia Homoeopathy Centre'],
    tagline: 'Classical homoeopathy', emergency: false, beds: [0, 0], nabhChance: 0.1, openHours: '10:00 AM – 8:00 PM', opdHours: '10:00 AM – 1:30 PM, 5:00 PM – 8:00 PM',
    departments: ['Homoeopathy'], specialties: ['homeopathic'],
    services: ['Chronic Disease Clinic', 'Allergy Clinic', 'Skin & Hair Clinic', 'Paediatric Homoeopathy'],
    about: (n, a, c) => `${n} is a homoeopathy clinic in ${a}, ${c}, for allergies, skin and hair problems and long-term conditions.`,
  },
  {
    category: 'Veterinary Hospital', names: ['Paws & Claws Pet Hospital', 'Happy Tails Veterinary Hospital', 'PetCare Veterinary Clinic'],
    tagline: 'Pet care & surgery', emergency: true, beds: [5, 20], nabhChance: 0, openHours: '9:00 AM – 9:00 PM', opdHours: '9:00 AM – 1:00 PM, 5:00 PM – 9:00 PM',
    departments: ['Veterinary Medicine', 'Veterinary Surgery', 'Pet Dentistry', 'Grooming'], specialties: ['veterinarian'],
    services: ['Vaccination', 'Spay & Neuter', 'Pet Surgery', 'Deworming', 'Pet Pharmacy'],
    about: (n, a, c) => `${n} is a veterinary hospital in ${a}, ${c}, for vaccinations, surgery and everyday care for dogs, cats and small pets.`,
  },
  {
    category: 'Rehabilitation Center', names: ['ReStore Rehab & Physiotherapy Centre', 'Active Life Rehabilitation Centre', 'Mobility Rehab Centre'],
    tagline: 'Physiotherapy & rehabilitation', emergency: false, beds: [0, 20], nabhChance: 0.2, openHours: '7:00 AM – 8:00 PM', opdHours: '8:00 AM – 12:00 PM, 4:00 PM – 8:00 PM',
    departments: ['Physiotherapy', 'Physical Medicine & Rehabilitation', 'Sports Medicine', 'Speech Therapy', 'Audiology'],
    specialties: ['physiotherapist', 'rehab-physical-medicine-specialist', 'sports-medicine-physician', 'chiropractor', 'speech-therapist', 'audiologist', 'acupuncturist', 'psychiatrist'],
    services: ['Physiotherapy Gym', 'Stroke Rehab', 'Sports Rehab', 'Speech Therapy', 'Home Physiotherapy'],
    about: (n, a, c) => `${n} in ${a} is a ${c} rehabilitation centre with physiotherapy, sports and neuro rehab, and speech therapy under one roof.`,
  },
  {
    category: 'Clinic', names: ['Care First Family Clinic', 'Wellspring Clinic', 'Healing Touch Clinic'],
    tagline: 'Family medicine & specialist clinics', emergency: false, beds: [0, 0], nabhChance: 0.3, openHours: '8:00 AM – 10:00 PM', opdHours: '9:00 AM – 1:00 PM, 5:00 PM – 9:30 PM',
    departments: ['General Medicine', 'Dermatology', 'Psychiatry', 'Dietetics', 'Sexual Health'],
    specialties: ['general-physician', 'dermatologist', 'cosmetologist', 'psychiatrist', 'dietician', 'nutritionist', 'sexologist', 'venereologist', 'quit-smoking-specialist', 'endocrinologist', 'allergist-immunologist', 'geriatrician'],
    services: ['Walk-in Consultations', 'Chronic Care Reviews', 'Vaccinations', 'Counselling', 'Home Sample Collection'],
    about: (n, a, c) => `${n} is a neighbourhood clinic in ${a}, ${c}, with family doctors and visiting specialists, open early and late for working patients.`,
  },
  {
    category: 'Polyclinic', names: ['Medipoint Polyclinic', 'CityCare Polyclinic', 'Zenith Polyclinic & Diagnostics'],
    tagline: 'Multi-specialty outpatient centre', emergency: false, beds: [0, 10], nabhChance: 0.5, openHours: '7:00 AM – 9:00 PM', opdHours: '8:00 AM – 1:00 PM, 4:00 PM – 9:00 PM',
    departments: ['General Medicine', 'Paediatrics', 'Gynaecology', 'ENT', 'Endocrinology', 'Pulmonology', 'Rheumatology'],
    specialties: ['general-physician', 'pediatrician', 'gynecologist', 'ent-specialist', 'endocrinologist', 'pulmonologist', 'rheumatologist', 'allergist-immunologist', 'dermatologist', 'orthopedist', 'dietician'],
    services: ['Specialist OPDs', 'Blood Collection', 'ECG', 'X-Ray', 'Health Checks'],
    about: (n, a, c) => `${n} in ${a} is a ${c} polyclinic with several specialists, same-day diagnostics and health check packages.`,
  },
  {
    category: 'Diagnostic Center', names: ['Precision Diagnostics & Imaging', 'Metro Scan & Labs', 'ClearView Imaging Centre'],
    tagline: 'Labs, X-ray, ultrasound, CT & MRI', emergency: false, beds: [0, 0], nabhChance: 0.4, openHours: '6:30 AM – 10:00 PM', opdHours: '8:00 AM – 2:00 PM',
    departments: ['Radiology', 'Pathology', 'Cardiology Diagnostics'], specialties: ['radiologist', 'pathologist'],
    services: ['MRI', 'CT Scan', 'Ultrasound & Doppler', 'Digital X-Ray', 'Blood Tests', 'ECG & 2D Echo'],
    about: (n, a, c) => `${n} is a diagnostic centre in ${a}, ${c}, with an NABL-accredited lab and imaging from X-ray and ultrasound to CT and MRI.`,
  },
  {
    category: 'Day Care Center', names: ['OneDay Surgery Centre', 'Swift Day Care Surgical Centre'],
    tagline: 'Same-day surgery & procedures', emergency: false, beds: [8, 20], nabhChance: 0.5, openHours: '7:00 AM – 9:00 PM', opdHours: '9:00 AM – 5:00 PM',
    departments: ['General Surgery', 'Proctology', 'Pain Management', 'Cosmetic Procedures', 'Endoscopy'],
    specialties: ['general-surgeon', 'pain-management-specialist', 'anesthesiologist', 'cosmetologist', 'nutritionist', 'yoga-naturopathy'],
    services: ['Laser Piles & Fissure', 'Day-care Hernia Repair', 'Endoscopy', 'Pain Procedures', 'Chemotherapy Day Care'],
    about: (n, a, c) => `${n} in ${a} is a ${c} day-care surgical centre for procedures that let you go home the same day.`,
  },
  {
    category: 'Primary Health Center', names: ['Urban Primary Health Centre'],
    tagline: 'Government primary care', emergency: false, beds: [0, 6], nabhChance: 0, openHours: '9:00 AM – 4:00 PM', opdHours: '9:00 AM – 4:00 PM',
    departments: ['General Medicine', 'Maternal & Child Health', 'Immunisation'], specialties: ['general-physician'],
    services: ['Free OPD', 'Vaccination', 'Antenatal Check-ups', 'TB & NCD Screening', 'Free Medicines'],
    about: (n, a, c) => `${n}, ${a} is a government primary health centre in ${c}, providing free consultations, vaccinations, antenatal care and basic medicines.`,
  },
  {
    category: 'Community Health Center', names: ['Community Health Centre'],
    tagline: 'Government referral centre', emergency: true, beds: [30, 60], nabhChance: 0.1, openHours: 'Open 24 hours', opdHours: '9:00 AM – 4:00 PM',
    departments: ['General Medicine', 'General Surgery', 'Obstetrics & Gynaecology', 'Paediatrics'], specialties: ['general-physician', 'general-surgeon', 'gynecologist', 'pediatrician'],
    services: ['24x7 Delivery Care', 'Emergency Care', 'Specialist OPDs', 'Free Medicines', 'Ambulance (108)'],
    about: (n, a, c) => `${n}, ${a} is a government community health centre serving ${c} with specialists, a labour room and emergency care.`,
  },
];
export const BLUEPRINT_BY_CATEGORY = new Map(BLUEPRINTS.map((b) => [b.category, b]));

/** Category and specialties for the hand-written Bangalore facilities. */
const ORIGINAL_CATEGORY: Record<string, { category: string; specialties: string[]; opdHours: string }> = {
  'manipal-hospital': { category: 'Multispecialty Hospital', specialties: BLUEPRINT_BY_CATEGORY.get('Multispecialty Hospital')!.specialties, opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM' },
  'aster-cmi-hospital': { category: 'Multispecialty Hospital', specialties: BLUEPRINT_BY_CATEGORY.get('Multispecialty Hospital')!.specialties, opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM' },
  'cloudnine-hospital': { category: 'Maternity Home', specialties: BLUEPRINT_BY_CATEGORY.get('Maternity Home')!.specialties, opdHours: '9:00 AM – 1:00 PM, 5:00 PM – 8:00 PM' },
  'fortis-hospital-bannerghatta': { category: 'Multispecialty Hospital', specialties: BLUEPRINT_BY_CATEGORY.get('Multispecialty Hospital')!.specialties, opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM' },
  'sakra-world-hospital': { category: 'Multispecialty Hospital', specialties: BLUEPRINT_BY_CATEGORY.get('Multispecialty Hospital')!.specialties, opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM' },
  'narayana-health-city': { category: 'Specialty Hospital', specialties: BLUEPRINT_BY_CATEGORY.get('Specialty Hospital')!.specialties, opdHours: '9:00 AM – 5:00 PM' },
  'apollo-clinic-koramangala': { category: 'Polyclinic', specialties: BLUEPRINT_BY_CATEGORY.get('Polyclinic')!.specialties, opdHours: '8:00 AM – 1:00 PM, 4:00 PM – 9:00 PM' },
  'fortis-medical-centre': { category: 'Polyclinic', specialties: BLUEPRINT_BY_CATEGORY.get('Polyclinic')!.specialties, opdHours: '8:00 AM – 1:00 PM, 4:00 PM – 8:00 PM' },
  'skincare-super-specialty-clinic': { category: 'Clinic', specialties: ['dermatologist', 'cosmetologist'], opdHours: '10:00 AM – 1:30 PM, 4:30 PM – 8:00 PM' },
  'whitefield-skin-hair-clinic': { category: 'Clinic', specialties: ['dermatologist', 'cosmetologist', 'allergist-immunologist'], opdHours: '10:00 AM – 1:30 PM, 4:30 PM – 8:30 PM' },
  'curxx-family-clinic': { category: 'Clinic', specialties: BLUEPRINT_BY_CATEGORY.get('Clinic')!.specialties, opdHours: '9:00 AM – 1:00 PM, 5:00 PM – 9:30 PM' },
  'koramangala-ortho-centre': { category: 'Rehabilitation Center', specialties: ['orthopedist', 'physiotherapist', 'sports-medicine-physician', 'chiropractor'], opdHours: '9:00 AM – 1:00 PM, 4:00 PM – 8:00 PM' },
  'jayanagar-multispeciality-clinic': { category: 'Polyclinic', specialties: ['ophthalmologist', 'ent-specialist', 'dentist', 'gastroenterologist', 'neurologist', 'optometrist', 'audiologist'], opdHours: '8:30 AM – 1:00 PM, 4:00 PM – 9:00 PM' },
  'hsr-family-health-centre': { category: 'Clinic', specialties: ['general-physician', 'gynecologist', 'psychiatrist', 'dentist', 'dermatologist', 'dietician'], opdHours: '8:00 AM – 1:00 PM, 5:00 PM – 9:30 PM' },
};

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
};

export type FacilitySeed = {
  slug: string; name: string; shortName: string; type: 'hospital' | 'clinic'; category: string; city: string; area: string; address: string;
  pincode: string; geo: { lat: number; lng: number }; phone: string; tagline: string; about: string; rating: number; reviewCount: number;
  distanceKm: number; emergency24x7: boolean; nabh: boolean; beds: number; established: number; openHours: string; opdHours: string;
  departments: string[]; specialties: string[]; services: string[]; amenities: string[]; insurers: string[]; photoUrl: string;
};

/** Categories each city needs so every specialty has somewhere to practise. */
const CITY_MIX: string[] = [
  'Multispecialty Hospital', 'Multispecialty Hospital', 'Private Hospital', 'Government Hospital', 'Specialty Hospital', 'Teaching Hospital',
  'Nursing Home', 'Maternity Home', 'Eye Hospital', 'Dental Clinic', 'Ayurvedic Hospital', 'Homeopathy Clinic', 'Veterinary Hospital',
  'Rehabilitation Center', 'Clinic', 'Clinic', 'Polyclinic', 'Diagnostic Center', 'Day Care Center', 'Primary Health Center', 'Community Health Center',
];
/** Bangalore already has hospitals, polyclinics and clinics; top up the other types. */
const BANGALORE_EXTRA = CITY_MIX.filter((c) => !['Multispecialty Hospital', 'Polyclinic', 'Clinic', 'Specialty Hospital', 'Maternity Home'].includes(c));

function makeFacility(city: City, category: string, index: number, used: Set<string>): FacilitySeed {
  const bp = BLUEPRINT_BY_CATEGORY.get(category)!;
  const random = rng(hash(`${city.slug}:${category}:${index}`));
  const locality: Locality = city.localities[Math.floor(random() * city.localities.length)]!;
  const isGovt = ['Government Hospital', 'Primary Health Center', 'Community Health Center'].includes(category);
  let base = bp.names[(index + hash(city.slug)) % bp.names.length]!;
  if (category === 'Teaching Hospital') base = `${city.name} ${base}`;
  const name = isGovt ? `${base}, ${locality.name}` : `${base}, ${locality.name}`;
  let slug = slugify(`${base}-${locality.name}-${city.slug}`);
  while (used.has(slug)) slug = `${slug}-${index}`;
  used.add(slug);
  const [bLo, bHi] = bp.beds;
  const centre = city.localities[0]!;
  const facilityType = FACILITY_TYPE_BY_NAME.get(category)!;
  return {
    slug,
    name,
    shortName: base,
    type: facilityType.group,
    category,
    city: city.slug,
    area: locality.name,
    address: `${10 + Math.floor(random() * 480)}, ${['Main Road', 'Cross Road', 'Ring Road', 'Station Road', 'Market Road'][Math.floor(random() * 5)]}, ${locality.name}, ${city.name} ${locality.pincode}`,
    pincode: locality.pincode,
    geo: { lat: locality.lat + (random() - 0.5) * 0.01, lng: locality.lng + (random() - 0.5) * 0.01 },
    phone: `0${70 + Math.floor(random() * 20)} ${4000 + Math.floor(random() * 5000)} ${1000 + Math.floor(random() * 8999)}`,
    tagline: bp.tagline,
    about: bp.about(name, locality.name, city.name),
    rating: Math.round((4.2 + random() * 0.7) * 10) / 10,
    reviewCount: 120 + Math.floor(random() * (facilityType.group === 'hospital' ? 9000 : 2500)),
    distanceKm: km(centre, locality),
    emergency24x7: bp.emergency,
    nabh: random() < bp.nabhChance,
    beds: bLo === 0 && bHi === 0 ? 0 : bLo + Math.floor(random() * (bHi - bLo)),
    established: 1975 + Math.floor(random() * 48),
    openHours: bp.openHours,
    opdHours: bp.opdHours,
    departments: bp.departments,
    specialties: bp.specialties,
    services: bp.services,
    amenities: facilityType.group === 'hospital' ? HOSPITAL_AMENITIES : CLINIC_AMENITIES,
    insurers: isGovt ? ['Ayushman Bharat PM-JAY', 'CGHS', 'ECHS'] : INSURERS.slice(0, 4 + Math.floor(random() * 5)),
    photoUrl: FACADES[Math.floor(random() * FACADES.length)]!,
  };
}

/** Every facility on Curxx: Bangalore's originals (with categories) plus a generated network per city. */
export function buildFacilities(): FacilitySeed[] {
  const used = new Set<string>(BANGALORE_ORIGINALS.map((f) => f.slug));
  const bangalore = CITIES.find((c) => c.slug === 'bangalore')!;
  const originals: FacilitySeed[] = BANGALORE_ORIGINALS.map((f) => {
    const meta = ORIGINAL_CATEGORY[f.slug]!;
    const locality = bangalore.localities.find((l) => l.name === f.area) ?? bangalore.localities[0]!;
    const pin = f.address.match(/\b(\d{6})\b/)?.[1] ?? locality.pincode;
    return {
      ...(f as unknown as Omit<FacilitySeed, 'category' | 'city' | 'pincode' | 'geo' | 'opdHours' | 'specialties'>),
      beds: 'beds' in f ? (f.beds as number) : 0,
      category: meta.category,
      city: 'bangalore',
      pincode: pin,
      geo: { lat: locality.lat, lng: locality.lng },
      opdHours: meta.opdHours,
      specialties: meta.specialties,
      departments: [...f.departments],
      services: [...f.services],
      amenities: [...f.amenities],
      insurers: [...f.insurers],
    };
  });

  const generated: FacilitySeed[] = [];
  for (const city of CITIES) {
    const mix = city.slug === 'bangalore' ? BANGALORE_EXTRA : CITY_MIX;
    mix.forEach((category, i) => generated.push(makeFacility(city, category, i, used)));
  }
  return [...originals, ...generated];
}
