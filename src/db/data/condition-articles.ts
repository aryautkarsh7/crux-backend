/** A health article per condition, written from the condition data so the blog and condition pages agree. */
import { CONDITIONS } from './conditions.js';
import { ARTICLE_COVERS } from './images.js';
import { SPECIALTY_BY_SLUG } from './specialties.js';

export const EXTRA_ARTICLE_CATEGORIES = [
  { slug: 'general-health', name: 'General Health' },
  { slug: 'bones-joints', name: 'Bones & Joints' },
  { slug: 'digestive-health', name: 'Digestive Health' },
  { slug: 'child-health', name: 'Child Health' },
  { slug: 'lungs-allergy', name: 'Lungs & Allergy' },
  { slug: 'kidney-urology', name: 'Kidney & Urology' },
  { slug: 'eye-ear', name: 'Eye, Ear & Throat' },
  { slug: 'dental', name: 'Dental Health' },
  { slug: 'mens-health', name: 'Men’s Health' },
  { slug: 'surgery', name: 'Surgery' },
];

const CATEGORY_FOR: Record<string, string> = {
  'general-physician': 'general-health', dermatologist: 'skin-hair', psychiatrist: 'mental-health', gastroenterologist: 'digestive-health', hepatologist: 'digestive-health',
  gynecologist: 'womens-health', 'fertility-infertility-specialist': 'womens-health', cardiologist: 'heart-health', endocrinologist: 'diabetes', orthopedist: 'bones-joints',
  rheumatologist: 'bones-joints', neurologist: 'general-health', urologist: 'kidney-urology', 'general-surgeon': 'surgery', dentist: 'dental', pulmonologist: 'lungs-allergy',
  'ent-specialist': 'eye-ear', ophthalmologist: 'eye-ear', sexologist: 'mens-health', dietician: 'nutrition', pediatrician: 'child-health',
};

const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const list = (xs: string[]) => xs.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join('; ');

export function buildConditionArticles() {
  return CONDITIONS.map((c, i) => {
    const sp = SPECIALTY_BY_SLUG.get(c.specialty)!;
    const category = CATEGORY_FOR[c.specialty] ?? 'general-health';
    return {
      slug: `${c.slug}-symptoms-causes-treatment`,
      featured: i < 3,
      category,
      readMinutes: 5,
      coverUrl: ARTICLE_COVERS[i % ARTICLE_COVERS.length]!,
      publishedAt: days(3 + i * 2),
      title: `${c.name}: Symptoms, Causes, Treatment & When to See a ${sp.name}`,
      excerpt: c.summary,
      authorSpecialty: c.specialty,
      sections: [
        { heading: `What is ${c.name.toLowerCase()}?`, body: c.summary },
        { heading: 'Common symptoms', body: `People with ${c.name.toLowerCase()} most often notice: ${list(c.symptoms)}. Symptoms vary from person to person, so a doctor’s examination matters more than any checklist.` },
        { heading: 'What causes it', body: `The usual causes and risk factors are ${list(c.causes)}. Knowing the likely cause guides both treatment and prevention.` },
        { heading: 'How it is treated', body: `A ${sp.name.toLowerCase()} will usually recommend ${list(c.treatments)}. Treatment is tailored to your age, other conditions and how long symptoms have lasted.` },
        { heading: 'What you can do at home', body: `Alongside medical advice: ${list(c.selfCare)}.` },
        { heading: `When to see a ${sp.name.toLowerCase()}`, body: `Book a consultation if you have ${list(c.whenToSee)}. On Curxx you can video consult a verified ${sp.name.toLowerCase()} within minutes or book a clinic visit near you.` },
      ],
      keyTakeaways: [c.summary.split('. ')[0]!.replace(/\.$/, '') + '.', `See a ${sp.name.toLowerCase()} for: ${c.whenToSee[0]!.toLowerCase()}.`, c.selfCare[0]!],
      tags: [c.name.toLowerCase(), sp.name.toLowerCase(), c.slug],
      condition: c.slug,
    };
  });
}
