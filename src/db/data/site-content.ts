/**
 * Seed copy for the editable website content (site settings, page sections, testimonials, plans).
 * Numbers that exist in the database are placeholders filled in by the website from GET /site/stats:
 * {labTests}, {cities}, {accreditedFacilities}; {city} in a link is the visitor's city.
 * Copied word for word from the website so the first sync changes nothing visible: homepage and
 * Partner copy follow the SEO content spec, and heading levels are fixed by the components, not here.
 */

type Faq = { question: string; answer: string };
type Band = { id: string; eyebrow: string; heading: string; body: string; icon: string; cta: { label: string; href: string }; points?: string[] };

export const HOME_FAQS: Faq[] = [
  { question: 'How much does a video consultation cost on Curxx?', answer: 'Fees vary by doctor and specialty and are shown upfront on each doctor’s profile before you book — there are no hidden charges added at checkout.' },
  { question: 'Will I get a valid prescription after an online consultation?', answer: 'Yes. Every video, audio, or chat consultation ends with a digitally signed e-prescription that’s valid for pharmacy purchase and stored in your health locker.' },
  { question: 'What happens if the doctor doesn’t join the video call on time?', answer: 'If a doctor misses the scheduled slot, you’re automatically offered a free rebooking or a full refund, whichever you prefer.' },
  { question: 'Can I cancel or reschedule a clinic visit after booking?', answer: 'Yes, both video consults and clinic visits can be rescheduled or cancelled from your bookings page, subject to the clinic’s cancellation window (usually up to a few hours before the slot).' },
  { question: 'Do I need an ABHA ID to use Curxx?', answer: 'No, ABHA is optional but recommended — it lets you carry your prescriptions and reports across any doctor or hospital in India, not just those on Curxx.' },
  { question: 'Is my health data safe on Curxx?', answer: 'Curxx is ISO 27001 certified and ABDM certified, and all health records are encrypted and shared only with your explicit consent.' },
  { question: 'Can I use my insurance or corporate health plan on Curxx?', answer: 'Yes, if your employer has a Curxx corporate health plan, cashless OPD consultations (both online and in-clinic) are available directly through your linked account.' },
  { question: 'How fast can I get medicines delivered?', answer: 'Prescription medicines from verified partner pharmacies are typically delivered within 2 hours in serviceable areas.' },
  { question: 'Are the lab tests and health checkups accurate if the sample is collected at home?', answer: 'Yes, samples are collected by certified phlebotomists following standard cold-chain protocols and processed at NABL-accredited partner labs, same as an in-clinic draw.' },
  { question: 'Can Curxx be used for a medical emergency?', answer: 'No — Curxx is for scheduled consultations and non-emergency care. In a medical emergency, call local emergency services or go directly to the nearest hospital.' },
];

export const HOME_BANDS: Band[] = [
  {
    id: 'teleconsultation',
    eyebrow: '24/7 Teleconsultation',
    heading: '24/7 Video, Audio & Chat Consultations',
    body: 'Connect with a certified doctor over secure, encrypted video, audio, or chat — any time, day or night. A 60-second connect time for general physicians and specialists alike.',
    icon: 'video_chat',
    cta: { label: 'Start a video consult', href: '/consult/video' },
    points: ['60-second average connect', 'Encrypted, ABDM-compliant rooms', 'Digitally signed e-prescription'],
  },
  {
    id: 'pharmacy',
    eyebrow: 'E-Pharmacy & Medicine Delivery',
    heading: 'Upload a Prescription, Get Medicines at Your Doorstep',
    body: 'Order 100% authentic medicines from verified pharmacies, dispensed against your e-prescription and delivered within 2 hours.',
    icon: 'medication',
    cta: { label: 'Upload prescription', href: '/medicines/upload' },
    points: ['Verified partner pharmacies', '2-hour express delivery', 'Cold-chain handling where needed'],
  },
  {
    id: 'lab-tests',
    eyebrow: 'At-Home Diagnostic Tests',
    heading: 'Lab Tests & Health Checkups, Sample Collected From Home',
    body: 'Book blood tests and full health checkup packages through partner labs. A certified phlebotomist collects your sample at home, with digital reports ready in 6 hours.',
    icon: 'science',
    cta: { label: 'Book a lab test', href: '/lab-tests' },
    points: ['NABL-accredited partner labs', 'Free home sample collection', 'Digital reports in 6 hours'],
  },
  {
    id: 'curxx-plus',
    eyebrow: 'Curxx Plus (Subscription)',
    heading: 'Curxx Plus: Unlimited Consultations for Your Whole Family',
    body: 'One family plan, unlimited online consultations for every member, plus priority booking on in-clinic appointments and discounted lab tests.',
    icon: 'family_restroom',
    cta: { label: 'See Curxx Plus', href: '/curxx-plus' },
    points: ['Unlimited online consults', 'Priority in-clinic booking', 'Discounted lab packages'],
  },
];

