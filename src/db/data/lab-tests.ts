/** Diagnostics catalogue: health packages (ported from the original screens) plus single tests. */

export const LAB_CATEGORIES = [
  { slug: 'full-body', name: 'Full Body', icon: 'health_metrics', countLabel: '24 Packages' },
  { slug: 'diabetes', name: 'Diabetes', icon: 'bloodtype', countLabel: '18 Tests' },
  { slug: 'thyroid', name: 'Thyroid', icon: 'vital_signs', countLabel: '12 Tests' },
  { slug: 'vitamin-d-b12', name: 'Vitamin D & B12', icon: 'pill', countLabel: '9 Tests' },
  { slug: 'heart-health', name: 'Heart Health', icon: 'cardiology', countLabel: '15 Tests' },
  { slug: 'liver-function', name: 'Liver Function', icon: 'labs', countLabel: '14 Tests' },
  { slug: 'kidney-care', name: 'Kidney Care', icon: 'nephrology', countLabel: '11 Tests' },
  { slug: 'womens-health', name: "Women's Health", icon: 'female', countLabel: '22 Tests' },
  { slug: 'mens-health', name: "Men's Health", icon: 'male', countLabel: '16 Tests' },
  { slug: 'allergy-screen', name: 'Allergy Screen', icon: 'coronavirus', countLabel: '8 Panels' },
  { slug: 'fever-infections', name: 'Fever & Infections', icon: 'thermometer', countLabel: '19 Tests' },
  { slug: 'covid-respiratory', name: 'Covid & Respiratory', icon: 'pulmonology', countLabel: '7 Tests' },
];

const CBC = { name: 'Complete Hemogram / CBC', icon: 'bloodtype', count: 24, parameters: ['Hemoglobin (Hb)', 'RBC Total Count', 'Total Leukocytes (WBC)', 'Platelet Count', 'Packed Cell Volume (PCV)', 'MCV, MCH, MCHC', 'Neutrophils & Lymphocytes', 'Monocytes & Eosinophils', 'Erythrocyte Sedimentation Rate'] };
const LFT = { name: 'Liver Function Profile (LFT)', icon: 'vital_signs', count: 12, parameters: ['Bilirubin Total', 'Bilirubin Direct & Indirect', 'SGOT / AST', 'SGPT / ALT', 'Alkaline Phosphatase (ALP)', 'Serum Total Protein', 'Albumin & Globulin', 'A/G Ratio', 'Gamma Glutamyl Transferase'] };
const KFT = { name: 'Kidney Function Test (KFT / RFT)', icon: 'water_drop', count: 8, parameters: ['Serum Urea', 'Blood Urea Nitrogen (BUN)', 'Serum Creatinine', 'BUN / Creatinine Ratio', 'Serum Uric Acid', 'Serum Calcium', 'Serum Phosphorus', 'eGFR Estimated'] };
const LIPID = { name: 'Lipid Profile (Cardiovascular Risk)', icon: 'favorite', count: 8, parameters: ['Total Cholesterol', "HDL Cholesterol ('Good')", "LDL Cholesterol ('Bad')", 'VLDL Cholesterol', 'Serum Triglycerides', 'TC / HDL Ratio', 'LDL / HDL Ratio', 'Non-HDL Cholesterol'] };
const THYROID = { name: 'Thyroid Profile (Total T3, T4, TSH)', icon: 'ecg', count: 3, parameters: ['Total Triiodothyronine (T3)', 'Total Thyroxine (T4)', 'Thyroid Stimulating Hormone (TSH)'] };
const HBA1C = { name: 'Diabetic Screen (3-Month Sugar Average)', icon: 'colorize', count: 2, parameters: ['Glycated Hemoglobin (HbA1c)', 'Estimated Average Glucose (eAG)'] };
const VITAMINS = { name: 'Vitamin Profile (Deficiency Scan)', icon: 'medication', count: 2, parameters: ['Vitamin D 25-Hydroxy (Total)', 'Vitamin B12 (Cyanocobalamin)'] };
const FASTING_GLUCOSE = { name: 'Fasting Blood Sugar', icon: 'colorize', count: 1, parameters: ['Fasting Plasma Glucose (FBS)'] };
const MICROALBUMIN = { name: 'Urine Microalbumin', icon: 'water_drop', count: 2, parameters: ['Urine Microalbumin', 'Albumin / Creatinine Ratio (ACR)'] };
const CARDIAC = { name: 'Cardiac Risk Markers', icon: 'cardiology', count: 6, parameters: ['hs-CRP (High Sensitivity)', 'Apolipoprotein A1', 'Apolipoprotein B', 'Apo B / Apo A1 Ratio', 'Lipoprotein (a)', 'Homocysteine'] };
const ELECTROLYTES = { name: 'Serum Electrolytes', icon: 'bolt', count: 3, parameters: ['Sodium (Na+)', 'Potassium (K+)', 'Chloride (Cl-)'] };
const BONE = { name: 'Bone Health (Calcium & Vitamin D)', icon: 'accessibility_new', count: 5, parameters: ['Serum Calcium', 'Serum Phosphorus', 'Vitamin D 25-Hydroxy', 'Vitamin B12', 'Alkaline Phosphatase'] };
const ARTHRITIS = { name: 'Arthritis Markers', icon: 'accessibility_new', count: 3, parameters: ['Serum Uric Acid', 'Rheumatoid Factor (RA)', 'Anti-CCP Antibodies'] };
const IRON = { name: 'Iron Deficiency Profile', icon: 'bloodtype', count: 4, parameters: ['Serum Iron', 'Total Iron Binding Capacity (TIBC)', 'Transferrin Saturation', 'Serum Ferritin'] };
const WOMEN_VITAMINS = { name: 'Folate, B12 & Vitamin D', icon: 'medication', count: 3, parameters: ['Serum Folate', 'Vitamin B12', 'Vitamin D 25-Hydroxy'] };
const MINERALS = { name: 'Calcium & Phosphorus', icon: 'labs', count: 2, parameters: ['Serum Calcium', 'Serum Phosphorus'] };
const HORMONES = { name: 'Hormonal Panel', icon: 'female', count: 5, parameters: ['FSH', 'LH', 'Prolactin', 'Estradiol (E2)', 'Testosterone (Total)'] };
const FREE_THYROID = { name: 'Free Thyroid Hormones', icon: 'ecg', count: 2, parameters: ['Free T3 (FT3)', 'Free T4 (FT4)'] };
const THYROID_ANTIBODIES = { name: 'Thyroid Antibodies', icon: 'biotech', count: 2, parameters: ['Anti-TPO Antibodies', 'Anti-Thyroglobulin (Anti-Tg)'] };


