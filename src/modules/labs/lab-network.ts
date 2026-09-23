import { DEFAULT_PINCODE, distanceKm, locate, type Place } from '../../lib/geo.js';
import { LabModel, type Lab } from '../../models/lab.model.js';
import { OrderModel } from '../../models/order.model.js';

export type CollectionMode = 'home' | 'lab';
type LabDoc = Lab & { _id: unknown };

/** Home visits start early for fasting samples; walk-in counters keep lab hours. */
const HOME_WINDOWS = [
  { label: '06:00 – 07:00 AM', hour: 6 },
  { label: '07:00 – 08:00 AM', hour: 7 },
  { label: '08:00 – 09:00 AM', hour: 8 },
  { label: '09:00 – 10:00 AM', hour: 9 },
  { label: '10:00 – 11:00 AM', hour: 10 },
  { label: '04:00 – 05:00 PM', hour: 16 },
  { label: '05:00 – 06:00 PM', hour: 17 },
];
const VISIT_WINDOWS = [
  { label: '07:00 – 08:00 AM', hour: 7 },
  { label: '08:00 – 09:00 AM', hour: 8 },
  { label: '09:00 – 10:00 AM', hour: 9 },
  { label: '10:00 – 11:00 AM', hour: 10 },
  { label: '11:00 AM – 12:00 PM', hour: 11 },
  { label: '04:00 – 05:00 PM', hour: 16 },
  { label: '05:00 – 06:00 PM', hour: 17 },
  { label: '06:00 – 07:00 PM', hour: 18 },
];
export const windowsFor = (mode: CollectionMode) => (mode === 'home' ? HOME_WINDOWS : VISIT_WINDOWS);
export const COLLECTION_WINDOWS = HOME_WINDOWS.map((w) => w.label);

/** Walk-in bookings per window at a lab counter. */
const WALK_IN_CAPACITY = 12;
/** Orders placed before labs existed were processed here. */
export const DEFAULT_LAB = 'curxx-diagnostics-koramangala';

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const loadLabs = (city = 'bangalore') => LabModel.find({ city }).lean<LabDoc[]>();

/** The patient's location from a pincode, falling back to our default neighbourhood. */
export const origin = (pincode?: string): Place => (pincode ? locate(pincode) : null) ?? locate(DEFAULT_PINCODE)!;

/** How well a lab suits a patient at `place` who wants `testSlugs`. */
export function fit(lab: LabDoc, place: Place, testSlugs: string[] = []) {
  const km = distanceKm(place, lab.geo as { lat: number; lng: number });
  const missingTests = testSlugs.filter((s) => !lab.tests.includes(s));
  return {
    distanceKm: km,
    offersAll: missingTests.length === 0,
    missingTests,
    canCollect: Boolean(lab.homeCollection) && km <= (lab.collectionRadiusKm ?? 0),
    canVisit: Boolean(lab.walkIn),
  };
}

/** Labs that can take this booking, nearest first. */
export function eligibleLabs(labs: LabDoc[], place: Place, testSlugs: string[], mode: CollectionMode) {
  return labs
    .map((lab) => ({ lab, ...fit(lab, place, testSlugs) }))
    .filter((l) => l.offersAll && (mode === 'home' ? l.canCollect : l.canVisit))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** What an order remembers about its lab, so later edits to the lab don't rewrite history. */
export const labSnapshot = (lab: LabDoc) => ({
  slug: lab.slug,
  name: lab.name,
  area: lab.area,
  address: lab.address,
  phone: lab.phone,
  lat: lab.geo!.lat,
  lng: lab.geo!.lng,
  pathologist: lab.pathologist?.name ? `${lab.pathologist.name}, ${lab.pathologist.qualification}` : '',
});

/** Collection start time for a booked day + window. */
export function collectionStart(date: string, windowLabel: string, mode: CollectionMode) {
  const slot = windowsFor(mode).find((w) => w.label === windowLabel);
  if (!slot) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, slot.hour, 0, 0, 0);
}

/** Next five days of windows at one lab, with live remaining capacity. */
export async function collectionAvailability({ lab, mode, now = new Date() }: { lab: LabDoc; mode: CollectionMode; now?: Date }) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);

  const atThisLab = lab.slug === DEFAULT_LAB ? { $or: [{ 'lab.slug': lab.slug }, { 'lab.slug': { $exists: false } }] } : { 'lab.slug': lab.slug };
  const booked = await OrderModel.aggregate<{ _id: { day: string; window: string }; count: number }>([
    {
      $match: {
        kind: 'lab',
        status: { $ne: 'cancelled' },
        'pickup.date': { $gte: start, $lt: end },
        collectionMode: mode === 'home' ? { $ne: 'lab' } : 'lab',
        ...atThisLab,
      },
    },
    { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$pickup.date', timezone: '+05:30' } }, window: '$pickup.window' }, count: { $sum: 1 } } },
  ]);
  const taken = new Map(booked.map((b) => [`${b._id.day}|${b._id.window}`, b.count]));
  const capacity = mode === 'home' ? (lab.homeCollection ? lab.phlebotomists ?? 0 : 0) : lab.walkIn ? WALK_IN_CAPACITY : 0;
  // A phlebotomist needs 90 minutes to reach you; a lab counter only needs you to get there.
  const noticeMs = (mode === 'home' ? 90 : 30) * 60 * 1000;

  return Array.from({ length: 5 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = dayKey(date);
    const sunday = date.getDay() === 0;
    const closedAllDay = sunday && lab.sundayHours === 'Closed';
    return {
      date: key,
      closed: closedAllDay,
      windows: windowsFor(mode).map(({ label, hour }) => {
        const startsAt = new Date(date);
        startsAt.setHours(hour, 0, 0, 0);
        // Sundays are half days.
        const shut = closedAllDay || (sunday && hour >= 12);
        const tooSoon = startsAt.getTime() - now.getTime() < noticeMs;
        const remaining = shut || tooSoon ? 0 : Math.max(0, capacity - (taken.get(`${key}|${label}`) ?? 0));
        return { window: label, remaining, available: remaining > 0 };
      }),
    };
  });
}
