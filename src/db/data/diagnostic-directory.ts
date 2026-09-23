/**
 * The full diagnostic directory (15 departments, ~250 tests and procedures) as catalogue items.
 * Tests already in the curated catalogue are not duplicated: they just gain the department tag.
 * Imaging, endoscopy and most function tests are visit-only; blood, urine and most serology can be
 * collected at home.
 */
import { DIRECTORY_ROWS } from './diagnostic-directory-rows.js';

export type Department = { n: number; slug: string; name: string; icon: string; home: boolean; kind: 'test' | 'scan' | 'procedure'; sample: string; report: string; base: number };

export const DEPARTMENTS: Department[] = [
  { n: 1, slug: 'radiology-imaging', name: 'Radiology & Imaging', icon: 'radiology', home: false, kind: 'scan', sample: 'Imaging', report: 'Same day', base: 1800 },
  { n: 2, slug: 'blood-tests', name: 'Blood Tests', icon: 'bloodtype', home: true, kind: 'test', sample: 'Blood', report: '12–24 hours', base: 650 },
  { n: 3, slug: 'urine-tests', name: 'Urine Tests', icon: 'water_drop', home: true, kind: 'test', sample: 'Urine', report: '12–24 hours', base: 450 },
  { n: 4, slug: 'stool-tests', name: 'Stool Tests', icon: 'science', home: true, kind: 'test', sample: 'Stool', report: '24–48 hours', base: 600 },
  { n: 5, slug: 'cardiac-tests', name: 'Cardiac Tests', icon: 'cardiology', home: false, kind: 'procedure', sample: 'In-centre test', report: 'Same day', base: 2200 },
  { n: 6, slug: 'neurology-tests', name: 'Neurology Tests', icon: 'neurology', home: false, kind: 'procedure', sample: 'In-centre test', report: 'Same day', base: 2500 },
  { n: 7, slug: 'endoscopy-procedures', name: 'Endoscopy & Procedures', icon: 'medical_services', home: false, kind: 'procedure', sample: 'Procedure', report: 'Same day', base: 6000 },
  { n: 8, slug: 'microbiology', name: 'Microbiology & Infection', icon: 'microbiology', home: true, kind: 'test', sample: 'Swab / Sample', report: '48–72 hours', base: 900 },
  { n: 9, slug: 'histopathology', name: 'Histopathology & Cytology', icon: 'biotech', home: false, kind: 'procedure', sample: 'Tissue / Cells', report: '3–5 days', base: 2500 },
  { n: 10, slug: 'genetic-tests', name: 'Molecular & Genetic Tests', icon: 'genetics', home: true, kind: 'test', sample: 'Blood', report: '7–14 days', base: 9000 },
  { n: 11, slug: 'womens-health-tests', name: "Women's Health & Pregnancy", icon: 'pregnant_woman', home: true, kind: 'test', sample: 'Blood', report: '24 hours', base: 1200 },
  { n: 12, slug: 'paediatric-tests', name: 'Paediatric & Newborn', icon: 'child_care', home: true, kind: 'test', sample: 'Blood', report: '48 hours', base: 1500 },
  { n: 13, slug: 'allergy-immunology', name: 'Allergy & Autoimmune', icon: 'allergy', home: true, kind: 'test', sample: 'Blood', report: '48 hours', base: 1800 },
  { n: 14, slug: 'special-function-tests', name: 'Special Function Tests', icon: 'pulmonology', home: false, kind: 'procedure', sample: 'In-centre test', report: 'Same day', base: 1800 },
  { n: 15, slug: 'rapid-tests', name: 'Rapid & Point-of-Care', icon: 'bolt', home: true, kind: 'test', sample: 'Blood / Swab', report: '30 minutes', base: 400 },
];
const DEPT = new Map(DEPARTMENTS.map((d) => [d.n, d]));

