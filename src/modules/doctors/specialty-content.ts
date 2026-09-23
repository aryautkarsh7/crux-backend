import { CITIES, type City } from '../../db/data/cities.js';
import { CONDITIONS } from '../../db/data/conditions.js';
import { SURGERIES } from '../../db/data/surgeries.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { SpecialtyModel, type Specialty } from '../../models/specialty.model.js';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * Everything a specialty listing needs beyond the doctor cards: an intro, stats, conditions,
 * FAQs and internal links. Built from live counts so the copy never contradicts the page.
 */
export async function specialtyContent(specialty: Specialty, city: City, areaSlug?: string) {
  const locality = areaSlug ? city.localities.find((l) => l.slug === areaSlug.toLowerCase()) : undefined;
  const place = locality ? `${locality.name}, ${city.name}` : city.name;
  const match: Record<string, unknown> = { city: city.slug, specialty: specialty.slug };
  if (locality) match.area = locality.name;

  const [statsRow, areaRows, cityRows, top, facilities, relatedDocs] = await Promise.all([
    DoctorModel.aggregate<{ _id: null; count: number; minFee: number; maxFee: number; avgFee: number; minVideo: number; video: number; free: number; rating: number; experience: number; reviews: number; female: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          minFee: { $min: '$fee' },
          maxFee: { $max: '$fee' },
          avgFee: { $avg: '$fee' },
          minVideo: { $min: { $cond: [{ $ne: ['$schedule.video', 'none'] }, '$videoFee', null] } },
          video: { $sum: { $cond: [{ $ne: ['$schedule.video', 'none'] }, 1, 0] } },
          free: { $sum: { $cond: ['$freeVideo', 1, 0] } },
          rating: { $avg: '$rating' },
          experience: { $avg: '$experienceYears' },
          reviews: { $sum: '$reviewCount' },
          female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
        },
      },
    ]),
    DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: { city: city.slug, specialty: specialty.slug } }, { $group: { _id: '$area', count: { $sum: 1 } } }]),
    DoctorModel.aggregate<{ _id: string; count: number }>([{ $match: { specialty: specialty.slug } }, { $group: { _id: '$city', count: { $sum: 1 } } }]),
    DoctorModel.find(match, { slug: 1, name: 1, experienceYears: 1, rating: 1, reviewCount: 1, area: 1, clinicName: 1, fee: 1 }).sort({ rating: -1, reviewCount: -1 }).limit(5).lean(),
    FacilityModel.find({ city: city.slug, specialties: specialty.slug }, { slug: 1, name: 1, area: 1, type: 1 }).sort({ rating: -1 }).limit(6).lean(),
    SpecialtyModel.find({ slug: { $in: specialty.related ?? [] } }, { slug: 1, name: 1, plural: 1, icon: 1 }).lean(),
  ]);

  const stats = statsRow[0];
  const count = stats?.count ?? 0;
  const byArea = new Map(areaRows.map((a) => [a._id, a.count]));
  const byCity = new Map(cityRows.map((c) => [c._id, c.count]));
  const name = specialty.name;
  const plural = specialty.plural;
  const conditions = specialty.conditions ?? [];
  const localities = city.localities
    .map((l) => ({ slug: l.slug, name: l.name, count: byArea.get(l.name) ?? 0 }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const topAreas = localities.slice(0, 4).map((l) => l.name);
  const offersVideo = specialty.video !== false && (stats?.video ?? 0) > 0;

  const intro = count
    ? `Book an appointment with ${count} verified ${count === 1 ? name : plural} in ${place}. ${specialty.description ? `${specialty.description}.` : ''} Compare fees, experience and patient reviews, then book a clinic visit${offersVideo ? ' or an online video consultation' : ''} in under a minute.`
    : `We are adding ${plural} in ${place}. ${offersVideo ? `Meanwhile you can consult a ${name} online by video from anywhere in India.` : `See ${plural} in nearby areas below.`}`;

  const about = [
    `A ${name} ${specialty.description ? `is one of the ${lower(specialty.description)}` : 'is a specialist doctor'}. Patients in ${place} commonly see a ${name} for ${list(conditions.slice(0, 4).map(lower))}.`,
    count
      ? `Consultation fees for ${plural} in ${place} range from ${inr(stats!.minFee)} to ${inr(stats!.maxFee)}, with an average of about ${inr(stats!.avgFee)}. Doctors listed here have an average of ${Math.round(stats!.experience)} years of experience and a ${(Math.round(stats!.rating * 10) / 10).toFixed(1)}★ average rating from ${stats!.reviews.toLocaleString('en-IN')} verified patient reviews.`
      : '',
    topAreas.length && !locality ? `You will find ${plural} across ${city.name}, including ${list(topAreas)}.` : '',
  ].filter(Boolean);

  const faqs: { question: string; answer: string }[] = [];
  if (count) {
    faqs.push({
      question: `How much does a ${name} consultation cost in ${place}?`,
      answer: `A clinic consultation with a ${name} in ${place} costs between ${inr(stats!.minFee)} and ${inr(stats!.maxFee)} on Curxx.${offersVideo && stats!.minVideo ? ` Online video consultations start from ${inr(stats!.minVideo)}.` : ''} The exact fee is shown on each doctor’s profile before you book, with no hidden charges.`,
    });
    if (top.length) {
      faqs.push({
        question: `Who are the best ${plural} in ${place}?`,
        answer: `Top-rated ${plural} in ${place} on Curxx include ${list(top.slice(0, 3).map((d) => `${d.name} (${d.experienceYears} yrs, ${d.rating.toFixed(1)}★)`))}. Ratings are based on verified patient reviews, and you can sort the list by rating, experience or fee.`,
      });
    }
  }
  faqs.push({
    question: `When should I see a ${name}?`,
    answer: `${(specialty.whenToSee ?? []).length ? `See a ${name} if you have: ${(specialty.whenToSee ?? []).map(lower).join('; ')}.` : `See a ${name} when your family doctor refers you or symptoms persist.`} If symptoms are severe or sudden, go to the nearest emergency department.`,
  });
  faqs.push({
    question: `What conditions does a ${name} treat?`,
    answer: `${plural} treat ${list(conditions.map(lower))}. Many also offer follow-up care and second opinions on reports.`,
  });
  if (offersVideo) {
    faqs.push({
      question: `Can I consult a ${name} online?`,
      answer: `Yes. ${count ? `${stats!.video} of the ${plural} in ${place} offer secure video consultations${stats!.free ? `, and ${stats!.free} offer a free first video consult` : ''}.` : `${plural} across India offer secure video consultations on Curxx.`} You get a digital prescription after the call, valid at any pharmacy.`,
    });
  } else {
    faqs.push({
      question: `Can I consult a ${name} online?`,
      answer: `${plural} usually need to examine you in person, so Curxx lists clinic visits for this specialty. Book a time slot and pay at the clinic or online.`,
    });
  }
  faqs.push({
    question: `How do I book an appointment with a ${name} in ${place}?`,
    answer: `Choose a ${name} from the list, pick a date and time on their profile, and confirm with your mobile number. You get an instant confirmation by SMS and can reschedule or cancel from My Appointments.`,
  });

  const otherCities = CITIES.filter((c) => c.slug !== city.slug && (byCity.get(c.slug) ?? 0) > 0)
    .map((c) => ({ slug: c.slug, name: c.name, count: byCity.get(c.slug) ?? 0 }));

  return {
    specialty: {
      slug: specialty.slug,
      name,
      plural,
      icon: specialty.icon,
      category: specialty.category,
      description: specialty.description,
      video: specialty.video !== false,
      subSpecialties: specialty.subSpecialties ?? [],
    },
    city: { slug: city.slug, name: city.name, state: city.state },
    locality: locality ? { slug: locality.slug, name: locality.name, pincode: locality.pincode } : null,
    place,
    stats: {
      doctors: count,
      minFee: stats?.minFee ?? specialty.fromPrice,
      maxFee: stats?.maxFee ?? specialty.fromPrice,
      minVideoFee: stats?.minVideo ?? specialty.videoFrom ?? null,
      video: stats?.video ?? 0,
      free: stats?.free ?? 0,
      female: stats?.female ?? 0,
      rating: stats ? Math.round(stats.rating * 10) / 10 : null,
      experience: stats ? Math.round(stats.experience) : null,
      reviews: stats?.reviews ?? 0,
    },
    intro,
    about,
    conditions,
    whenToSee: specialty.whenToSee ?? [],
    faqs,
    topDoctors: top.map((d) => ({ slug: d.slug, name: d.name, experienceYears: d.experienceYears, rating: d.rating, reviewCount: d.reviewCount, area: d.area, fee: d.fee })),
    facilities: facilities.map((f) => ({ slug: f.slug, name: f.name, area: f.area, type: f.type })),
    localities,
    otherCities,
    related: relatedDocs.map((r) => ({ slug: r.slug, name: r.name, plural: r.plural, icon: r.icon })),
    relatedConditions: CONDITIONS.filter((c) => c.specialty === specialty.slug).map((c) => ({ slug: c.slug, name: c.name })),
    surgeries: SURGERIES.filter((s) => s.specialty === specialty.slug).map((s) => ({ slug: s.slug, name: s.name })),
  };
}
