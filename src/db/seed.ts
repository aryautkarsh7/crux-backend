import mongoose from 'mongoose';
import '../config/env.js';
import { connectDatabase, disconnectDatabase } from './connect.js';
import { ARTICLES } from './data/articles.js';
import { ORIGINAL_DOCTOR_META, generateDoctors } from './data/doctors.js';
import { FACILITIES } from './data/facilities.js';
import { LABS } from './data/labs.js';
import { LAB_CATEGORIES, LAB_TESTS } from './data/lab-tests.js';
import { MEDICINES, MEDICINE_CATEGORIES } from './data/medicines.js';
import { FEMALE_PORTRAITS, MALE_PORTRAITS } from './data/portraits.js';
import { generateReviews } from './data/reviews.js';
import { AccessGrantModel } from '../models/access-grant.model.js';
import { AppointmentModel } from '../models/appointment.model.js';
import { ArticleModel } from '../models/article.model.js';
import { DoctorModel } from '../models/doctor.model.js';
import { FacilityModel } from '../models/facility.model.js';
import { LabModel } from '../models/lab.model.js';
import { HealthRecordModel } from '../models/health-record.model.js';
import { LabCategoryModel, LabTestModel } from '../models/lab-test.model.js';
import { LeadModel } from '../models/lead.model.js';
import { MedicineCategoryModel, MedicineModel } from '../models/medicine.model.js';
import { MessageModel } from '../models/message.model.js';
import { OrderModel } from '../models/order.model.js';
import { ReviewModel } from '../models/review.model.js';
import { SlotModel } from '../models/slot.model.js';
import { SpecialtyModel } from '../models/specialty.model.js';
import { UserModel } from '../models/user.model.js';