/** Directory names that are already curated catalogue tests. */
const EXISTING: Record<string, string> = {
  'Complete Blood Count (CBC)': 'complete-blood-count',
  'Lipid Profile': 'lipid-profile',
  'Liver Function Test (LFT)': 'liver-function-test',
  'Kidney Function Test (KFT / RFT)': 'kidney-function-test',
  'Thyroid Function Test (TFT)': 'thyroid-profile-total',
  'Vitamin D (25-OH)': 'vitamin-d-25-oh',
  'Vitamin B12': 'vitamin-b12',
  'HbA1c (Glycated Hemoglobin)': 'hba1c',
  'Blood Glucose – Fasting (FBS)': 'fasting-blood-sugar',
  'Dengue NS1 Antigen & IgM/IgG': 'dengue-ns1-antigen',
  'Typhoid (Widal / Typhidot)': 'typhoid-widal',
  'Urine Routine & Microscopy (R/M)': 'urine-routine',
  'PSA (Prostate Specific Antigen)': 'psa-total',
  'Serum Iron Studies': 'iron-studies',
};

/** Specific prices where the department default would be misleading. */
const PRICES: [RegExp, number][] = [
  [/PET/, 18999], [/Whole Genome/, 45999], [/Next Generation Sequencing/, 24999], [/BRCA/, 17999], [/NIPT/, 14999], [/Chromosomal Microarray/, 16999],
  [/MR Angiography|CT Angiography|CT Coronary/, 8999], [/^MRI|Cardiac MRI/, 5499], [/HRCT/, 3999], [/^CT Scan/, 3499], [/Nuclear Medicine/, 5999],
  [/Doppler/, 2199], [/Ultrasound|Sonography|Anomaly Scan/, 1199], [/Mammo/, 1799], [/DEXA|Bone Mineral/, 2199], [/X-Ray/, 449], [/OPG/, 599], [/Fluoroscopy/, 2499],
  [/Stress Echo/, 3499], [/Echo/, 1999], [/ECG/, 299], [/Holter/, 2499], [/Event Monitor/, 5999], [/Treadmill|TMT/, 1799], [/Ankle-Brachial/, 999],
  [/Colonoscopy|ERCP|Capsule Endoscopy/, 11999], [/Endoscopy|Bronchoscopy|Sigmoidoscopy|Cystoscopy|Hysteroscopy|Colposcopy/, 5999], [/Arthroscopy/, 24999],
  [/Polysomnography/, 7999], [/EEG/, 1799], [/EMG|Nerve Conduction/, 2999], [/Evoked/, 2499],
  [/Glucose – Post Prandial/, 119], [/ESR/, 149], [/^C-Reactive/, 449], [/Uric Acid/, 249], [/Blood Group/, 149], [/Albumin|Globulin/, 199], [/Phosphorus Level|Magnesium/, 349],
  [/Troponin/, 1199], [/BNP/, 2399], [/Procalcitonin/, 2199], [/Immunoglobulins/, 2399], [/ANCA/, 2599], [/Chromogranin/, 3999], [/HER2/, 3499], [/NSE/, 2999],
  [/HIV|HBsAg|VDRL|Malaria/, 399], [/COVID-19 RT-PCR/, 499], [/Pap Smear/, 799], [/HPV/, 2999], [/Biopsy|IHC|Flow Cytometry|FISH/, 3999], [/FNAC/, 1499],
  [/Semen Analysis/, 599], [/Sperm DNA/, 4499], [/Pulmonary Function|Spirometry/, 1199], [/Arterial Blood Gas/, 999], [/Hydrogen Breath/, 2499],
  [/Glucometer|SpO2|Urine Dipstick/, 99], [/Rapid Antigen|CRP Rapid|Strep/, 399], [/Urine Pregnancy/, 149],
];

const HOME_OVERRIDE: [RegExp, boolean][] = [
  [/^ECG|Holter/, true],
  [/CSF|Wound\/Pus|Ear Swab|Vaginal \/ Cervical|Cervical Swab/, false],
  [/Ultrasound|Doppler|Amniocentesis|Pap Smear|HPV|Sonography|Mammogram|DEXA|Bone Mineral|GCT|Glucose Tolerance/, false],
  [/Developmental|Sweat Chloride|Stimulation Test/, false],
  [/Skin Prick|Patch Test/, false],
  [/Fertility Hormone Panel/, true],
  [/Bedside Ultrasound|POCUS/, false],
];

