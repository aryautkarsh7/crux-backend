/** Partner diagnostic labs across Bengaluru. Lab orders are assigned to one of these by pincode. */

const LAB_PHOTO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCwu5owhCgxV-ZuLFrP6N0j8o7REsL33cYSZ-igKDivGBT_ApQr_YWhm437wc9S9h2PKqIhT4WagifiPv7AW5vOCM4WLosLoobANYEkLX_skYchD9d1IKLGr0F1m0r_Ve5UyVodiaM_Bo5cQCzaglhZcUhn4MLeBpNT6I258Y1KbrMiDSLV60wPpONpkCPuMrahhOwBF_dgEYnjOOazhoOCacLhzxYhmLdIeB3Ld5NgH-ulm_LV_Klq';

/** Every test in the catalogue — reference labs run all of them. */
const ALL_TESTS = [
  'comprehensive-full-body-checkup', 'advanced-diabetic-profile', 'senior-citizen-active-health', 'womens-wellness-comprehensive',
  'thyroid-hormone-care', 'heart-health-lipid-screen', 'complete-blood-count', 'hba1c', 'fasting-blood-sugar', 'lipid-profile',
  'liver-function-test', 'kidney-function-test', 'thyroid-profile-total', 'tsh-ultrasensitive', 'vitamin-d-25-oh', 'vitamin-b12',
  'iron-studies', 'dengue-ns1-antigen', 'typhoid-widal', 'urine-routine', 'allergy-panel-inhalant', 'psa-total',
];
/** Specialised assays only reference labs run. */
const REFERENCE_ONLY = ['allergy-panel-inhalant', 'psa-total', 'senior-citizen-active-health'];
const ROUTINE_TESTS = ALL_TESTS.filter((t) => !REFERENCE_ONLY.includes(t));
/** A walk-in collection point handles only quick, common panels. */
const BASIC_TESTS = ['complete-blood-count', 'hba1c', 'fasting-blood-sugar', 'lipid-profile', 'thyroid-profile-total', 'tsh-ultrasensitive', 'urine-routine', 'vitamin-d-25-oh', 'vitamin-b12', 'typhoid-widal', 'dengue-ns1-antigen'];

const CORE_EQUIPMENT = ['Sysmex XN-1000 haematology analyser', 'Roche Cobas c311 chemistry analyser', 'Bio-Rad D-10 HbA1c (HPLC)'];
const REFERENCE_EQUIPMENT = [...CORE_EQUIPMENT, 'Roche Cobas e601 immunoassay', 'Siemens Atellica IM', 'Phadia ImmunoCAP 250 (allergy)', 'Automated sample sorter with barcode tracking'];
const AMENITIES = ['Separate women’s collection room', 'Paediatric phlebotomy', 'Wheelchair accessible', 'Digital reports on WhatsApp & Curxx', 'Air-conditioned waiting'];