const SPECIALTIES = [
  {
    slug: 'general-physician', name: 'General Physician', plural: 'General Physicians', icon: 'stethoscope', fromPrice: 399,
    subSpecialties: [
      { slug: 'fever-infection', name: 'Fever & Infections', description: 'Viral fever, dengue, typhoid, post-infection weakness', icon: 'thermostat' },
      { slug: 'cough-cold', name: 'Cough, Cold & Throat', description: 'Persistent cough, sore throat, sinus congestion', icon: 'pulmonology' },
      { slug: 'diabetes-bp', name: 'Diabetes & Blood Pressure', description: 'Sugar control, hypertension review, dose adjustment', icon: 'glucose' },
      { slug: 'stomach-digestion', name: 'Stomach & Digestion', description: 'Acidity, loose motions, bloating, food poisoning', icon: 'gastroenterology' },
      { slug: 'fatigue-weakness', name: 'Fatigue & Weakness', description: 'Tiredness, anaemia, vitamin deficiency, thyroid', icon: 'bedtime' },
      { slug: 'general-consult', name: 'General Health Consult', description: 'Second opinion, report review, fitness certificate', icon: 'clinical_notes' },
    ],
  },
  {
    slug: 'cardiologist', name: 'Cardiologist', plural: 'Cardiologists', icon: 'cardiology', fromPrice: 799,
    subSpecialties: [
      { slug: 'chest-pain', name: 'Chest Pain & Breathlessness', description: 'Exertional chest discomfort, palpitations, breathlessness', icon: 'ecg_heart' },
      { slug: 'bp-hypertension', name: 'Blood Pressure Care', description: 'Uncontrolled BP, medication review, home readings', icon: 'monitor_heart' },
      { slug: 'cholesterol', name: 'Cholesterol & Lipids', description: 'High cholesterol, statin review, lipid profile', icon: 'water_drop' },
      { slug: 'heart-rhythm', name: 'Heart Rhythm', description: 'Irregular heartbeat, AFib, ECG and Holter review', icon: 'vital_signs' },
      { slug: 'cardiac-followup', name: 'Post-Procedure Follow-up', description: 'After angioplasty, stent, bypass or valve surgery', icon: 'event_repeat' },
    ],
  },
  {
    slug: 'dermatologist', name: 'Dermatologist', plural: 'Dermatologists', icon: 'dermatology', fromPrice: 599,
    subSpecialties: [
      { slug: 'acne-scars', name: 'Acne & Scars', description: 'Cystic acne, breakouts, post-acne marks and scarring', icon: 'face' },
      { slug: 'hair-scalp', name: 'Hair Fall & Scalp', description: 'Hair thinning, dandruff, alopecia, scalp infection', icon: 'psychology_alt' },
      { slug: 'skin-allergy', name: 'Skin Allergy & Rash', description: 'Eczema, hives, contact dermatitis, itching', icon: 'allergy' },
      { slug: 'pigmentation', name: 'Pigmentation & Melasma', description: 'Dark spots, melasma, tanning, uneven skin tone', icon: 'palette' },
      { slug: 'fungal-infection', name: 'Fungal & Skin Infection', description: 'Ringworm, recurrent tinea, nail and foot infection', icon: 'coronavirus' },
      { slug: 'cosmetic-aesthetic', name: 'Cosmetic & Anti-Ageing', description: 'Peels, lasers, fillers, fine lines, skin rejuvenation', icon: 'auto_awesome' },
    ],
  },
  {
    slug: 'pediatrician', name: 'Pediatrician', plural: 'Pediatricians', icon: 'child_care', fromPrice: 499,
    subSpecialties: [
      { slug: 'newborn-care', name: 'Newborn Care', description: 'Feeding, jaundice, colic, sleep in the first months', icon: 'crib' },
      { slug: 'child-fever', name: 'Child Fever & Infection', description: 'Fever, cold, ear pain, stomach upset in children', icon: 'thermostat' },
      { slug: 'vaccination', name: 'Vaccination Schedule', description: 'IAP immunisation plan, catch-up and travel vaccines', icon: 'vaccines' },
      { slug: 'growth-nutrition', name: 'Growth & Nutrition', description: 'Weight gain, picky eating, height and milestones', icon: 'monitoring' },
      { slug: 'child-allergy', name: 'Child Allergy & Asthma', description: 'Wheezing, food allergy, recurrent cough in kids', icon: 'pulmonology' },
    ],
  },
  {
    slug: 'gynecologist', name: 'Gynecologist', plural: 'Gynecologists', icon: 'female', fromPrice: 649,
    subSpecialties: [
      { slug: 'pregnancy-care', name: 'Pregnancy Care', description: 'Antenatal review, scan reports, pregnancy symptoms', icon: 'pregnant_woman' },
      { slug: 'period-problems', name: 'Period Problems', description: 'Irregular, heavy or painful periods, spotting', icon: 'calendar_month' },
      { slug: 'pcos', name: 'PCOS & Hormones', description: 'PCOS, weight and hormone imbalance, excess hair', icon: 'biotech' },
      { slug: 'fertility', name: 'Fertility & Conception', description: 'Trying to conceive, ovulation, fertility work-up', icon: 'family_restroom' },
      { slug: 'menopause', name: 'Menopause Care', description: 'Hot flushes, bone health, hormone replacement', icon: 'spa' },
    ],
  },
  {
    slug: 'orthopedist', name: 'Orthopedist', plural: 'Orthopedists', icon: 'accessibility_new', fromPrice: 699,
    subSpecialties: [
      { slug: 'back-neck-pain', name: 'Back & Neck Pain', description: 'Slip disc, sciatica, desk-work neck and spine pain', icon: 'airline_seat_recline_normal' },
      { slug: 'knee-joint-pain', name: 'Knee & Joint Pain', description: 'Knee, hip and shoulder pain, stiffness, swelling', icon: 'accessibility' },
      { slug: 'sports-injury', name: 'Sports Injury', description: 'Ligament tears, sprains, gym and running injuries', icon: 'sports_martial_arts' },
      { slug: 'fracture-followup', name: 'Fracture & Post-Surgery', description: 'Cast review, X-ray reading, rehab after surgery', icon: 'healing' },
      { slug: 'arthritis', name: 'Arthritis Care', description: 'Osteoarthritis, rheumatoid arthritis, gout flares', icon: 'elderly' },
    ],
  },
  {
    slug: 'psychiatrist', name: 'Psychiatrist', plural: 'Psychiatrists', icon: 'psychiatry', fromPrice: 899,
    subSpecialties: [
      { slug: 'anxiety-stress', name: 'Anxiety & Stress', description: 'Panic attacks, work stress, constant worry', icon: 'self_improvement' },
      { slug: 'depression', name: 'Depression & Low Mood', description: 'Persistent sadness, loss of interest, hopelessness', icon: 'sentiment_dissatisfied' },
      { slug: 'sleep-problems', name: 'Sleep Problems', description: 'Insomnia, disturbed sleep, sleep-wake reversal', icon: 'bedtime' },
      { slug: 'addiction', name: 'Addiction Support', description: 'Alcohol, tobacco, substance and screen dependence', icon: 'no_drinks' },
      { slug: 'adhd-focus', name: 'ADHD & Focus', description: 'Attention difficulties, hyperactivity, adult ADHD', icon: 'target' },
    ],
  },
  {
    slug: 'ent-specialist', name: 'ENT Specialist', plural: 'ENT Specialists', icon: 'hearing', fromPrice: 499,
    subSpecialties: [
      { slug: 'ear-hearing', name: 'Ear Pain & Hearing', description: 'Ear ache, blocked ear, hearing loss, tinnitus', icon: 'hearing' },
      { slug: 'sinus-nasal', name: 'Sinus & Nasal', description: 'Sinusitis, blocked nose, allergic rhinitis, snoring', icon: 'masks' },
      { slug: 'throat-voice', name: 'Throat & Voice', description: 'Sore throat, tonsillitis, hoarseness, swallowing', icon: 'record_voice_over' },
      { slug: 'vertigo', name: 'Vertigo & Balance', description: 'Dizziness, spinning sensation, balance problems', icon: 'rotate_right' },
    ],
  },
  {
    slug: 'gastroenterologist', name: 'Gastroenterologist', plural: 'Gastroenterologists', icon: 'gastroenterology', fromPrice: 749,
    subSpecialties: [
      { slug: 'acidity-reflux', name: 'Acidity & Reflux', description: 'Heartburn, GERD, gastritis, long-term antacid use', icon: 'local_fire_department' },
      { slug: 'ibs-constipation', name: 'IBS & Constipation', description: 'Bloating, irregular bowels, chronic constipation', icon: 'gastroenterology' },
      { slug: 'liver-health', name: 'Liver Health', description: 'Fatty liver, deranged LFT, hepatitis follow-up', icon: 'humidity_low' },
      { slug: 'abdominal-pain', name: 'Abdominal Pain', description: 'Recurrent stomach pain, endoscopy report review', icon: 'personal_injury' },
    ],
  },
  {
    slug: 'neurologist', name: 'Neurologist', plural: 'Neurologists', icon: 'neurology', fromPrice: 999,
    subSpecialties: [
      { slug: 'headache-migraine', name: 'Headache & Migraine', description: 'Chronic headache, migraine attacks, preventives', icon: 'neurology' },
      { slug: 'epilepsy', name: 'Epilepsy & Seizures', description: 'Seizure control, EEG review, medication changes', icon: 'bolt' },
      { slug: 'stroke-followup', name: 'Stroke Follow-up', description: 'Post-stroke recovery, blood thinners, rehab plan', icon: 'emergency' },
      { slug: 'nerve-pain', name: 'Nerve Pain & Numbness', description: 'Tingling, neuropathy, weakness in limbs, tremors', icon: 'linear_scale' },
    ],
  },
  {
    slug: 'ophthalmologist', name: 'Ophthalmologist', plural: 'Ophthalmologists', icon: 'visibility', fromPrice: 499,
    subSpecialties: [
      { slug: 'eye-irritation', name: 'Eye Redness & Irritation', description: 'Conjunctivitis, itching, watering, stye', icon: 'visibility' },
      { slug: 'vision-problems', name: 'Vision Problems', description: 'Blurred vision, power change, spectacle advice', icon: 'eyeglasses' },
      { slug: 'dry-eyes', name: 'Dry Eyes & Screen Strain', description: 'Computer vision syndrome, dryness, eye fatigue', icon: 'computer' },
      { slug: 'diabetic-eye', name: 'Diabetic Eye Care', description: 'Retina screening, diabetic and BP-related changes', icon: 'blur_circular' },
    ],
  },
  {
    slug: 'dentist', name: 'Dentist', plural: 'Dentists', icon: 'dentistry', fromPrice: 349,
    subSpecialties: [
      { slug: 'tooth-pain', name: 'Tooth Pain & Cavity', description: 'Toothache, sensitivity, cavities, broken tooth', icon: 'dentistry' },
      { slug: 'gum-problems', name: 'Gum Problems', description: 'Bleeding gums, swelling, bad breath, gum recession', icon: 'sentiment_neutral' },
      { slug: 'braces-alignment', name: 'Braces & Alignment', description: 'Crooked teeth, aligners, braces review', icon: 'straighten' },
      { slug: 'dental-checkup', name: 'Check-up & Cleaning', description: 'Routine review, scaling advice, treatment plan', icon: 'clean_hands' },
    ],
  },
];