const FASTING: [RegExp, string][] = [
  [/Fasting|Lipid|Insulin Level|Glucose Tolerance|GCT/, '10-12'],
  [/Post Prandial/, '2 hours after a meal'],
  [/Ultrasound.*Abdomen|Abdomen/, '6'],
  [/Colonoscopy|Upper GI Endoscopy|ERCP|Capsule Endoscopy/, '8-12'],
];

const slugify = (s: string) => s.toLowerCase().replace(/[()/]/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 23);

export type DirectoryTest = {
  slug: string; name: string; kind: 'test' | 'scan' | 'procedure'; department: string; homeCollection: boolean; testsIncluded: number;
  fastingHours: string | null; fastingLabel: string; covers: string; highlights: string[]; price: number; mrp: number; discount: number;
  turnaround: string; reportTime: string; sampleType: string; categories: string[]; parameterGroups: { name: string; icon: string; count: number; parameters: string[] }[]; popularity: number;
};

/** New catalogue items, plus department tags to add to curated tests the directory repeats. */
export function buildDirectory() {
  const tests = new Map<string, DirectoryTest>();
  const existingTags = new Map<string, Set<string>>();

  DIRECTORY_ROWS.forEach(([n, name, details], index) => {
    const dept = DEPT.get(n)!;
    const existing = EXISTING[name];
    if (existing) {
      existingTags.set(existing, (existingTags.get(existing) ?? new Set()).add(dept.slug));
      return;
    }
    const slug = slugify(name);
    const prior = tests.get(slug);
    if (prior) {
      // Same test listed under two departments (e.g. Pap Smear): one item, both tags.
      if (!prior.categories.includes(dept.slug)) prior.categories.push(dept.slug);
      return;
    }
    const override = HOME_OVERRIDE.find(([re]) => re.test(name))?.[1];
    const homeCollection = override ?? dept.home;
    const kind: DirectoryTest['kind'] = /Ultrasound|Doppler|Sonography|Mammo|DEXA|Echo|X-Ray|CT |MRI|PET/.test(name) ? 'scan' : !homeCollection && dept.kind === 'test' ? 'procedure' : dept.kind;
    const listed = PRICES.find(([re]) => re.test(name))?.[1];
    const factor = 0.7 + (hash(name) % 90) / 100; // 0.7–1.6 × department base
    const price = listed ?? Math.max(149, Math.round((dept.base * factor) / 50) * 50 - 1);
    const discount = kind === 'test' ? 20 + (hash(slug) % 26) : 10 + (hash(slug) % 11);
    const mrp = Math.round(price / (1 - discount / 100) / 10) * 10;
    const fasting = FASTING.find(([re]) => re.test(name))?.[1] ?? null;
    tests.set(slug, {
      slug,
      name,
      kind,
      department: dept.slug,
      homeCollection,
      testsIncluded: Math.max(1, details.split(',').length),
      fastingHours: fasting,
      fastingLabel: fasting ? (/\d/.test(fasting) && !fasting.includes('after') ? 'Fasting Required' : 'Timed Sample') : kind === 'test' ? 'No Fasting Required' : 'Preparation as advised',
      covers: details,
      highlights: [dept.name, homeCollection ? 'Home sample collection' : 'Visit a diagnostic centre', `Report: ${dept.report}`],
      price,
      mrp,
      discount,
      turnaround: `Report in ${dept.report}`,
      reportTime: `${dept.report} Report`,
      sampleType: kind === 'scan' ? 'Imaging' : dept.sample,
      categories: [dept.slug],
      parameterGroups: [{ name: dept.name, icon: dept.icon, count: Math.max(1, details.split(',').length), parameters: details.split(',').map((p) => p.trim()).filter(Boolean) }],
      popularity: 40 - (index % 40),
    });
  });

  return { tests: [...tests.values()], existingTags };
}
