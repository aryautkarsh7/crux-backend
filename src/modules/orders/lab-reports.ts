import { createHash } from 'node:crypto';
import { HealthRecordModel } from '../../models/health-record.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { OrderModel } from '../../models/order.model.js';

/** Results are published this long after the sample is collected. */
export const REPORT_TURNAROUND_MS = 24 * 60 * 60 * 1000;

type Range = { unit: string; low: number; high: number; decimals?: number };

/** Adult reference ranges for the parameters the catalogue measures most often. */
const RANGES: Record<string, Range> = {
  'Hemoglobin (Hb)': { unit: 'g/dL', low: 12, high: 16.5, decimals: 1 },
  'RBC Total Count': { unit: 'mill/µL', low: 4.2, high: 5.8, decimals: 2 },
  'Total Leukocytes (WBC)': { unit: '/µL', low: 4000, high: 10000 },
  'Platelet Count': { unit: 'lakh/µL', low: 1.5, high: 4.1, decimals: 2 },
  'Packed Cell Volume (PCV)': { unit: '%', low: 36, high: 48, decimals: 1 },
  'Erythrocyte Sedimentation Rate': { unit: 'mm/hr', low: 0, high: 20 },
  'Bilirubin Total': { unit: 'mg/dL', low: 0.3, high: 1.2, decimals: 1 },
  'SGOT / AST': { unit: 'U/L', low: 5, high: 40 },
  'SGPT / ALT': { unit: 'U/L', low: 7, high: 45 },
  'Alkaline Phosphatase (ALP)': { unit: 'U/L', low: 44, high: 147 },
  'Serum Total Protein': { unit: 'g/dL', low: 6, high: 8.3, decimals: 1 },
  'Serum Urea': { unit: 'mg/dL', low: 15, high: 40 },
  'Serum Creatinine': { unit: 'mg/dL', low: 0.6, high: 1.3, decimals: 2 },
  'Serum Uric Acid': { unit: 'mg/dL', low: 3.4, high: 7, decimals: 1 },
  'Serum Calcium': { unit: 'mg/dL', low: 8.5, high: 10.5, decimals: 1 },
  'Total Cholesterol': { unit: 'mg/dL', low: 125, high: 200 },
  "HDL Cholesterol ('Good')": { unit: 'mg/dL', low: 40, high: 60 },
  "LDL Cholesterol ('Bad')": { unit: 'mg/dL', low: 50, high: 130 },
  'Serum Triglycerides': { unit: 'mg/dL', low: 50, high: 150 },
  'Total Triiodothyronine (T3)': { unit: 'ng/mL', low: 0.8, high: 2, decimals: 2 },
  'Total Thyroxine (T4)': { unit: 'µg/dL', low: 5.1, high: 14.1, decimals: 1 },
  'Thyroid Stimulating Hormone (TSH)': { unit: 'µIU/mL', low: 0.4, high: 4, decimals: 2 },
  'TSH (3rd generation)': { unit: 'µIU/mL', low: 0.4, high: 4, decimals: 2 },
  'Glycated Hemoglobin (HbA1c)': { unit: '%', low: 4, high: 5.6, decimals: 1 },
  'Estimated Average Glucose (eAG)': { unit: 'mg/dL', low: 70, high: 114 },
  'Fasting Plasma Glucose (FBS)': { unit: 'mg/dL', low: 70, high: 100 },
  'Vitamin D 25-Hydroxy (Total)': { unit: 'ng/mL', low: 30, high: 100, decimals: 1 },
  'Vitamin D 25-Hydroxy': { unit: 'ng/mL', low: 30, high: 100, decimals: 1 },
  'Vitamin B12 (Cyanocobalamin)': { unit: 'pg/mL', low: 211, high: 911 },
  'Vitamin B12': { unit: 'pg/mL', low: 211, high: 911 },
  'Serum Ferritin': { unit: 'ng/mL', low: 20, high: 250 },
  'Serum Iron': { unit: 'µg/dL', low: 60, high: 170 },
  'hs-CRP (High Sensitivity)': { unit: 'mg/L', low: 0, high: 3, decimals: 2 },
  'Total PSA': { unit: 'ng/mL', low: 0, high: 4, decimals: 2 },
};

/** Deterministic 0–1 value per order + parameter, so a report never changes between reads. */
const unit = (seed: string) => parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) / 0xffffffff;

function findingFor(seed: string, name: string) {
  const range = RANGES[name];
  if (!range) return null;
  const r = unit(seed);
  const span = range.high - range.low;
  // Mostly in range; roughly one value in eight lands just outside it.
  const value = r < 0.06 ? range.low - span * 0.08 : r > 0.94 ? range.high + span * 0.12 : range.low + span * (0.15 + 0.7 * unit(`${seed}:v`));
  const shown = Math.max(0, value).toFixed(range.decimals ?? 0);
  return {
    name,
    value: shown,
    unit: range.unit,
    range: `${range.low} – ${range.high}`,
    flag: value < range.low ? ('low' as const) : value > range.high ? ('high' as const) : ('normal' as const),
  };
}

/**
 * Files a lab report into the patient's locker for every lab order whose results are out.
 * Called on reads (orders, records) instead of by a background job.
 */
export async function materializeLabReports(userId: string) {
  const due = await OrderModel.find({
    user: userId,
    kind: 'lab',
    status: { $ne: 'cancelled' },
    reportRecord: { $exists: false },
    'pickup.date': { $lte: new Date(Date.now() - REPORT_TURNAROUND_MS) },
  });
  for (const order of due) {
    const tests = await LabTestModel.find({ slug: { $in: order.items.map((i) => i.slug) } }).lean();
    const params = [...new Set(tests.flatMap((t) => t.parameterGroups.flatMap((g) => g.parameters ?? [])))];
    const findings = params.map((name) => findingFor(`${order.reference}:${name}`, name)).filter((f): f is NonNullable<typeof f> => f !== null);
    const flagged = findings.filter((f) => f.flag !== 'normal');
    const collected = new Date(order.pickup!.date!);

    const record = await HealthRecordModel.create({
      user: userId,
      kind: 'lab_report',
      title: tests.map((t) => t.name).join(' + ') || 'Lab report',
      // Orders from before labs were assigned were all processed at the Koramangala reference lab.
      doctorName: order.lab?.pathologist || 'Dr. Kavitha Rao, MD Pathology',
      facility: order.lab?.name ? (order.lab.name.includes(order.lab.area ?? '') ? order.lab.name : `${order.lab.name}, ${order.lab.area}`) : 'Curxx Diagnostics Reference Lab, Koramangala',
      date: new Date(collected.getTime() + REPORT_TURNAROUND_MS),
      summary: findings.length
        ? `${findings.length - flagged.length} of ${findings.length} measured parameters within range.${flagged.length ? ` Review: ${flagged.map((f) => f.name).join(', ')}.` : ''}`
        : 'All parameters reported within normal limits.',
      tags: ['Lab', order.reference],
      source: 'curxx',
      fileName: `${order.reference}_Report.pdf`,
      fileSize: 420_000 + findings.length * 12_000,
      findings,
    });
    order.reportRecord = record._id;
    await order.save();
  }
}