export const PARTNER_SECTIONS: (Band & { points: string[] })[] = [
  {
    id: 'doctors-clinics',
    eyebrow: 'For Doctors & Clinics',
    heading: 'Grow Your Practice with Curxx Pro & Curxx Desk',
    body: 'Manage scheduling, digital billing, and automated patient SMS reminders from one dashboard. Build your digital footprint and offer patients the choice to book online or in person.',
    icon: 'stethoscope',
    points: ['Online + in-clinic scheduling', 'Digital billing and receipts', 'Automated SMS reminders'],
    cta: { label: 'Create your clinical profile', href: '/for-providers#signup-form' },
  },
  {
    id: 'hospitals',
    eyebrow: 'For Hospitals',
    heading: 'A Complete Hospital Information Management System — Curxx Insta',
    body: 'Cloud-based HIMS to sync OPD scheduling, lab interfaces, pharmacy inventory, and bed management — built for hospitals running both walk-in and teleconsultation OPDs.',
    icon: 'local_hospital',
    points: ['OPD and teleconsultation in one queue', 'Lab and pharmacy interfaces', 'Bed and inventory management'],
    cta: { label: 'Talk to the HIMS team', href: 'mailto:partners@curxx.example?subject=Curxx%20Insta%20for%20hospitals' },
  },
  {
    id: 'corporates',
    eyebrow: 'For Corporates',
    heading: 'Corporate Health Benefit Plans for Your Employees',
    body: 'Deploy customizable health coverage for your workforce — cashless OPD (online and in-clinic), mental wellness webinars, and family coverage — managed from a single HR dashboard.',
    icon: 'work',
    points: ['Cashless OPD, online and in-clinic', 'Mental wellness webinars', 'Single HR dashboard'],
    cta: { label: 'Get a corporate plan', href: 'mailto:partners@curxx.example?subject=Corporate%20health%20plan' },
  },
];

export const TRUST_BADGES = ['NABH Partner Network', 'ISO 27001 Certified', 'HIPAA Compliant', 'ABDM Certified'];

export const LAB_TRENDING_SEARCHES = [
  { label: 'CBC Test', q: 'CBC' },
  { label: 'HbA1c', q: 'HbA1c' },
  { label: 'Lipid Profile', q: 'Lipid' },
  { label: 'Thyroid T3/T4/TSH', q: 'Thyroid' },
];

export const LAB_SYMPTOMS: { label: string; icon: string; category: string; emergency?: boolean }[] = [
  { label: 'Fatigue & Weakness', icon: 'bolt', category: 'vitamin-d-b12' },
  { label: 'Joint Pain', icon: 'accessibility_new', category: 'vitamin-d-b12' },
  { label: 'Hairfall', icon: 'content_cut', category: 'thyroid' },
  { label: 'Unexplained Weight Gain', icon: 'monitor_weight', category: 'thyroid' },
  { label: 'Chest Discomfort', icon: 'ecg_heart', category: 'heart-health', emergency: true },
  { label: 'Frequent Urination', icon: 'water_drop', category: 'diabetes' },
  { label: 'Digestive Issues', icon: 'save_as', category: 'liver-function' },
  { label: 'Fever', icon: 'thermostat', category: 'fever-infections' },
];