export const LABS = [
  {
    slug: 'curxx-diagnostics-koramangala', name: 'Curxx Diagnostics Reference Lab', shortName: 'Curxx Diagnostics', type: 'reference',
    area: 'Koramangala', address: '42, 80 Feet Road, Koramangala 5th Block, Bengaluru 560095', pincode: '560095', geo: { lat: 12.9338, lng: 77.6187 },
    phone: '080 4719 0200', tagline: 'Central reference lab · all 22 tests in-house',
    accreditations: ['NABL', 'CAP', 'ISO 15189'], nablCertificate: 'MC-3471', rating: 4.8, reviewCount: 3124, established: 2016,
    openHours: '6:30 AM – 10:00 PM', sundayHours: '6:30 AM – 2:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 25, phlebotomists: 8,
    reportTat: '6–24 hours', pathologist: { name: 'Dr. Kavitha Rao', qualification: 'MD Pathology', registration: 'KMC 61254' },
    tests: ALL_TESTS, equipment: REFERENCE_EQUIPMENT, amenities: [...AMENITIES, 'Car parking'], photoUrl: LAB_PHOTO,
    about: 'Curxx’s central reference laboratory processes samples from every home collection in the city. It runs a CAP-accredited immunoassay section, an allergy (ImmunoCAP) bench and barcode-tracked sample sorting, with a pathologist signing off every report.',
  },
  {
    slug: 'medisure-diagnostics-indiranagar', name: 'Medisure Diagnostics', shortName: 'Medisure', type: 'centre',
    area: 'Indiranagar', address: '1127, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038', pincode: '560038', geo: { lat: 12.9762, lng: 77.6405 },
    phone: '080 4112 7788', tagline: 'Walk-in lab on 100 Feet Road',
    accreditations: ['NABL'], nablCertificate: 'MC-2987', rating: 4.7, reviewCount: 1860, established: 2012,
    openHours: '7:00 AM – 9:00 PM', sundayHours: '7:00 AM – 1:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 8, phlebotomists: 5,
    reportTat: '8–24 hours', pathologist: { name: 'Dr. Sanjay Menon', qualification: 'MD Pathology', registration: 'KMC 55890' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: AMENITIES, photoUrl: LAB_PHOTO,
    about: 'A neighbourhood diagnostic centre a short walk from Indiranagar Metro. Routine blood, urine and thyroid panels are run on site; specialised assays go to the Curxx reference lab the same day.',
  },
  {
    slug: 'nova-pathology-jayanagar', name: 'Nova Pathology Laboratory', shortName: 'Nova Pathology', type: 'reference',
    area: 'Jayanagar', address: '312, 11th Main, 4th Block, Jayanagar, Bengaluru 560011', pincode: '560011', geo: { lat: 12.9255, lng: 77.5838 },
    phone: '080 2663 4455', tagline: 'Reference lab for South Bengaluru',
    accreditations: ['NABL', 'CAP'], nablCertificate: 'MC-2210', rating: 4.8, reviewCount: 2475, established: 2004,
    openHours: '6:30 AM – 9:30 PM', sundayHours: '6:30 AM – 1:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 25, phlebotomists: 8,
    reportTat: '6–24 hours', pathologist: { name: 'Dr. Ramesh Iyengar', qualification: 'MD Pathology, DNB', registration: 'KMC 40318' },
    tests: ALL_TESTS, equipment: REFERENCE_EQUIPMENT, amenities: [...AMENITIES, 'Car parking'], photoUrl: LAB_PHOTO,
    about: 'One of Jayanagar’s longest-running pathology labs, Nova runs a full immunoassay and allergy bench and serves as the processing hub for collections south of Lalbagh.',
  },
  {
    slug: 'clearpath-labs-whitefield', name: 'Clearpath Labs', shortName: 'Clearpath', type: 'centre',
    area: 'Whitefield', address: '22, ITPL Main Road, near Forum Shantiniketan, Whitefield, Bengaluru 560066', pincode: '560066', geo: { lat: 12.9855, lng: 77.731 },
    phone: '080 4093 2211', tagline: 'Early-morning collections on the ITPL corridor',
    accreditations: ['NABL', 'ISO 15189'], nablCertificate: 'MC-4102', rating: 4.6, reviewCount: 1342, established: 2017,
    openHours: '6:00 AM – 9:00 PM', sundayHours: '6:00 AM – 12:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 9, phlebotomists: 5,
    reportTat: '8–24 hours', pathologist: { name: 'Dr. Aparna Kulkarni', qualification: 'MD Pathology', registration: 'KMC 66031' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: [...AMENITIES, 'Car parking'], photoUrl: LAB_PHOTO,
    about: 'Opens at 6 AM for fasting samples before the office commute. Serves Whitefield, Kadugodi, Brookefield and Varthur.',
  },
  {
    slug: 'precision-path-hsr', name: 'Precision Path Labs', shortName: 'Precision Path', type: 'centre',
    area: 'HSR Layout', address: '1st Floor, 27th Main, Sector 1, HSR Layout, Bengaluru 560102', pincode: '560102', geo: { lat: 12.9121, lng: 77.6446 },
    phone: '080 4861 3300', tagline: 'Same-day thyroid & diabetes reports',
    accreditations: ['NABL', 'ISO 15189'], nablCertificate: 'MC-3890', rating: 4.7, reviewCount: 1528, established: 2015,
    openHours: '6:30 AM – 9:00 PM', sundayHours: '7:00 AM – 1:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 8, phlebotomists: 4,
    reportTat: '6–12 hours', pathologist: { name: 'Dr. Nidhi Agarwal', qualification: 'MD Pathology', registration: 'KMC 70214' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: AMENITIES, photoUrl: LAB_PHOTO,
    about: 'A compact, fast-turnaround lab serving HSR, Bellandur and BTM. Thyroid and HbA1c results usually land the same evening.',
  },
  {
    slug: 'aarogya-diagnostics-malleswaram', name: 'Aarogya Diagnostics', shortName: 'Aarogya', type: 'centre',
    area: 'Malleswaram', address: '58, Sampige Road, 8th Cross, Malleswaram, Bengaluru 560003', pincode: '560003', geo: { lat: 13.0031, lng: 77.5701 },
    phone: '080 2334 9090', tagline: 'Senior-friendly lab in Malleswaram',
    accreditations: ['NABL'], nablCertificate: 'MC-1876', rating: 4.7, reviewCount: 1190, established: 2001,
    openHours: '7:00 AM – 8:30 PM', sundayHours: '7:00 AM – 12:30 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 8, phlebotomists: 4,
    reportTat: '12–24 hours', pathologist: { name: 'Dr. Shankar Bhat', qualification: 'MD Pathology', registration: 'KMC 32871' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: [...AMENITIES, 'Ground-floor collection, no steps'], photoUrl: LAB_PHOTO,
    about: 'A family-run lab trusted by Malleswaram and Rajajinagar households for over two decades, with a ground-floor collection room for elderly patients.',
  },
  {
    slug: 'sanjeevini-diagnostics-hebbal', name: 'Sanjeevini Diagnostics', shortName: 'Sanjeevini', type: 'centre',
    area: 'Hebbal', address: '14, Bellary Road, opp. Esteem Mall, Hebbal, Bengaluru 560024', pincode: '560024', geo: { lat: 13.0452, lng: 77.5918 },
    phone: '080 4127 5566', tagline: 'North Bengaluru collections',
    accreditations: ['NABL'], nablCertificate: 'MC-3355', rating: 4.6, reviewCount: 968, established: 2014,
    openHours: '7:00 AM – 8:00 PM', sundayHours: '7:00 AM – 12:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 10, phlebotomists: 4,
    reportTat: '12–24 hours', pathologist: { name: 'Dr. Farah Siddiqui', qualification: 'MD Pathology', registration: 'KMC 58822' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: [...AMENITIES, 'Car parking'], photoUrl: LAB_PHOTO,
    about: 'Covers Hebbal, Sahakara Nagar, RT Nagar and Yelahanka with home collection, and runs a walk-in counter on Bellary Road.',
  },
  {
    slug: 'vital-labs-marathahalli', name: 'Vital Labs', shortName: 'Vital Labs', type: 'centre',
    area: 'Marathahalli', address: '3rd Floor, Outer Ring Road, above Kalamandir, Marathahalli, Bengaluru 560037', pincode: '560037', geo: { lat: 12.9558, lng: 77.7014 },
    phone: '080 4203 8844', tagline: 'Outer Ring Road tech-park collections',
    accreditations: ['NABL', 'ISO 15189'], nablCertificate: 'MC-4467', rating: 4.5, reviewCount: 842, established: 2019,
    openHours: '6:30 AM – 9:00 PM', sundayHours: '7:00 AM – 1:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 8, phlebotomists: 4,
    reportTat: '8–24 hours', pathologist: { name: 'Dr. Pradeep Nair', qualification: 'MD Pathology', registration: 'KMC 72190' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: AMENITIES, photoUrl: LAB_PHOTO,
    about: 'Serves Marathahalli, Bellandur, Mahadevapura and HAL Airport Road, including corporate health camps at ORR tech parks.',
  },
  {
    slug: 'biocore-labs-electronic-city', name: 'BioCore Labs', shortName: 'BioCore', type: 'centre',
    area: 'Electronic City', address: '7, Neeladri Road, Electronic City Phase 1, Bengaluru 560100', pincode: '560100', geo: { lat: 12.8456, lng: 77.6603 },
    phone: '080 4966 1200', tagline: 'Home collection south of Silk Board',
    accreditations: ['NABL'], nablCertificate: 'MC-4011', rating: 4.5, reviewCount: 716, established: 2018,
    openHours: '6:30 AM – 8:30 PM', sundayHours: '7:00 AM – 12:00 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 9, phlebotomists: 3,
    reportTat: '12–24 hours', pathologist: { name: 'Dr. Lakshmi Venkatesh', qualification: 'MD Pathology', registration: 'KMC 69417' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: AMENITIES, photoUrl: LAB_PHOTO,
    about: 'The nearest Curxx partner lab for Electronic City, Bommasandra and Hosur Road, with a walk-in centre off Neeladri Road.',
  },
  {
    slug: 'lifeline-diagnostics-banashankari', name: 'Lifeline Diagnostics', shortName: 'Lifeline', type: 'centre',
    area: 'Banashankari', address: '204, 24th Cross, Banashankari 2nd Stage, Bengaluru 560070', pincode: '560070', geo: { lat: 12.9247, lng: 77.5602 },
    phone: '080 2671 3030', tagline: 'West & South-west Bengaluru',
    accreditations: ['NABL'], nablCertificate: 'MC-2654', rating: 4.6, reviewCount: 1054, established: 2009,
    openHours: '7:00 AM – 8:30 PM', sundayHours: '7:00 AM – 12:30 PM', homeCollection: true, walkIn: true, collectionRadiusKm: 9, phlebotomists: 4,
    reportTat: '12–24 hours', pathologist: { name: 'Dr. Manjunath Gowda', qualification: 'MD Pathology', registration: 'KMC 47765' },
    tests: ROUTINE_TESTS, equipment: CORE_EQUIPMENT, amenities: AMENITIES, photoUrl: LAB_PHOTO,
    about: 'Covers Banashankari, JP Nagar, Basavanagudi and Vijayanagar with home collection and a walk-in centre near BDA Complex.',
  },
  {
    slug: 'curxx-collection-point-mg-road', name: 'Curxx Collection Point, MG Road', shortName: 'Curxx MG Road', type: 'centre',
    area: 'MG Road', address: 'Ground Floor, Prestige Meridian, 29 MG Road, Bengaluru 560001', pincode: '560001', geo: { lat: 12.9745, lng: 77.6077 },
    phone: '080 4719 0210', tagline: 'Walk-in only · no appointment queue',
    accreditations: ['NABL'], nablCertificate: 'MC-3471', rating: 4.6, reviewCount: 588, established: 2021,
    openHours: '7:30 AM – 7:30 PM', sundayHours: 'Closed', homeCollection: false, walkIn: true, collectionRadiusKm: 0, phlebotomists: 0,
    reportTat: '12–24 hours', pathologist: { name: 'Dr. Kavitha Rao', qualification: 'MD Pathology', registration: 'KMC 61254' },
    tests: BASIC_TESTS, equipment: ['Barcode sample tracking', 'Cold-chain transport to the Koramangala reference lab'], amenities: ['Wheelchair accessible', 'Digital reports on WhatsApp & Curxx', 'Near MG Road Metro'], photoUrl: LAB_PHOTO,
    about: 'A walk-in collection point for office-goers in the CBD. Samples are collected here and processed at the Curxx reference lab in Koramangala.',
  },
];