const PACKAGES = [
  {
    slug: 'comprehensive-full-body-checkup',
    name: 'Comprehensive Full Body Checkup',
    testsIncluded: 82,
    fastingHours: '10 to 12',
    fastingLabel: 'Fasting: 10-12 hrs',
    covers: 'Liver, Kidney, Lipid & Thyroid function alongside complete hemogram panel.',
    highlights: ['CBC & ESR (24)', 'Lipid Profile (8)', 'Liver Panel (11)', 'Kidney Profile (6)'],
    price: 1499,
    mrp: 2999,
    discount: 50,
    turnaround: 'Reports within 24h',
    reportTime: '24h Digital Report',
    categories: ['full-body', 'liver-function', 'kidney-care', 'thyroid', 'diabetes', 'vitamin-d-b12', 'heart-health', 'mens-health'],
    parameterGroups: [CBC, LFT, KFT, LIPID, THYROID, HBA1C, VITAMINS],
  },
  {
    slug: 'advanced-diabetic-profile',
    name: 'Advanced Diabetic Profile',
    testsIncluded: 48,
    fastingHours: '8 to 10',
    fastingLabel: 'Fasting Required',
    covers: 'HbA1c (Glycosylated Hemoglobin), Fasting Glucose, Lipid Profile, Urine Microalbumin.',
    highlights: ['HbA1c & Avg Glucose', 'Fasting Blood Sugar', 'Urine Microalbumin', 'Serum Creatinine'],
    price: 899,
    mrp: 1599,
    discount: 44,
    turnaround: 'Reports within 18h',
    reportTime: '18h Digital Report',
    categories: ['diabetes', 'kidney-care'],
    parameterGroups: [HBA1C, FASTING_GLUCOSE, MICROALBUMIN, LIPID, KFT],
  },
  {
    slug: 'senior-citizen-active-health',
    name: 'Senior Citizen Active Health',
    testsIncluded: 75,
    fastingHours: '10 to 12',
    fastingLabel: 'Fasting Required',
    covers: 'Cardiac Risk, Bone Health (Calcium & Vit D), Kidney Function, Complete Arthritis markers.',
    highlights: ['Cardiac Enzymes', 'Vitamin D & B12', 'Serum Electrolytes', 'Uric Acid / Gout'],
    price: 1999,
    mrp: 3800,
    discount: 47,
    turnaround: 'Special Geriatric Care',
    reportTime: '24h Digital Report',
    categories: ['full-body', 'heart-health', 'vitamin-d-b12', 'kidney-care'],
    parameterGroups: [CBC, CARDIAC, LIPID, KFT, ELECTROLYTES, BONE, ARTHRITIS],
  },
  {
    slug: 'womens-wellness-comprehensive',
    name: "Women's Wellness Comprehensive",
    testsIncluded: 64,
    fastingHours: '10 to 12',
    fastingLabel: 'Fasting Required',
    covers: 'Hormonal Panel, Iron Deficiency Profile, Complete Blood Count, Folate, and Thyroid Screen.',
    highlights: ['Total Iron Panel', 'Thyroid Profile (T3/T4)', 'Folate & Vit B12', 'Calcium & Phosphorus'],
    price: 1699,
    mrp: 3200,
    discount: 47,
    turnaround: 'Reports within 24h',
    reportTime: '24h Digital Report',
    categories: ['womens-health', 'thyroid', 'vitamin-d-b12', 'full-body'],
    parameterGroups: [CBC, IRON, THYROID, WOMEN_VITAMINS, MINERALS, HORMONES],
  },
  {
    slug: 'thyroid-hormone-care',
    name: 'Thyroid & Hormone Care',
    testsIncluded: 12,
    fastingHours: null,
    fastingLabel: 'No Fasting Required',
    covers: 'Total T3, Total T4, TSH Ultra-sensitive 3rd Generation with automated dilution checking.',
    highlights: ['Triiodothyronine (T3)', 'Thyroxine (T4)', 'Ultra-sensitive TSH', 'Endocrine Risk Score'],
    price: 499,
    mrp: 900,
    discount: 45,
    turnaround: 'Same-Day Reports',
    reportTime: 'Same-Day Digital Report',
    categories: ['thyroid'],
    parameterGroups: [THYROID, FREE_THYROID, THYROID_ANTIBODIES],
  },
  {
    slug: 'heart-health-lipid-screen',
    name: 'Heart Health & Lipid Screen',
    testsIncluded: 32,
    fastingHours: '10 to 12',
    fastingLabel: 'Fasting Required',
    covers: 'Lipid Profile, hs-CRP (High Sensitivity Cardiac Marker), Apolipoprotein A1 & B ratio.',
    highlights: ['Total Cholesterol', 'HDL, LDL & VLDL', 'hs-CRP Cardiac risk', 'Apo A1 / Apo B Ratio'],
    price: 1199,
    mrp: 2200,
    discount: 45,
    turnaround: 'Cardiologist reviewed',
    reportTime: '24h Digital Report',
    categories: ['heart-health'],
    parameterGroups: [LIPID, CARDIAC, HBA1C, ELECTROLYTES],
  },
];