export const MEDICINE_POPULAR_SEARCHES = ['Paracetamol', 'Metformin', 'Vitamin C', 'Minoxidil', 'Cetirizine'];

/** tone: tertiary | primary | neutral — the icon colour. */
export const MEDICINE_TRUST = [
  { icon: 'verified_user', title: '100% Genuine Medicines', body: 'Direct from certified pharma brands', tone: 'tertiary' },
  { icon: 'ac_unit', title: 'Cold-Chain Delivery', body: 'Insulated vaccine & insulin transport', tone: 'primary' },
  { icon: 'medical_services', title: 'Licensed Pharmacy', body: 'CDSCO & State Council approved', tone: 'neutral' },
  { icon: 'keyboard_return', title: 'Easy 7-Day Returns', body: 'Hassle-free pickups for sealed packs', tone: 'neutral' },
];

export const PLUS_PLANS = [
  { id: 'solo', name: 'Plus Solo', price: 499, members: '1 member', highlight: false, perks: ['Unlimited online GP consults', '2 specialist video consults / month', '10% off lab tests', '5% off medicines'] },
  { id: 'family', name: 'Plus Family', price: 1199, members: 'Up to 4 members', highlight: true, perks: ['Unlimited online GP consults for everyone', '4 specialist video consults / month', 'Priority in-clinic booking', '15% off lab tests', '10% off medicines', '1 free full-body checkup / year'] },
  { id: 'family-max', name: 'Plus Family Max', price: 1799, members: 'Up to 6 members, incl. parents', highlight: false, perks: ['Everything in Plus Family', 'Unlimited specialist video consults', 'Free home sample collection', '2 free full-body checkups / year', 'Dedicated care manager'] },
];

const PLUS_BENEFIT_ROWS: [string, string, string][] = [
  ['video_chat', 'Unlimited online consultations', 'Video, audio or chat with verified doctors any time — no per-consult fee for general physicians.'],
  ['event_available', 'Priority clinic booking', 'Earliest in-clinic slots are held for Plus members at partner clinics and hospitals.'],
  ['science', 'Discounted lab tests', 'Lower prices on {labTests} tests and scans, with free home sample collection on Family Max.'],
  ['medication', 'Savings on medicines', 'Extra discount on every pharmacy order, delivered from verified partner pharmacies.'],
  ['family_restroom', 'One plan, whole family', 'Add your spouse, children and parents; everyone gets their own health records.'],
  ['support_agent', 'Care manager', 'A dedicated care manager for Family Max helps with referrals, second opinions and admissions.'],
];
export const PLUS_BENEFITS = PLUS_BENEFIT_ROWS.map(([icon, title, body]) => ({ icon, title, body }));

export const PLUS_FAQS: Faq[] = [
  { question: 'What does “unlimited consultations” cover?', answer: 'Every member can consult a general physician online as often as they need. Specialist video consultations are included up to the monthly limit of your plan (unlimited on Family Max).' },
  { question: 'Who can I add to a family plan?', answer: 'Your spouse, children and parents. Plus Family covers up to 4 members and Plus Family Max up to 6.' },
  { question: 'Can I use Curxx Plus in any city?', answer: 'Yes. Online consultations work anywhere in India, and Plus discounts apply at partner clinics, labs and pharmacies in all {cities} Curxx cities.' },
  { question: 'Can I cancel?', answer: 'Yes, within 14 days of activation for a full refund if you haven’t used a consultation. After that the plan stays active until the end of its year.' },
];

