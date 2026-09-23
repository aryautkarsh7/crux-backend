/** Patient reviews generated per doctor from specialty-appropriate templates. */

const AUTHORS = ['Karthik S.', 'Priyanka R.', 'Anil M.', 'Sneha K.', 'Rohit V.', 'Divya P.', 'Manoj B.', 'Aarti J.', 'Suresh N.', 'Meghana T.', 'Farhan A.', 'Lakshmi G.', 'Vinay H.', 'Neha D.', 'Ramesh C.', 'Pallavi S.', 'Abhishek T.', 'Kavitha M.', 'Imran K.', 'Swati L.'];

const GENERAL = [
  'Explained everything patiently and did not rush the consultation. The e-prescription arrived before I left the clinic.',
  'Very clear about what the tests were for and what to watch out for. Follow-up chat was genuinely useful.',
  'On time, thorough and kind. The clinic was clean and the whole visit took under 30 minutes.',
  'The video call quality was good and the doctor listened properly before suggesting anything.',
  'Didn’t push unnecessary tests or medicines. Felt like an honest opinion.',
];

const BY_SPECIALTY: Record<string, string[]> = {
  dermatologist: ['My acne finally cleared after years of trying random creams. The routine was simple and it worked in 8 weeks.', 'Pigmentation has visibly reduced. Doctor was realistic about timelines, which I appreciated.', 'Diagnosed a fungal infection two other doctors had missed. Cleared up within three weeks.'],
  'general-physician': ['Sorted out my recurring fever with the right tests instead of a blanket antibiotic.', 'Adjusted my BP and sugar medicines carefully and explained the side effects clearly.', 'Great family doctor — my parents are comfortable with her too.'],
  cardiologist: ['Reviewed my ECG and echo in detail and explained my blood pressure readings properly.', 'After my stent, the follow-up plan was very clear. I feel much more confident now.', 'Took my chest pain seriously and got the TMT done the same day.'],
  pediatrician: ['Wonderful with my toddler — calm, gentle and very reassuring for first-time parents.', 'Vaccination schedule was explained clearly and the clinic sends reminders.', 'Didn’t overprescribe for my son’s cold. Just the right advice.'],
  gynecologist: ['Supportive throughout my pregnancy and always answered my questions patiently.', 'Finally got a clear plan for my PCOS that looked at more than just weight.', 'Very respectful and made me comfortable discussing everything.'],
  orthopedist: ['My knee pain improved a lot with the physio plan instead of jumping to surgery.', 'Reviewed my MRI thoroughly and explained the options without pressure.', 'Back pain that bothered me for months is finally under control.'],
  psychiatrist: ['Felt heard for the first time. The therapy plan and medicines are really helping my anxiety.', 'Non-judgemental and practical. Sleep has improved within a few weeks.', 'Explained the medication timeline honestly, including side effects.'],
  'ent-specialist': ['Sinus problems I had for years were finally explained and treated properly.', 'Quick hearing test and a clear diagnosis. Very professional.', 'Vertigo episodes have stopped after the exercises and medicine.'],
  gastroenterologist: ['Acidity that had me reaching for antacids daily is now under control.', 'Explained my IBS triggers and gave a diet plan that actually works.', 'Thorough review of my liver reports with clear next steps.'],
  neurologist: ['My migraines went from weekly to once a month on the new plan.', 'Very detailed neurological exam and a clear explanation of my MRI.', 'Calm and patient with my father after his stroke — the rehab plan was excellent.'],
  ophthalmologist: ['Detailed eye exam and new glasses prescription — much clearer vision now.', 'Dry eye treatment worked quickly. Great advice about screen breaks.', 'Diabetic retinal screening was quick and well explained.'],
  dentist: ['Painless root canal — I was very nervous but it was completely fine.', 'Gentle cleaning and honest advice. No upselling of treatments.', 'Braces consultation was detailed with a clear cost and timeline.'],
};

const VISITED_FOR: Record<string, string[]> = {
  dermatologist: ['Acne', 'Pigmentation', 'Hair fall', 'Skin allergy'],
  'general-physician': ['Fever', 'Diabetes review', 'Cough & cold', 'Health check'],
  cardiologist: ['Chest pain', 'BP review', 'Post-stent follow-up', 'Cholesterol'],
  pediatrician: ['Child fever', 'Vaccination', 'Growth check'],
  gynecologist: ['Pregnancy care', 'PCOS', 'Period problems'],
  orthopedist: ['Knee pain', 'Back pain', 'Sports injury'],
  psychiatrist: ['Anxiety', 'Sleep problems', 'Depression'],
  'ent-specialist': ['Sinusitis', 'Ear pain', 'Vertigo'],
  gastroenterologist: ['Acidity', 'IBS', 'Liver health'],
  neurologist: ['Migraine', 'Nerve pain', 'Stroke follow-up'],
  ophthalmologist: ['Vision check', 'Dry eyes', 'Diabetic eye screening'],
  dentist: ['Tooth pain', 'Cleaning', 'Braces'],
};

const TAGS = ['Explains clearly', 'On time', 'Friendly', 'Thorough', 'Good follow-up', 'Value for money'];

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const hashString = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);

export function generateReviews(doctors: { slug: string; specialty: string }[]) {
  const now = Date.now();
  return doctors.flatMap((doctor) => {
    const random = rng(hashString(doctor.slug));
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!;
    const pool = [...(BY_SPECIALTY[doctor.specialty] ?? []), ...GENERAL];
    const count = 6 + Math.floor(random() * 5);
    return Array.from({ length: count }, (_, i) => {
      const roll = random();
      const rating = roll < 0.72 ? 5 : roll < 0.94 ? 4 : 3;
      const createdAt = new Date(now - Math.floor((i * 9 + random() * 8) * 24 * 60 * 60 * 1000));
      return {
        doctorSlug: doctor.slug,
        author: pick(AUTHORS),
        rating,
        text: pool[(i + Math.floor(random() * pool.length)) % pool.length]!,
        mode: random() < 0.55 ? 'clinic' : 'video',
        tags: [pick(TAGS), pick(TAGS)].filter((v, k, a) => a.indexOf(v) === k),
        helpful: Math.floor(random() * 60),
        verified: true,
        visitedFor: pick(VISITED_FOR[doctor.specialty] ?? ['Consultation']),
        createdAt,
        updatedAt: createdAt,
      };
    });
  });
}