type Group = { name: string; icon: string; count: number; parameters: string[] };
const single = (
  slug: string, name: string, price: number, mrp: number, categories: string[], group: Group,
  opts: { fasting?: string | null; sample?: string; report?: string; covers?: string } = {},
) => ({
  slug, name, kind: 'test' as const, testsIncluded: group.count,
  fastingHours: opts.fasting ?? null,
  fastingLabel: opts.fasting ? `Fasting: ${opts.fasting.replace(' to ', '-')} hrs` : 'No fasting required',
  covers: opts.covers ?? group.parameters.join(', '),
  highlights: group.parameters.slice(0, 4),
  price, mrp, discount: Math.round((1 - price / mrp) * 100),
  turnaround: `Reports within ${opts.report ?? '6h'}`,
  reportTime: `${opts.report ?? '6h'} Digital Report`,
  sampleType: opts.sample ?? 'Blood',
  categories,
  parameterGroups: [group],
});

const TESTS = [
  single('complete-blood-count', 'Complete Blood Count (CBC)', 299, 450, ['full-body', 'fever-infections'], CBC, { report: '6h' }),
  single('hba1c', 'HbA1c (Glycated Haemoglobin)', 399, 600, ['diabetes'], HBA1C, { report: '8h' }),
  single('fasting-blood-sugar', 'Fasting Blood Sugar (FBS)', 99, 150, ['diabetes'], FASTING_GLUCOSE, { fasting: '8 to 10', report: '6h' }),
  single('lipid-profile', 'Lipid Profile', 449, 700, ['heart-health'], LIPID, { fasting: '10 to 12' }),
  single('liver-function-test', 'Liver Function Test (LFT)', 549, 850, ['liver-function'], LFT),
  single('kidney-function-test', 'Kidney Function Test (KFT)', 549, 850, ['kidney-care'], KFT),
  single('thyroid-profile-total', 'Thyroid Profile (T3, T4, TSH)', 399, 650, ['thyroid', 'womens-health'], THYROID),
  single('tsh-ultrasensitive', 'TSH Ultrasensitive', 249, 400, ['thyroid'], { name: 'Thyroid Stimulating Hormone', icon: 'ecg', count: 1, parameters: ['TSH (3rd generation)'] }, { report: '8h' }),
  single('vitamin-d-25-oh', 'Vitamin D (25-OH)', 799, 1400, ['vitamin-d-b12'], { name: 'Vitamin D', icon: 'wb_sunny', count: 1, parameters: ['Vitamin D 25-Hydroxy (Total)'] }, { report: '24h' }),
  single('vitamin-b12', 'Vitamin B12', 599, 1000, ['vitamin-d-b12'], { name: 'Vitamin B12', icon: 'medication', count: 1, parameters: ['Vitamin B12 (Cyanocobalamin)'] }, { report: '24h' }),
  single('iron-studies', 'Iron Studies', 699, 1100, ['womens-health', 'full-body'], IRON, { report: '24h' }),
  single('dengue-ns1-antigen', 'Dengue NS1 Antigen', 599, 900, ['fever-infections'], { name: 'Dengue Screen', icon: 'coronavirus', count: 1, parameters: ['Dengue NS1 Antigen (ELISA)'] }, { report: '12h' }),
  single('typhoid-widal', 'Typhoid (Widal Test)', 249, 400, ['fever-infections'], { name: 'Widal Test', icon: 'thermometer', count: 4, parameters: ['S. Typhi O', 'S. Typhi H', 'S. Paratyphi AH', 'S. Paratyphi BH'] }, { report: '12h' }),
  single('urine-routine', 'Urine Routine & Microscopy', 149, 250, ['kidney-care', 'fever-infections'], { name: 'Urine Examination', icon: 'water_drop', count: 18, parameters: ['Colour & Appearance', 'pH & Specific Gravity', 'Protein & Glucose', 'Pus Cells & RBCs'] }, { sample: 'Urine', report: '6h' }),
  single('allergy-panel-inhalant', 'Allergy Panel (Inhalants)', 1999, 3200, ['allergy-screen', 'covid-respiratory'], { name: 'Inhalant Allergens (IgE)', icon: 'coronavirus', count: 20, parameters: ['Dust mite', 'Pollen mix', 'Cockroach', 'Cat & dog dander', 'Mould mix'] }, { report: '48h' }),
  single('psa-total', 'PSA (Prostate Specific Antigen)', 699, 1100, ['mens-health'], { name: 'Prostate Screen', icon: 'male', count: 1, parameters: ['Total PSA'] }, { report: '24h' }),
];

export const LAB_TESTS = [
  ...PACKAGES.map((p, i) => ({ ...p, kind: 'package' as const, sampleType: 'Blood & Urine', popularity: 100 - i * 5 })),
  ...TESTS.map((t, i) => ({ ...t, popularity: 70 - i * 2 })),
];