export const LEGAL_PAGES = {

  'privacy': { title: 'Privacy Policy', intro: 'Last updated 1 September 2026. This is placeholder policy text for the Curxx prototype.', sections: ([
  ['Information we collect', 'Account details you provide (name, mobile number, date of birth), consultation and booking history, prescriptions and reports you upload or sync from your ABHA health locker, and device information needed to run video consultations securely.'],
  ['How we use your information', 'To book and run consultations, deliver medicines and lab services, share records with doctors you explicitly authorise, send appointment reminders, and meet our obligations under Indian medical and data-protection law.'],
  ['Consent and sharing', 'Health records are shared only with the doctors, labs or hospitals you choose, for the duration you choose. You can revoke access at any time from Health Records → Manage Access.'],
  ['Security', 'Records are encrypted in transit and at rest. Access is logged and auditable, in line with the Digital Personal Data Protection (DPDP) Act, 2023 and ABDM guidelines.'],
  ['Your rights', 'You can view, correct, export or request deletion of your personal data by writing to our Grievance Officer at privacy@curxx.example.'],
] as [string, string][]).map(([heading, body]) => ({ heading, body })) },

  'terms': { title: 'Terms of Service', intro: 'Last updated 1 September 2026. This is placeholder text for the Curxx prototype.', sections: ([
  ['Using Curxx', 'Curxx connects patients with independently practising, verified doctors, pharmacies and diagnostic labs. Curxx does not itself provide medical advice.'],
  ['Not for emergencies', 'Do not use Curxx for medical emergencies. Call 108 or go to the nearest emergency department immediately.'],
  ['Bookings, payments and refunds', 'Appointments can be cancelled free of charge up to 2 hours before the scheduled time, with a full refund to the original payment method.'],
  ['Prescriptions and medicines', 'Prescription-only medicines are dispensed only against a valid prescription verified by a registered pharmacist.'],
  ['Changes to these terms', 'We may update these terms; continued use after an update means you accept the revised terms.'],
] as [string, string][]).map(([heading, body]) => ({ heading, body })) },

  'teleconsultation-policy': { title: 'Teleconsultation Policy', intro: 'How online consultations on Curxx work. Placeholder text for the prototype.', sections: ([
  ['Who you consult', 'Every doctor on Curxx is registered with the National Medical Commission or a State Medical Council, and their registration is verified before they can consult.'],
  ['What teleconsultation can and cannot do', 'Video and chat consultations follow the Telemedicine Practice Guidelines. Your doctor may ask you to visit a clinic in person if a physical examination is needed.'],
  ['Prescriptions', 'Doctors issue digitally signed e-prescriptions where clinically appropriate. Certain medicines cannot be prescribed over teleconsultation under the guidelines.'],
  ['Consent and records', 'Starting a consultation means you consent to it. Consultation notes and prescriptions are saved to your Health Records and can be pushed to your ABHA locker.'],
  ['Emergencies', 'Teleconsultation is not suitable for emergencies. For chest pain, breathing difficulty, severe bleeding or loss of consciousness, call 108 immediately.'],
] as [string, string][]).map(([heading, body]) => ({ heading, body })) },

};
/** The eight "Complete Care Ecosystem" cards. `{city}` in a link becomes the visitor's city. */
export const HOME_SERVICES = [
  { eyebrow: 'Instant Consult', title: 'Instant Video Consult', body: 'Connect in 60 seconds with certified Indian GPs and senior clinical specialists on secure video.', icon: 'video_chat', cta: 'Consult in 60s', href: '/consult/video' },
  { eyebrow: 'In-Person Care', title: 'Book Clinic Visit', body: 'Zero wait-time appointments at {accreditedFacilities} accredited neighborhood hospitals and polyclinics.', icon: 'local_hospital', cta: 'Find Clinics', href: '/{city}/clinics' },
  { eyebrow: 'Doorstep Pharmacy', title: 'Prescribed Medicines', body: '100% authentic medicines dispensed by verified pharmacies and delivered within 2 hours.', icon: 'medication', cta: 'Order Medicines', href: '/medicines', anchor: 'medicines' },
  { eyebrow: 'Diagnostic Labs', title: 'Home Lab Tests', body: 'Certified phlebotomist sample collection from your doorstep with digital reports in 6 hours.', icon: 'science', cta: 'Book Lab Test', href: '/lab-tests' },
  { eyebrow: 'Free First Consult', title: 'Free Video Consultation', body: 'Talk to verified doctors who offer a free first video consult — no charge for the call, prescription included.', icon: 'redeem', cta: 'See free consults', href: '/consult/video/general-physician/all?when=free' },
  { eyebrow: 'Planned Surgery', title: 'Surgery Care', body: 'Laser piles, cataract, hernia, knee replacement and more — cost estimates, top hospitals and a free surgeon consultation.', icon: 'healing', cta: 'Explore surgeries', href: '/{city}/surgeries' },
  { eyebrow: 'Symptom Checker', title: 'Check Your Symptoms', body: 'Answer a few quick questions and get the right specialist, how soon to see them, and doctors available now.', icon: 'symptoms', cta: 'Start symptom check', href: '/triage' },
  { eyebrow: 'Health Records', title: 'Digital Health Locker', body: 'Prescriptions, lab reports and scans in one place, linked to your ABHA ID and shared only with your consent.', icon: 'folder_shared', cta: 'Open health locker', href: '/records' },
];

