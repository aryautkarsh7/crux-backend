import type { City } from '../../db/data/cities.js';
import { env } from '../../config/env.js';
import {
  cities as allCities,
  conditions as allConditions,
  surgeries as allSurgeries,
} from '../../lib/catalogue-store.js';
import { SpecialtyModel, type Specialty } from '../../models/specialty.model.js';
import { Doctors, Facilities } from '../doctar/store.js';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const STATS_FIELDS = {
  fee: 1,
  videoFee: 1,
  schedule: 1,
  freeVideo: 1,
  rating: 1,
  reviewCount: 1,
  experienceYears: 1,
  gender: 1,
  bookable: 1,
  source: 1,
  feeVerified: 1,
} as const;

/** Fee, video, rating and experience figures for a set of doctors (averages skip missing values, like $avg). */
function summarise(docs: Record<string, any>[]) {
  const nums = (pick: (d: Record<string, any>) => unknown) =>
    docs.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const min = (xs: number[]) => (xs.length ? xs.reduce((a, b) => Math.min(a, b)) : null);
  const max = (xs: number[]) => (xs.length ? xs.reduce((a, b) => Math.max(a, b)) : null);
  const fees = nums((d) => d.fee);
  const video = new Set(docs.filter((d) => d.schedule?.video !== 'none'));
  const count = (test: (d: Record<string, any>) => boolean) => docs.filter(test).length;
  return {
    _id: null,
    count: docs.length,
    minFee: min(fees) as number,
    maxFee: max(fees) as number,
    avgFee: avg(fees) as number,
    minVideo: min(nums((d) => (video.has(d) ? d.videoFee : null))) as number,
    video: video.size,
    free: count((d) => Boolean(d.freeVideo)),
    // Doctors without reviews (e.g. Doctar doctors) have no rating yet.
    rating: avg(nums((d) => (d.reviewCount > 0 ? d.rating : null))) as number,
    experience: avg(nums((d) => d.experienceYears)) as number,
    reviews: nums((d) => d.reviewCount).reduce((a, b) => a + b, 0),
    female: count((d) => d.gender === 'female'),
    // Bookable online (lib/booking-mode.ts): imported doctors only when IMPORTED_BOOKABLE is on.
    bookable: count((d) => d.bookable !== false && (env.IMPORTED_BOOKABLE || !d.source)),
    approxFees: count((d) => d.feeVerified === false),
  };
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Everything a specialty listing needs beyond the doctor cards: an intro, stats, conditions,
 * FAQs and internal links. Built from live counts so the copy never contradicts the page.
 */
export async function specialtyContent(specialty: Specialty, city: City, areaSlug?: string) {
  const locality = areaSlug
    ? city.localities.find((l) => l.slug === areaSlug.toLowerCase())
    : undefined;
  const place = locality ? `${locality.name}, ${city.name}` : city.name;
  const match: Record<string, unknown> = { city: city.slug, specialty: specialty.slug };
  if (locality) match.area = locality.name;

  const [statsRow, areaRows, cityRows, top, facilities, relatedDocs] = await Promise.all([
    Doctors.find(match, { projection: STATS_FIELDS }).then((docs) =>
      docs.length ? [summarise(docs)] : [],
    ),
    Doctors.countBy('area', { city: city.slug, specialty: specialty.slug }),
    Doctors.countBy('city', { specialty: specialty.slug }),
    Doctors.find(
      { ...match, reviewCount: { $gt: 0 } },
      {
        projection: {
          slug: 1,
          name: 1,
          experienceYears: 1,
          rating: 1,
          reviewCount: 1,
          area: 1,
          clinicName: 1,
          fee: 1,
          feeVerified: 1,
        },
        sort: { rating: -1, reviewCount: -1, slug: 1 },
        limit: 5,
      },
    ),
    Facilities.find(
      { city: city.slug, specialties: specialty.slug },
      {
        projection: { slug: 1, name: 1, area: 1, type: 1 },
        sort: { rating: -1, rankScore: -1, slug: 1 },
        limit: 6,
      },
    ),
    SpecialtyModel.find(
      { slug: { $in: specialty.related ?? [] } },
      { slug: 1, name: 1, plural: 1, icon: 1 },
    ).lean(),
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
  // Online booking is only promised when someone here can be booked online; the rest are Call / Visit.
  const bookable = stats?.bookable ?? 0;

  const intro = count
    ? bookable
      ? `Book an appointment with ${count} ${count === 1 ? name : plural} in ${place}. ${specialty.description ? `${specialty.description}.` : ''} Compare fees, experience and patient reviews, then book a clinic visit${offersVideo ? ' or an online video consultation' : ''} in under a minute.`
      : `Find ${count} ${count === 1 ? name : plural} in ${place}. ${specialty.description ? `${specialty.description}.` : ''} Compare fees, experience and clinic timings, then call the clinic to book a visit.`
    : `We are adding ${plural} in ${place}. ${offersVideo ? `Meanwhile you can consult a ${name} online by video from anywhere in India.` : `See ${plural} in nearby areas below.`}`;

  const about = [
    `A ${name} ${specialty.description ? `is one of the ${lower(specialty.description)}` : 'is a specialist doctor'}. Patients in ${place} commonly see a ${name} for ${list(conditions.slice(0, 4).map(lower))}.`,
    count
      ? `Consultation fees for ${plural} in ${place} range from ${inr(stats!.minFee)} to ${inr(stats!.maxFee)}, with an average of about ${inr(stats!.avgFee)}. Doctors listed here have an average of ${Math.round(stats!.experience)} years of experience${stats!.reviews ? ` and a ${(Math.round(stats!.rating * 10) / 10).toFixed(1)}★ average rating from ${stats!.reviews.toLocaleString('en-IN')} patient reviews` : ''}.`
      : '',
    topAreas.length && !locality
      ? `You will find ${plural} across ${city.name}, including ${list(topAreas)}.`
      : '',
  ].filter(Boolean);

  const faqs: { question: string; answer: string }[] = [];
  if (count) {
    faqs.push({
      question: `How much does a ${name} consultation cost in ${place}?`,
      answer: `A clinic consultation with a ${name} in ${place} costs between ${inr(stats!.minFee)} and ${inr(stats!.maxFee)} on Curxx.${offersVideo && stats!.minVideo ? ` Online video consultations start from ${inr(stats!.minVideo)}.` : ''} ${stats!.approxFees ? ' Fees marked “approx.” are estimates: confirm them with the clinic.' : ' The exact fee is shown on each doctor’s profile before you book, with no hidden charges.'}`,
    });
    if (top.length) {
      faqs.push({
        question: `Who are the best ${plural} in ${place}?`,
        answer: `Top-rated ${plural} in ${place} on Curxx include ${list(top.slice(0, 3).map((d) => `${d.name} (${d.experienceYears} yrs, ${d.rating.toFixed(1)}★)`))}. Ratings are based on patient reviews, and you can sort the list by rating, experience or fee.`,
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
      answer: bookable
        ? `${plural} usually need to examine you in person, so Curxx lists clinic visits for this specialty. Book a time slot and pay at the clinic or online.`
        : `The ${plural} listed here see patients at their clinics. Call the clinic from a doctor’s profile to arrange a visit.`,
    });
  }
  if (count) {
    faqs.push({
      question: `How do I book an appointment with a ${name} in ${place}?`,
      answer: bookable
        ? `Choose a ${name} from the list, pick a date and time on their profile, and confirm with your mobile number. The booking shows in My Appointments, where you can reschedule or cancel it.${bookable < count ? ' Some doctors can only be booked by calling their clinic; their profile shows a Call button.' : ''}`
        : `Open a doctor’s profile and call the clinic to book a visit. Online booking isn’t available for these doctors yet.`,
    });
  }

  const otherCities = allCities()
    .filter((c) => c.slug !== city.slug && (byCity.get(c.slug) ?? 0) > 0)
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
    locality: locality
      ? { slug: locality.slug, name: locality.name, pincode: locality.pincode }
      : null,
    place,
    stats: {
      doctors: count,
      minFee: stats?.minFee ?? specialty.fromPrice,
      maxFee: stats?.maxFee ?? specialty.fromPrice,
      minVideoFee: stats?.minVideo ?? specialty.videoFrom ?? null,
      video: stats?.video ?? 0,
      free: stats?.free ?? 0,
      female: stats?.female ?? 0,
      rating: stats?.reviews ? Math.round(stats.rating * 10) / 10 : null,
      experience: stats ? Math.round(stats.experience) : null,
      reviews: stats?.reviews ?? 0,
    },
    intro,
    about,
    conditions,
    whenToSee: specialty.whenToSee ?? [],
    faqs,
    topDoctors: top.map((d) => ({
      slug: d.slug,
      name: d.name,
      experienceYears: d.experienceYears,
      rating: d.rating,
      reviewCount: d.reviewCount,
      area: d.area,
      fee: d.fee,
      feeVerified: d.feeVerified !== false,
    })),
    facilities: facilities.map((f) => ({ slug: f.slug, name: f.name, area: f.area, type: f.type })),
    localities,
    otherCities,
    related: relatedDocs.map((r) => ({
      slug: r.slug,
      name: r.name,
      plural: r.plural,
      icon: r.icon,
    })),
    relatedConditions: allConditions()
      .filter((c) => c.specialty === specialty.slug)
      .map((c) => ({ slug: c.slug, name: c.name })),
    surgeries: allSurgeries()
      .filter((s) => s.specialty === specialty.slug)
      .map((s) => ({ slug: s.slug, name: s.name })),
  };
}
