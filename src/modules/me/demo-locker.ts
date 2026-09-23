import type { Types } from 'mongoose';
import { AccessGrantModel } from '../../models/access-grant.model.js';
import { HealthRecordModel } from '../../models/health-record.model.js';
import { UserModel } from '../../models/user.model.js';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/** 14-digit ABHA number, stable per phone so the same account always shows the same ID. */
function abhaFor(phone: string) {
  const digits = (phone + '73194028').slice(0, 14);
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
}

/**
 * Gives a first-time account a realistic health locker (records, lab findings, consents)
 * so every records screen has something to show. Runs once per user.
 */
export async function ensureDemoLocker(userId: Types.ObjectId | string, phone: string) {
  const user = await UserModel.findOneAndUpdate(
    { _id: userId, demoSeededAt: { $exists: false } },
    { $set: { demoSeededAt: new Date() } },
    { new: true },
  );
  if (!user) return; // already seeded

  if (!user.abhaId) await UserModel.updateOne({ _id: userId }, { $set: { abhaId: abhaFor(phone) } });

  const records = await HealthRecordModel.insertMany([
    {
      user: userId, kind: 'prescription', title: 'Acne & pigmentation treatment plan', doctorName: 'Dr. Priya Sharma', facility: 'SkinCare Super Specialty Clinic',
      date: daysAgo(12), summary: 'Moderate inflammatory acne with post-inflammatory hyperpigmentation. Review in 6 weeks.', tags: ['Dermatology'], fileName: 'Rx_PriyaSharma.pdf', fileSize: 184_320,
      medicines: [
        { name: 'Adapalene 0.1% gel', dosage: 'Pea-sized amount at night', duration: '8 weeks' },
        { name: 'Clindamycin 1% gel', dosage: 'Apply on active spots, morning', duration: '6 weeks' },
        { name: 'Photostable Gold SPF 50', dosage: 'Every morning, reapply at 3 hours', duration: 'Ongoing' },
      ],
    },
    {
      user: userId, kind: 'lab_report', title: 'Comprehensive Full Body Checkup', doctorName: 'Dr. Kavitha Rao, MD Pathology', facility: 'Curxx Diagnostics Reference Lab, Koramangala',
      date: daysAgo(20), summary: '78 of 82 parameters within range. Vitamin D low; LDL borderline high.', tags: ['Full body', 'Preventive'], fileName: 'FullBody_Report.pdf', fileSize: 1_240_000,
      findings: [
        { name: 'Haemoglobin', value: '13.8', unit: 'g/dL', range: '13.0 – 17.0', flag: 'normal' },
        { name: 'Fasting Blood Sugar', value: '96', unit: 'mg/dL', range: '70 – 100', flag: 'normal' },
        { name: 'HbA1c', value: '5.6', unit: '%', range: '< 5.7', flag: 'normal' },
        { name: 'Total Cholesterol', value: '198', unit: 'mg/dL', range: '< 200', flag: 'normal' },
        { name: 'LDL Cholesterol', value: '134', unit: 'mg/dL', range: '< 130', flag: 'high' },
        { name: 'HDL Cholesterol', value: '46', unit: 'mg/dL', range: '> 40', flag: 'normal' },
        { name: 'Triglycerides', value: '142', unit: 'mg/dL', range: '< 150', flag: 'normal' },
        { name: 'TSH', value: '2.4', unit: 'µIU/mL', range: '0.4 – 4.0', flag: 'normal' },
        { name: 'Vitamin D (25-OH)', value: '18.2', unit: 'ng/mL', range: '30 – 100', flag: 'low' },
        { name: 'Vitamin B12', value: '312', unit: 'pg/mL', range: '211 – 911', flag: 'normal' },
        { name: 'Serum Creatinine', value: '0.9', unit: 'mg/dL', range: '0.7 – 1.3', flag: 'normal' },
        { name: 'SGPT / ALT', value: '28', unit: 'U/L', range: '< 45', flag: 'normal' },
      ],
    },
    {
      user: userId, kind: 'prescription', title: 'Viral fever — symptomatic care', doctorName: 'Dr. Meera Nambiar', facility: 'Curxx Family Clinic',
      date: daysAgo(64), summary: 'Acute viral fever, NS1 negative. Rest, fluids, paracetamol. Return if fever persists beyond 5 days.', tags: ['General Medicine'], fileName: 'Rx_MeeraNambiar.pdf', fileSize: 142_000,
      medicines: [
        { name: 'Dolo 650', dosage: '1 tablet every 6 hours if fever > 100°F', duration: '5 days' },
        { name: 'ORS sachets', dosage: '1 sachet in 1 litre water, sip through the day', duration: '3 days' },
      ],
    },
    {
      user: userId, kind: 'lab_report', title: 'Thyroid Profile (T3, T4, TSH)', doctorName: 'Dr. Sanjay Menon, MD Pathology', facility: 'Medisure Diagnostics, Indiranagar',
      date: daysAgo(96), summary: 'Thyroid function within normal limits.', tags: ['Thyroid'], fileName: 'Thyroid_Profile.pdf', fileSize: 312_000,
      findings: [
        { name: 'Total T3', value: '1.21', unit: 'ng/mL', range: '0.8 – 2.0', flag: 'normal' },
        { name: 'Total T4', value: '8.4', unit: 'µg/dL', range: '5.1 – 14.1', flag: 'normal' },
        { name: 'TSH', value: '2.9', unit: 'µIU/mL', range: '0.4 – 4.0', flag: 'normal' },
      ],
    },
    {
      user: userId, kind: 'imaging', title: 'Chest X-Ray (PA view)', doctorName: 'Dr. Vikram Desai', facility: 'Manipal Super Specialty Hospital',
      date: daysAgo(180), summary: 'No active lung lesion. Cardiac silhouette normal. Costophrenic angles clear.', tags: ['Radiology'], fileName: 'ChestXray_PA.pdf', fileSize: 2_860_000, mimeType: 'application/pdf',
    },
    {
      user: userId, kind: 'vaccination', title: 'Influenza vaccine (quadrivalent)', doctorName: 'Curxx Family Clinic', facility: 'Curxx Family Clinic',
      date: daysAgo(240), summary: 'Annual flu vaccine, 0.5 ml IM, left deltoid. Next dose due in 12 months.', tags: ['Vaccination'], fileName: 'Vaccination_Certificate.pdf', fileSize: 96_000,
    },
    {
      user: userId, kind: 'discharge', title: 'Discharge summary — Dengue fever', doctorName: 'Dr. Rahul Bhatt', facility: 'Aster CMI Hospital',
      date: daysAgo(390), summary: 'Admitted 3 days for dengue with warning signs. Platelets recovered to 1.4 lakh at discharge. Hydration and paracetamol only.', tags: ['Hospitalisation'], fileName: 'Discharge_AsterCMI.pdf', fileSize: 540_000,
    },
  ]);

  const [prescription, fullBody] = records;
  await AccessGrantModel.insertMany([
    { user: userId, grantee: { name: 'Dr. Priya Sharma', kind: 'doctor', detail: 'Dermatologist · SkinCare Super Specialty Clinic' }, scope: 'all', expiresAt: daysAhead(24), status: 'active', lastAccessedAt: daysAgo(2) },
    { user: userId, grantee: { name: 'Manipal Super Specialty Hospital', kind: 'hospital', detail: 'Cardiology OPD' }, scope: 'lab_reports', expiresAt: daysAhead(5), status: 'active', lastAccessedAt: daysAgo(6) },
    { user: userId, grantee: { name: 'Family member', kind: 'family', detail: 'Spouse · +91 98•••• ••21' }, scope: 'selected', records: [prescription!._id, fullBody!._id], expiresAt: daysAhead(300), status: 'active' },
    { user: userId, grantee: { name: 'Star Health Insurance', kind: 'insurer', detail: 'Claim #SH-22871' }, scope: 'selected', records: [fullBody!._id], expiresAt: daysAgo(30), status: 'revoked' },
  ]);
}