export const HOME_HOW_IT_WORKS = [
  { title: 'Search Verified Doctor', body: 'Filter by specialty, symptom, clinical experience, languages spoken, and clinic location in your neighborhood.', footnote: '100% Medical Council of India verified' },
  { title: 'Consult Online or In-Person', body: 'Start an instant HD video consultation in 60s or book an appointment at an accredited polyclinic near you.', footnote: 'Zero waiting room time guaranteed' },
  { title: 'Get Digital Rx & Follow-up', body: 'Receive a digitally signed e-prescription valid at any chemist, plus 7-day free chat follow-up with your doctor.', footnote: 'Auto-synced to your ABHA health record' },
];

export const PROVIDER_FAQS: Faq[] = [
  { question: 'What documentation is required to list my practice on Curxx?', answer: 'We require your National Medical Commission (NMC) or State Medical Council registration certificate, qualifying degree certificates (MBBS, MD, MS, DNB), and proof of clinic address. Our credentialing team verifies records against state databases within 12-24 hours.' },
  { question: 'How do patient fee payouts and settlements work?', answer: 'All consultation fees collected through online bookings are automatically settled to your verified bank account on a T+1 business day basis via NEFT/UPI. Curxx charges 0% commission on in-clinic OPD visits and provides itemized automated GST tax invoices.' },
  { question: 'Is Curxx compliant with Telemedicine Guidelines and ABDM?', answer: 'Yes, Curxx is 100% compliant with the National Health Authority (NHA) Ayushman Bharat Digital Mission (ABDM) Milestone 1, 2, and 3 certifications. It adheres strictly to the Board of Governors / NMC Telemedicine Practice Guidelines and the Digital Personal Data Protection (DPDP) Act 2023.' },
  { question: 'Can my clinic receptionist or staff manage slots and patient check-ins?', answer: 'Yes. Role-based access allows clinic managers, desk staff, and receptionists to log into a restricted front-desk dashboard to handle walk-ins, print physical tokens, mark patient arrivals, and collect offline billing without seeing doctor-confidential EHR notes.' },
  { question: 'What happens after the 3-month free trial ends?', answer: 'After your initial 90 days, you can choose to continue on the Free plan forever (15 appointments/month) or upgrade to the Professional plan at ₹1,499/month. There are never any automatic debits or credit card lock-ins.' },
];