const DOCTORS = [
  { slug: 'dr-priya-sharma', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNzU1hZdZyNI_DPkWSf7MoRRp-QH1gKiXDo2-7-FRUM7Lwn_DIucI7NhACYjTQEy4BaA3S9ZmyDaVP8UgAIWxdaNzs3-h63d3a-ImMpVUk7ebYjbuEq_dBuTOaLuVguQYCe0DrRpxJd1cjuGrrZ1R-FvB7TOHmysoo5YF2bqRmtFgJOaB1fzCCp3vQs2GrqH-ULObcTs9uPvO0w7zImVtiCUN1RNCDkHAzWhTRbG-cDlnVYElar9MF', name: 'Dr. Priya Sharma', qualification: 'MBBS, MD - Dermatology, Fellow in Aesthetic Medicine', title: 'Senior Dermatologist & Dermatosurgeon', specialty: 'dermatologist', area: 'Indiranagar', clinicName: 'SkinCare Super Specialty Clinic', experienceYears: 14, fee: 650, videoFee: 349, rating: 4.9, reviewCount: 1240, recommendPercent: 98, languages: ['English', 'Hindi', 'Kannada', 'Tamil'] },
  { slug: 'dr-rajeshwari-iyer', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCANgKgGJ5AwPuVgz9FgpkKzgcz4i-ZhYGzfwrTP-MtUsBn7JtI5eRoAseRuAzJoaNZ-u5LfH_WkPr9CbeYnUC7OSbmPIpnLC3tIqwuPesy3nlomd2U-v0hMMqLFGbVxywPzcvVAZq8ymIdiZyKq5H3GkQknTk_rNQ5IL31bC7wQhzJwp3htgW3FWdZFMa3Ljl9F53HbnlEPi2nh1Ud-ielTdRzX6Kzfuatp9QloJ0rM41x_XSvIjkk', name: 'Dr. Rajeshwari Iyer', qualification: 'MBBS, MD - Dermatology, DNB (Dermatology)', title: 'Dermatologist & Trichologist', specialty: 'dermatologist', area: 'Indiranagar', clinicName: 'DermaCare Clinic', experienceYears: 16, fee: 700, videoFee: 399, rating: 4.8, reviewCount: 890, recommendPercent: 98, languages: ['English', 'Kannada', 'Hindi'] },
  { slug: 'dr-ananya-sen', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWfmdOz6hk4ZlCeU9c385X9ZQu9I0tGyCrWtkIUJlleL9Xdy5ci6q-FaiEH4q_Nr2htSHhdYRk5PYdjbGyF4sdrjzGLdEpCGWKKIISeUIOxHQTZwekE57kqE_m3hFyQnIkxWRCqh3Z7Ed_lPcRZWkUCO5mRXfpshxiNJPXtw2aInNwSZs2DMXsk7VQjXbPeuAlabuwDgQBDIWlXtM4B5vzoHTMH_YwG0Llp9Ck7Bw8IyBK_j_w8U9G', name: 'Dr. Ananya Sen', qualification: 'MBBS, DNB - Dermatology', title: 'Cosmetic Dermatologist', specialty: 'dermatologist', area: 'Whitefield', clinicName: 'HSR Layout Skin Care', experienceYears: 11, fee: 649, videoFee: 349, rating: 4.9, reviewCount: 1120, recommendPercent: 99, languages: ['English', 'Hindi', 'Bengali'] },
  { slug: 'dr-kavya-menon', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKcIP1kgDyQF50k1L1U9qC6PJQcF3ZroRmTUVogFnplaoxaODqJGBPHD_mjpCuUWRi9k3CExtx7l6JacW7Pqtw5rpeZmpk1IpbxPUSA9FOpTEzzYqsBGbzdMHhJmYJjl635dpyfA1slXPkbCZm4xknTC6KMDD5P2DRpUXwcuUxfwNK8wTqLjdE_jCTXhW9Q2bAdAORRHQaysP_BUPRz4hssEjAsuvAeYwr4swo0Y3vxtgU8wgU4Gdt', name: 'Dr. Kavya Menon', qualification: 'MBBS, MD - Dermatology', title: 'Consultant Dermatologist', specialty: 'dermatologist', area: 'Koramangala', clinicName: 'Apollo Clinic Koramangala', experienceYears: 9, fee: 599, videoFee: 349, rating: 4.7, reviewCount: 620, recommendPercent: 96, languages: ['English', 'Malayalam', 'Kannada'] },
  { slug: 'dr-nikhil-rao', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM3Jzitbzol3tRqBDUF9MPI6puAgZmAaNg1RSzS0Yfexta-bhEJGRgMg6xpBy5LZMt2rR98KWx3N7ZhZIk5SRKBr14DZmNCSSDXMDofZfXlE9AQyg0a-DxBPtDSlRandBURyzNKHo6EKbWv79yHu56r__nLgBEqIHpwJmgHvQ7eDLOGnmUdhN2z_tOaDyHf-CCO6bB4YJM3efjuuCp_KWTZ8m2MKIZYDKnUDjSruH9fL8xmDBzxSXh', name: 'Dr. Nikhil Rao', qualification: 'MBBS, MD - Dermatology, MRCP (UK)', title: 'Dermatologist & Laser Specialist', specialty: 'dermatologist', area: 'Jayanagar', clinicName: 'Manipal Skin Institute', experienceYears: 13, fee: 750, videoFee: 449, rating: 4.8, reviewCount: 980, recommendPercent: 97, languages: ['English', 'Kannada', 'Telugu'] },
  { slug: 'dr-sneha-patil', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdvivpTMZ3WcSbeRdbnIVrmwQ49WPN7pMFZyGTqgRMi7fWRiGYXCTf8YYzfNL2OfBSbbBvfqPC1tUtVGpTF08GcJ9413Gnn03LmUfvimOBgWJD6H0mrruylg1AHdDXxFbVnHt8YdM2B4wB_35QSTKsMBKsWzFiXPHGp_gsZEGfK14vqFQ9Wu9wi17F37X8dyYPkueS0tiYYz222RgWUUX5xKq3I76NkLrMn2EhHzFoCcSgt4vIlSlF', name: 'Dr. Sneha Patil', qualification: 'MBBS, DDVL', title: 'Pediatric Dermatologist', specialty: 'dermatologist', area: 'HSR Layout', clinicName: 'Cloudnine Skin & Child Care', experienceYears: 8, fee: 550, videoFee: 299, rating: 4.7, reviewCount: 430, recommendPercent: 95, languages: ['English', 'Hindi', 'Marathi'] },
  { slug: 'dr-meera-nambiar', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7FM8qw0ZhbfA-GD5MVrmxIjZxDIdkG3QQTXU-11V4Ja2GLQ4dArY067QrYLhN1EeWOU08mxovBl2r9ScvNoVqD2BZ9nCFS8jCu1njGSDJxJ7UOPq_9AmC-zD9Y2HWC-PxMB1e45PtzFbY5SIaEjf9IJi84YssDvDTpX1vt0nPw2M2EBjX1J0X6U4xl2xluGYOUckvBoQbHJuUu_WX-1e8kqHMZqXNYzqsrw04-M_zLaK3Qr5kWfwC', name: 'Dr. Meera Nambiar', qualification: 'MBBS, MD - General Medicine', title: 'General Physician', specialty: 'general-physician', area: 'Indiranagar', clinicName: 'Curxx Family Clinic', experienceYears: 12, fee: 399, videoFee: 249, rating: 4.8, reviewCount: 1540, recommendPercent: 97, languages: ['English', 'Malayalam', 'Hindi'] },
  { slug: 'dr-imran-qureshi', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUXrWuweSKXw-JeJJ5Jwy27yqb-TAIJlFh3GCXrZGSb-1BghaACOQX4vOegIf6dx5eh9VbQL5u0dnAB0a4uDjYzTc-JhNBo5L2vDtP7RbuBBMGKdTtS9DPRDSGTSXefuxy1fVwNDDCdaszahi4DOessTCzuYrSaWaV-Xnl5iBhiGrcTQgmaTMJ67FAbCqZB2Y-pO4nF5VJmjl1dNiNr1Dtgrp2WjRVXYqeZQvsk8706VwKjBn6FweG', name: 'Dr. Imran Qureshi', qualification: 'MBBS, MD - Internal Medicine', title: 'Consultant Physician', specialty: 'general-physician', area: 'Koramangala', clinicName: 'Apollo Clinic & Diagnostics', experienceYears: 10, fee: 449, videoFee: 249, rating: 4.7, reviewCount: 760, recommendPercent: 96, languages: ['English', 'Hindi', 'Urdu'] },
  { slug: 'dr-arvind-swaminathan', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFzBz663taQ-wSJo4_ehyR7mGG-g7EcaNFNrQ1HyNsKYcryJ-YoVbG28HhplkI5VbGX1yOV6DhMStNeW_6kusgYH-7usUwHgz4XUK-C847eyy9Ksu6sr0PD1KTI4VNAY4I6vXpGHNqeDa40By6t1pVA24QH2Zx8bq0d1PZRjQymYu_mwhaBx5u1MBaNEojTKqeWBnYV4-fZjhHLaUORQmYYcc-puqg5WYFH4RlcEArXM7xmcJ_C8xs', name: 'Dr. Arvind Swaminathan', qualification: 'MBBS, MS - Orthopedics', title: 'Orthopedic Surgeon', specialty: 'orthopedist', area: 'Koramangala', clinicName: 'Koramangala Ortho Centre', experienceYears: 18, fee: 799, videoFee: 499, rating: 4.9, reviewCount: 1640, recommendPercent: 97, languages: ['English', 'Tamil', 'Kannada'] },
  { slug: 'dr-vikram-desai', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJxzDL6aE47GAxqk0Xus65GNwnqn787Ylhf_eSllWbVzdZqtd2NbnU_wpvXweePjrE5OH2tRdj724TxqlMC7phO11SqbhzC1YQ3sASKXucRCo1k4VNFbNN4GorJGQmo8h9PQtBLDPBuvZRxpmHQF8LO4ss672-YG1QuqGc90GVgw4qSbnQzwG5A-E0N-ZpOTUGvEINWryRFCSU5v7YNBQ5hkJAFT8dfxM1xhExZ1-9kibz0Ph5NUUw', name: 'Dr. Vikram Desai', qualification: 'MBBS, MD, DM - Cardiology', title: 'Interventional Cardiologist', specialty: 'cardiologist', area: 'HAL Airport Road', clinicName: 'Manipal Super Specialty Hospital', experienceYears: 21, fee: 899, videoFee: 599, rating: 4.9, reviewCount: 2100, recommendPercent: 98, languages: ['English', 'Hindi', 'Gujarati'] },
  { slug: 'dr-lakshmi-narayan', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUZMYG3kDWBHUbrpKq_2tul0ZATsnUoLC2dMcTYZujo2wBOhz3Es5kMVhEEKFVZlHpV1PIV5YfbnD_rxRDtAB4nIY7VCGbOhW0vNF6_EnKpj9YkUh6WQfbbmrn1gXnn9QvtfkyJGbggis3CFH1T4GCcGTUaHguNKyjOyn0rw5jtjkYura65p47RJD4szM_PKYSyECs8cfHj_fZXEPw5CKO_W496Rc60HYMEgUtRYLMOLzY7uHqN_x1', name: 'Dr. Lakshmi Narayan', qualification: 'MBBS, MD - Obstetrics & Gynaecology', title: 'Senior Gynaecologist', specialty: 'gynecologist', area: 'Indiranagar', clinicName: 'Cloudnine Hospital', experienceYears: 17, fee: 699, videoFee: 399, rating: 4.9, reviewCount: 1890, recommendPercent: 98, languages: ['English', 'Kannada', 'Tamil'] },
  { slug: 'dr-rahul-bhatt', photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB6I-pDVrIg65IOFc-5a99zl63XLFGQ2XxPyRTkjvrf2hjwfgdpknnomLzrPeEjXc-Wnea7twWVAtBMZIoO21Fodc3g7tP5C2w0PsOJYg11tG7gLdjNOqDmM0Mf4ZIXS_uNLigJ6L-T79CqZ17mUWmF5J-S1xxs1Gc5YHDrOJrZK1EtuaysmqSXI1xVHWha0V0tocTG6zx_PxZuYT5VmbWfcrm35V0dNfsvFtNuPH8nS1TdbDMjH3P0', name: 'Dr. Rahul Bhatt', qualification: 'MBBS, MD - Pediatrics', title: 'Consultant Paediatrician', specialty: 'pediatrician', area: 'Hebbal', clinicName: 'Aster CMI Hospital', experienceYears: 15, fee: 549, videoFee: 349, rating: 4.8, reviewCount: 1320, recommendPercent: 97, languages: ['English', 'Hindi', 'Kannada'] },
];

// What each doctor actually treats, using the sub-specialty slugs above. The instant
// video flow narrows the list with these after the patient picks a focus area.
const FOCUS_AREAS: Record<string, string[]> = {
  'dr-priya-sharma': ['acne-scars', 'pigmentation', 'cosmetic-aesthetic', 'skin-allergy'],
  'dr-rajeshwari-iyer': ['hair-scalp', 'acne-scars', 'fungal-infection', 'skin-allergy'],
  'dr-ananya-sen': ['cosmetic-aesthetic', 'pigmentation', 'acne-scars'],
  'dr-kavya-menon': ['skin-allergy', 'fungal-infection', 'acne-scars'],
  'dr-nikhil-rao': ['pigmentation', 'cosmetic-aesthetic', 'hair-scalp'],
  'dr-sneha-patil': ['skin-allergy', 'fungal-infection', 'acne-scars'],
  'dr-meera-nambiar': ['fever-infection', 'cough-cold', 'fatigue-weakness', 'general-consult'],
  'dr-imran-qureshi': ['diabetes-bp', 'stomach-digestion', 'fever-infection', 'general-consult'],
  'dr-arvind-swaminathan': ['knee-joint-pain', 'back-neck-pain', 'sports-injury', 'fracture-followup', 'arthritis'],
  'dr-vikram-desai': ['chest-pain', 'bp-hypertension', 'cholesterol', 'heart-rhythm', 'cardiac-followup'],
  'dr-lakshmi-narayan': ['pregnancy-care', 'period-problems', 'pcos', 'fertility', 'menopause'],
  'dr-rahul-bhatt': ['child-fever', 'vaccination', 'growth-nutrition', 'newborn-care', 'child-allergy'],
};

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


const upsertAll = <T extends { slug: string }>(model: { bulkWrite: (ops: any[]) => Promise<unknown> }, docs: readonly T[]) =>
  model.bulkWrite(docs.map((d) => ({ updateOne: { filter: { slug: d.slug }, update: { $set: d }, upsert: true } })));

async function seed() {
  await connectDatabase();
  console.log('seeding…');

  // ---- Catalogue ----
  await upsertAll(SpecialtyModel, SPECIALTIES);
  await upsertAll(FacilityModel, FACILITIES.map((f) => ({ ...f, city: 'bangalore' })));
  await upsertAll(MedicineCategoryModel, MEDICINE_CATEGORIES);
  await upsertAll(MedicineModel, MEDICINES);
  await upsertAll(LabCategoryModel, LAB_CATEGORIES.map((c, order) => ({ slug: c.slug, name: c.name, icon: c.icon, order })));
  await upsertAll(LabTestModel, LAB_TESTS);
  await upsertAll(LabModel, LABS.map((l) => ({ ...l, city: 'bangalore' })));
  await upsertAll(ArticleModel, ARTICLES);

  // ---- Doctors: originals re-homed to real facilities, plus a generated roster ----
  const facilityBySlug = new Map(FACILITIES.map((f) => [f.slug, f]));
  const subSpecialties = Object.fromEntries(SPECIALTIES.map((sp) => [sp.slug, sp.subSpecialties.map((sub) => sub.slug)]));
  const existingCount: Record<string, number> = {};
  for (const d of DOCTORS) existingCount[d.specialty] = (existingCount[d.specialty] ?? 0) + 1;
  const generated = generateDoctors(existingCount, new Set(DOCTORS.map((d) => d.slug)), subSpecialties);

  // Portraits: keep the originals that match, hand out the rest without repeats until the pool runs dry.
  const usedPhotos = new Set(DOCTORS.filter((d) => ORIGINAL_DOCTOR_META[d.slug]?.keepPhoto).map((d) => d.photoUrl));
  const pools = {
    female: FEMALE_PORTRAITS.filter((u) => !usedPhotos.has(u)),
    male: MALE_PORTRAITS.filter((u) => !usedPhotos.has(u)),
  };
  const cursor = { female: 0, male: 0 };
  const nextPortrait = (gender: 'female' | 'male') => {
    const pool = pools[gender].length ? pools[gender] : gender === 'female' ? FEMALE_PORTRAITS : MALE_PORTRAITS;
    return pool[cursor[gender]++ % pool.length]!;
  };

  // The hand-written doctors only have a qualification string; derive their training timeline from it.
  const INSTITUTES = ['AIIMS New Delhi', 'Bangalore Medical College', 'CMC Vellore', 'Kasturba Medical College, Manipal', 'St. John’s Medical College, Bengaluru', 'JIPMER Puducherry'];
  const educationFor = (d: (typeof DOCTORS)[number], i: number) => {
    const parts = d.qualification.split(',').map((q) => q.trim()).filter(Boolean);
    const graduated = 2026 - d.experienceYears - 3;
    return parts.map((degree, k) => ({ degree, institute: INSTITUTES[(i + k * 2) % INSTITUTES.length]!, year: graduated - (parts.length - 1 - k) * 3 }));
  };

  const originals = DOCTORS.map((d, i) => {
    const meta = ORIGINAL_DOCTOR_META[d.slug]!;
    return {
      ...d,
      gender: meta.gender,
      facilitySlug: meta.facilitySlug,
      photoUrl: meta.keepPhoto ? d.photoUrl : nextPortrait(meta.gender),
      focusAreas: FOCUS_AREAS[d.slug] ?? [],
      education: educationFor(d, i),
      registration: `KMC ${48000 + i * 1379}`,
    };
  });
  const roster = [...originals, ...generated.map((d) => ({ ...d, photoUrl: nextPortrait(d.gender) }))];

  await DoctorModel.bulkWrite(
    roster.map((d) => {
      const facility = facilityBySlug.get(d.facilitySlug as never)!;
      const specialtyName = SPECIALTIES.find((sp) => sp.slug === d.specialty)?.name.toLowerCase() ?? 'doctor';
      return {
        updateOne: {
          filter: { slug: d.slug },
          update: {
            $set: {
              ...d,
              city: 'bangalore',
              verified: true,
              clinicName: facility.name,
              area: facility.area,
              about: `${d.name} is a ${d.title.toLowerCase()} with ${d.experienceYears} years of experience, consulting at ${facility.name}, ${facility.area}. ${d.name.split(' ')[1]} sees patients in person and on video for ${specialtyName} concerns, and follows up on chat for 7 days after every consultation.`,
            },
          },
          upsert: true,
        },
      };
    }) as never,
  );
  // Drop any doctor no longer in the roster (and their unbooked slots).
  const rosterSlugs = roster.map((d) => d.slug);
  await DoctorModel.deleteMany({ slug: { $nin: rosterSlugs } });

  // ---- Slots: rebuild the forward schedule, keeping anything held or booked ----
  const doctors = await DoctorModel.find().lean();
  const now = new Date();
  await SlotModel.deleteMany({ status: 'open', startsAt: { $gte: now } });
  await SlotModel.deleteMany({ doctorSlug: { $nin: rosterSlugs }, status: { $ne: 'booked' } });

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

  // ---- Reviews: regenerate seeded ones, keep anything real patients wrote ----
  await ReviewModel.deleteMany({ user: { $exists: false } });
  await ReviewModel.insertMany(generateReviews(doctors.map((d) => ({ slug: d.slug, specialty: d.specialty }))));
  const reviewStats = await ReviewModel.aggregate<{ _id: string; average: number }>([{ $group: { _id: '$doctorSlug', average: { $avg: '$rating' } } }]);
  await DoctorModel.bulkWrite(reviewStats.map((r) => ({ updateOne: { filter: { slug: r._id }, update: { $set: { rating: Math.round(r.average * 10) / 10 } } } })));

  // syncIndexes also drops stale ones — including the old TTL index that deleted lapsed holds.
  await Promise.all(
    [SpecialtyModel, DoctorModel, SlotModel, FacilityModel, MedicineModel, MedicineCategoryModel, LabTestModel, LabCategoryModel, LabModel, ArticleModel, ReviewModel, OrderModel, HealthRecordModel, AccessGrantModel, AppointmentModel, MessageModel, LeadModel, UserModel].map((m) => (m as { syncIndexes: () => Promise<unknown> }).syncIndexes()),
  );

  const count = async (label: string, n: Promise<number>) => console.log(`${label.padEnd(14)}${await n}`);
  await count('specialties', SpecialtyModel.countDocuments());
  await count('facilities', FacilityModel.countDocuments());
  await count('doctors', DoctorModel.countDocuments());
  await count('open slots', SlotModel.countDocuments({ status: 'open' }));
  await count('reviews', ReviewModel.countDocuments());
  await count('medicines', MedicineModel.countDocuments());
  await count('lab tests', LabTestModel.countDocuments());
  await count('labs', LabModel.countDocuments());
  await count('articles', ArticleModel.countDocuments());

  await mongoose.connection.close();
  await disconnectDatabase();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
