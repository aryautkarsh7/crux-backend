import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './connect.js';
import { DoctorModel } from '../models/doctor.model.js';
import { SlotModel } from '../models/slot.model.js';
import { SpecialtyModel } from '../models/specialty.model.js';

const SPECIALTIES = [
  { slug: 'general-physician', name: 'General Physician', plural: 'General Physicians', icon: 'stethoscope', fromPrice: 399 },
  { slug: 'cardiologist', name: 'Cardiologist', plural: 'Cardiologists', icon: 'cardiology', fromPrice: 799 },
  { slug: 'dermatologist', name: 'Dermatologist', plural: 'Dermatologists', icon: 'dermatology', fromPrice: 599 },
  { slug: 'pediatrician', name: 'Pediatrician', plural: 'Pediatricians', icon: 'child_care', fromPrice: 499 },
  { slug: 'gynecologist', name: 'Gynecologist', plural: 'Gynecologists', icon: 'female', fromPrice: 649 },
  { slug: 'orthopedist', name: 'Orthopedist', plural: 'Orthopedists', icon: 'accessibility_new', fromPrice: 699 },
  { slug: 'psychiatrist', name: 'Psychiatrist', plural: 'Psychiatrists', icon: 'psychiatry', fromPrice: 899 },
  { slug: 'ent-specialist', name: 'ENT Specialist', plural: 'ENT Specialists', icon: 'hearing', fromPrice: 499 },
  { slug: 'gastroenterologist', name: 'Gastroenterologist', plural: 'Gastroenterologists', icon: 'gastroenterology', fromPrice: 749 },
  { slug: 'neurologist', name: 'Neurologist', plural: 'Neurologists', icon: 'neurology', fromPrice: 999 },
  { slug: 'ophthalmologist', name: 'Ophthalmologist', plural: 'Ophthalmologists', icon: 'visibility', fromPrice: 499 },
  { slug: 'dentist', name: 'Dentist', plural: 'Dentists', icon: 'dentistry', fromPrice: 349 },
];

const DOCTORS = [
  { slug: 'dr-priya-sharma', name: 'Dr. Priya Sharma', qualification: 'MBBS, MD - Dermatology, Fellow in Aesthetic Medicine', title: 'Senior Dermatologist & Dermatosurgeon', specialty: 'dermatologist', area: 'Indiranagar', clinicName: 'SkinCare Super Specialty Clinic', experienceYears: 14, fee: 650, videoFee: 349, rating: 4.9, reviewCount: 1240, recommendPercent: 98, languages: ['English', 'Hindi', 'Kannada', 'Tamil'] },
  { slug: 'dr-rajeshwari-iyer', name: 'Dr. Rajeshwari Iyer', qualification: 'MBBS, MD - Dermatology, DNB (Dermatology)', title: 'Dermatologist & Trichologist', specialty: 'dermatologist', area: 'Indiranagar', clinicName: 'DermaCare Clinic', experienceYears: 16, fee: 700, videoFee: 399, rating: 4.8, reviewCount: 890, recommendPercent: 98, languages: ['English', 'Kannada', 'Hindi'] },
  { slug: 'dr-ananya-sen', name: 'Dr. Ananya Sen', qualification: 'MBBS, DNB - Dermatology', title: 'Cosmetic Dermatologist', specialty: 'dermatologist', area: 'Whitefield', clinicName: 'HSR Layout Skin Care', experienceYears: 11, fee: 649, videoFee: 349, rating: 4.9, reviewCount: 1120, recommendPercent: 99, languages: ['English', 'Hindi', 'Bengali'] },
  { slug: 'dr-kavya-menon', name: 'Dr. Kavya Menon', qualification: 'MBBS, MD - Dermatology', title: 'Consultant Dermatologist', specialty: 'dermatologist', area: 'Koramangala', clinicName: 'Apollo Clinic Koramangala', experienceYears: 9, fee: 599, videoFee: 349, rating: 4.7, reviewCount: 620, recommendPercent: 96, languages: ['English', 'Malayalam', 'Kannada'] },
  { slug: 'dr-nikhil-rao', name: 'Dr. Nikhil Rao', qualification: 'MBBS, MD - Dermatology, MRCP (UK)', title: 'Dermatologist & Laser Specialist', specialty: 'dermatologist', area: 'Jayanagar', clinicName: 'Manipal Skin Institute', experienceYears: 13, fee: 750, videoFee: 449, rating: 4.8, reviewCount: 980, recommendPercent: 97, languages: ['English', 'Kannada', 'Telugu'] },
  { slug: 'dr-sneha-patil', name: 'Dr. Sneha Patil', qualification: 'MBBS, DDVL', title: 'Pediatric Dermatologist', specialty: 'dermatologist', area: 'HSR Layout', clinicName: 'Cloudnine Skin & Child Care', experienceYears: 8, fee: 550, videoFee: 299, rating: 4.7, reviewCount: 430, recommendPercent: 95, languages: ['English', 'Hindi', 'Marathi'] },
  { slug: 'dr-meera-nambiar', name: 'Dr. Meera Nambiar', qualification: 'MBBS, MD - General Medicine', title: 'General Physician', specialty: 'general-physician', area: 'Indiranagar', clinicName: 'Curxx Family Clinic', experienceYears: 12, fee: 399, videoFee: 249, rating: 4.8, reviewCount: 1540, recommendPercent: 97, languages: ['English', 'Malayalam', 'Hindi'] },
  { slug: 'dr-imran-qureshi', name: 'Dr. Imran Qureshi', qualification: 'MBBS, MD - Internal Medicine', title: 'Consultant Physician', specialty: 'general-physician', area: 'Koramangala', clinicName: 'Apollo Clinic & Diagnostics', experienceYears: 10, fee: 449, videoFee: 249, rating: 4.7, reviewCount: 760, recommendPercent: 96, languages: ['English', 'Hindi', 'Urdu'] },
  { slug: 'dr-arvind-swaminathan', name: 'Dr. Arvind Swaminathan', qualification: 'MBBS, MS - Orthopedics', title: 'Orthopedic Surgeon', specialty: 'orthopedist', area: 'Koramangala', clinicName: 'Koramangala Ortho Centre', experienceYears: 18, fee: 799, videoFee: 499, rating: 4.9, reviewCount: 1640, recommendPercent: 97, languages: ['English', 'Tamil', 'Kannada'] },
  { slug: 'dr-vikram-desai', name: 'Dr. Vikram Desai', qualification: 'MBBS, MD, DM - Cardiology', title: 'Interventional Cardiologist', specialty: 'cardiologist', area: 'HAL Airport Road', clinicName: 'Manipal Super Specialty Hospital', experienceYears: 21, fee: 899, videoFee: 599, rating: 4.9, reviewCount: 2100, recommendPercent: 98, languages: ['English', 'Hindi', 'Gujarati'] },
  { slug: 'dr-lakshmi-narayan', name: 'Dr. Lakshmi Narayan', qualification: 'MBBS, MD - Obstetrics & Gynaecology', title: 'Senior Gynaecologist', specialty: 'gynecologist', area: 'Indiranagar', clinicName: 'Cloudnine Hospital', experienceYears: 17, fee: 699, videoFee: 399, rating: 4.9, reviewCount: 1890, recommendPercent: 98, languages: ['English', 'Kannada', 'Tamil'] },
  { slug: 'dr-rahul-bhatt', name: 'Dr. Rahul Bhatt', qualification: 'MBBS, MD - Pediatrics', title: 'Consultant Paediatrician', specialty: 'pediatrician', area: 'Hebbal', clinicName: 'Aster CMI Hospital', experienceYears: 15, fee: 549, videoFee: 349, rating: 4.8, reviewCount: 1320, recommendPercent: 97, languages: ['English', 'Hindi', 'Kannada'] },
];