export const PROVIDER_PLANS = [
  { id: 'provider-free', name: 'Free', tagline: 'For independent doctors starting out.', price: 0, period: 'forever', highlight: false, badge: '', ctaLabel: 'Start Free', perks: ['Basic verified profile listing', 'Up to 15 appointments / month', 'Standard patient ratings & reviews', 'Manual OPD slot management'], excluded: ['ABHA health record dispatch'] },
  { id: 'provider-professional', name: 'Professional', tagline: 'For active clinicians and private practices.', price: 1499, period: 'month', highlight: true, badge: 'MOST POPULAR', ctaLabel: 'Start 90-Day Free Trial', perks: ['**Unlimited clinic appointments**', '**Unlimited 1080p video consults**', 'Digital Rx writer with ICD-10 suggestions', 'Direct ABHA ID patient record syncing', 'Automated WhatsApp & SMS reminders', 'Priority search ranking in your city'], excluded: [] },
  { id: 'provider-clinic-hospital', name: 'Clinic & Hospital', tagline: 'For polyclinics, nursing homes & OPDs.', price: 4999, period: 'month', highlight: false, badge: '', ctaLabel: 'Contact Enterprise', perks: ['Up to 10 verified doctor profiles', 'Dedicated receptionist role & token queue', 'Multi-room OPD queue management', 'Advanced revenue & collection analytics', 'Custom pharmacy & lab dispatch tie-ins', 'Dedicated account manager & onboarding'], excluded: [] },
];

export const TESTIMONIALS = [
  { slug: 'priya-sharma-bengaluru', audience: 'patient', name: 'Priya Sharma', initials: 'PS', location: 'Bengaluru, Karnataka', city: 'bangalore', rating: 5, text: 'My 4-year-old had a sudden high fever at 11 PM. Within 90 seconds, Dr. Nambiar was on video, assessed his symptoms calmly, and the prescribed medicines arrived before midnight. Invaluable reassurance.' },
  { slug: 'rohan-mehta-mumbai', audience: 'patient', name: 'Rohan Mehta', initials: 'RM', location: 'Mumbai, Maharashtra', city: 'mumbai', rating: 5, text: 'Connecting my existing ABHA card was completely seamless. All my previous spine reports were right there for Dr. Arvind to inspect. Avoided carrying heavy paper files.' },
  { slug: 'kavita-krishnan-chennai', audience: 'patient', name: 'Kavita Krishnan', initials: 'KK', location: 'Chennai, Tamil Nadu', city: 'chennai', rating: 5, text: 'The AI triage feature directed me straight to a dermatologist instead of guessing. Dr. Sen resolved my persistent skin allergy within two weeks with the 7-day chat follow-up.' },
  { slug: 'dr-priya-sharma-provider', audience: 'provider', name: 'Dr. Priya Sharma', initials: 'PS', location: 'MD Dermatology • Bengaluru', city: 'bangalore', rating: 5, badge: { icon: 'trending_up', label: '3.4x Booking Growth' }, text: 'Curxx cut my clinic no-shows in half and brought verified patients looking specifically for clinical acne treatments. The prescription writer with ICD-10 suggestions is by far the best I\'ve used.' },
  { slug: 'dr-arvind-kumar-provider', audience: 'provider', name: 'Dr. Arvind Kumar', initials: 'AK', location: 'MBBS, MD Internal Medicine • Apollo Clinic', city: '', rating: 5, badge: { icon: 'schedule', label: '+4.5 hrs saved weekly' }, text: 'Transitioning to ABDM compliance seemed daunting until we integrated Curxx. The patient ABHA locker sync is completely seamless and our front-desk paperwork has essentially dropped to zero.' },
  { slug: 'dr-ramesh-rao-provider', audience: 'provider', name: 'Dr. Ramesh Rao', initials: 'RR', location: 'Cardiologist • Fortis Hospital Network', city: '', rating: 5, badge: { icon: 'payments', label: '₹2.1L Monthly Teleconsults' }, text: 'The video consultation room feels like an actual clinic desk. Instant e-prescriptions and automated same-day payouts make managing teleconsultations between hospital rounds truly effortless.' },
];

/**
 * Single values. `claim` settings are marketing statements that can't be computed from the database:
 * each must be true before launch. Counts that can be computed (doctors, clinics, ratings, tests) come
 * from GET /site/stats instead and have no setting.
 */
export const SITE_SETTINGS = [
  { slug: 'claim-consultations', label: 'Consultations completed', group: 'Claims — must be true', kind: 'claim', value: '1.2M+', note: 'Homepage hero trust row: “1.2M+ Consultations”.' },
  { slug: 'claim-patients', label: 'Happy patients', group: 'Claims — must be true', kind: 'claim', value: '1.2M+', note: 'Homepage Patient Stories heading: “Trusted by 1.2M+ Happy Patients Across India”.' },
  { slug: 'claim-certification-title', label: 'Certification badge', group: 'Claims — must be true', kind: 'claim', value: 'ABDM & NABH', note: 'Homepage hero trust row, third item.' },
  { slug: 'claim-certification-subtitle', label: 'Certification badge subtitle', group: 'Claims — must be true', kind: 'claim', value: 'Certified Protocol', note: 'Line under the certification badge.' },
  { slug: 'claim-app-rating', label: 'App store rating', group: 'Claims — must be true', kind: 'claim', value: '4.9', note: 'Homepage app download band: “⭐ 4.9 · 100K+ Downloads”.' },
  { slug: 'claim-app-downloads', label: 'App downloads', group: 'Claims — must be true', kind: 'claim', value: '100K+', note: 'Homepage app download band.' },
  { slug: 'contact-phone', label: 'Curxx helpline number', group: 'Contact', kind: 'text', value: '', note: 'Call button fallback when a doctor, clinic or lab has no number of its own. Digits with country code, e.g. 918047190108. Leave empty to hide.' },
  { slug: 'contact-whatsapp', label: 'Curxx WhatsApp number', group: 'Contact', kind: 'text', value: '', note: 'WhatsApp button fallback when a doctor, clinic or lab has no WhatsApp number. Digits with country code, e.g. 919876543210. Leave empty to hide.' },
  { slug: 'url-app-store', label: 'App Store link', group: 'Links', kind: 'url', value: 'https://apps.apple.com', note: 'Homepage app download band.' },
  { slug: 'url-play-store', label: 'Google Play link', group: 'Links', kind: 'url', value: 'https://play.google.com', note: 'Homepage app download band.' },
  { slug: 'image-home-hero', label: 'Homepage hero photo', group: 'Images', kind: 'image', value: '/images/home-hero.jpg', note: 'Doctor portrait in the homepage hero. A full URL, or a path on the website.' },
  { slug: 'image-lab-tests-hero', label: 'Lab tests hero photo', group: 'Images', kind: 'image', value: '/images/lab-tests-hero.jpg', note: 'Test-tube photo on /lab-tests.' },
  { slug: 'image-clinic-interior', label: 'Clinic interior (default)', group: 'Images', kind: 'image', value: '/images/clinic-interior.jpg', note: 'Second photo on a clinic profile when the clinic has no gallery of its own.' },
];

/** Initial ordering that used to be hardcoded on the website; editable afterwards on each record. */
export const POPULAR_CITIES = ['bangalore', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'pune', 'kolkata', 'ahmedabad', 'gurgaon', 'noida', 'jaipur', 'lucknow'];
export const HOME_SPECIALTIES = ['general-physician', 'dermatologist', 'gynecologist', 'pediatrician', 'orthopedist', 'dentist', 'cardiologist', 'psychiatrist', 'ent-specialist', 'gastroenterologist', 'ophthalmologist', 'neurologist'];
/** Homepage "Popular Consultations" chips. Chest Pain stays a fixed emergency button next to them. */
export const POPULAR_CONDITIONS = ['cough-and-cold', 'acne', 'depression-and-anxiety', 'stomach-pain', 'womens-health'];