// Clinic hours, alternating in-clinic and video consultations.
const SLOT_TIMES: Array<{ hour: number; minute: number; mode: 'clinic' | 'video' }> = [
  { hour: 10, minute: 0, mode: 'clinic' },
  { hour: 10, minute: 30, mode: 'video' },
  { hour: 11, minute: 15, mode: 'clinic' },
  { hour: 14, minute: 0, mode: 'video' },
  { hour: 14, minute: 45, mode: 'clinic' },
  { hour: 15, minute: 30, mode: 'video' },
  { hour: 17, minute: 0, mode: 'clinic' },
  { hour: 17, minute: 45, mode: 'clinic' },
  { hour: 18, minute: 30, mode: 'video' },
];

const DAYS_AHEAD = 7;

async function seed() {
  await connectDatabase();
  console.log('seeding…');

  await SpecialtyModel.bulkWrite(SPECIALTIES.map((s) => ({ updateOne: { filter: { slug: s.slug }, update: { $set: s }, upsert: true } })));

  await DoctorModel.bulkWrite(
    DOCTORS.map((d) => ({
      updateOne: {
        filter: { slug: d.slug },
        update: { $set: { ...d, city: 'bangalore', verified: true, about: `${d.name} is a ${d.title.toLowerCase()} practising at ${d.clinicName}, ${d.area}, with ${d.experienceYears} years of clinical experience.` } },
        upsert: true,
      },
    })),
  );

  const doctors = await DoctorModel.find().lean();
  const now = new Date();

  // Rebuild the forward-looking schedule, keeping slots that are already taken.
  await SlotModel.deleteMany({ status: 'open', startsAt: { $gte: now } });

  const slots = doctors.flatMap((doctor) =>
    Array.from({ length: DAYS_AHEAD }, (_, day) =>
      SLOT_TIMES.map(({ hour, minute, mode }) => {
        const startsAt = new Date(now);
        startsAt.setDate(now.getDate() + day);
        startsAt.setHours(hour, minute, 0, 0);
        return startsAt <= now
          ? null
          : { doctor: doctor._id, doctorSlug: doctor.slug, startsAt, mode, fee: mode === 'clinic' ? doctor.fee : doctor.videoFee, status: 'open' as const };
      }),
    ).flat(),
  ).filter((s): s is NonNullable<typeof s> => s !== null);

  const existing = await SlotModel.find({ startsAt: { $gte: now } }, 'doctorSlug startsAt').lean();
  const taken = new Set(existing.map((s) => `${s.doctorSlug}@${s.startsAt.toISOString()}`));
  const fresh = slots.filter((s) => !taken.has(`${s.doctorSlug}@${s.startsAt.toISOString()}`));
  if (fresh.length) await SlotModel.insertMany(fresh, { ordered: false });

  await Promise.all([SpecialtyModel.syncIndexes(), DoctorModel.syncIndexes(), SlotModel.syncIndexes()]);

  console.log(`specialties: ${await SpecialtyModel.countDocuments()}`);
  console.log(`doctors:     ${await DoctorModel.countDocuments()}`);
  console.log(`open slots:  ${await SlotModel.countDocuments({ status: 'open' })}`);

  await mongoose.connection.close();
  await disconnectDatabase();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
