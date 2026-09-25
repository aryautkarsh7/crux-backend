import { DoctorModel } from '../models/doctor.model.js';
import { SlotModel } from '../models/slot.model.js';

/** Days of slots kept ahead of today; online 24x7 doctors keep a shorter window (they have many slots). */
const DAYS_AHEAD = 7;
const INSTANT_DAYS_AHEAD = 2;
/** The first few video slots of a free-consult doctor's day are free. */
const FREE_VIDEO_PER_DAY = 2;

type Session = { start?: string | null; end?: string | null };
export type SlotSource = {
  _id: unknown;
  slug: string;
  fee: number;
  videoFee: number;
  freeVideo?: boolean | null;
  instant?: boolean | null;
  slotsThrough?: Date | null;
  schedule?: { days?: number[] | null; sessions?: Session[] | null; perDay?: { day?: number | null; sessions?: Session[] | null }[] | null; step?: number | null; video?: string | null } | null;
};

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const minutesOf = (hhmm?: string | null) => {
  const [h, m] = String(hhmm ?? '0:0').split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** The slots a doctor offers on one day, per their weekly schedule. */
export function slotsForDay(doctor: SlotSource, day: Date, now = new Date()) {
  const schedule = doctor.schedule ?? {};
  const days = schedule.days?.length ? schedule.days : [1, 2, 3, 4, 5, 6];
  if (!days.includes(day.getDay())) return [];
  const step = schedule.step || 30;
  const videoMode = schedule.video ?? 'mixed';
  // A day can have its own hours (perDay); otherwise the common sessions apply.
  const own = schedule.perDay?.find((p) => p.day === day.getDay())?.sessions;
  const sessions = own?.length ? own : schedule.sessions?.length ? schedule.sessions : [{ start: '10:00', end: '13:30' }, { start: '17:00', end: '20:30' }];
  const out: { doctor: unknown; doctorSlug: string; startsAt: Date; mode: 'clinic' | 'video'; fee: number; free: boolean; status: 'open' }[] = [];
  let index = 0;
  let freeLeft = doctor.freeVideo ? FREE_VIDEO_PER_DAY : 0;
  for (const session of sessions) {
    const end = minutesOf(session.end);
    for (let t = minutesOf(session.start); t + step <= end; t += step, index += 1) {
      const startsAt = new Date(day);
      startsAt.setHours(0, t, 0, 0);
      if (startsAt <= now) continue;
      const video = videoMode === 'all' || (videoMode === 'mixed' && index % 3 === 1);
      const free = video && freeLeft > 0;
      if (free) freeLeft -= 1;
      out.push({ doctor: doctor._id, doctorSlug: doctor.slug, startsAt, mode: video ? 'video' : 'clinic', fee: free ? 0 : video ? doctor.videoFee : doctor.fee, free, status: 'open' });
    }
  }
  return out;
}

const isDuplicateOnly = (error: unknown) => {
  const e = error as { code?: number; writeErrors?: { code?: number; err?: { code?: number } }[] };
  if (e.code === 11000 && !e.writeErrors) return true;
  return Array.isArray(e.writeErrors) && e.writeErrors.every((w) => (w.code ?? w.err?.code) === 11000);
};

/**
 * Makes sure each doctor has slots for the coming week. Slots are created lazily (only for doctors
 * someone is looking at) so thousands of doctors don't mean hundreds of thousands of idle slots.
 */
export async function ensureSlots(doctors: SlotSource[], now = new Date(), days?: number) {
  const today = dayStart(now);
  // A query about today only needs today's slots; later days follow when someone opens a profile.
  const aheadFor = (d: SlotSource) => Math.min(days ?? Infinity, d.instant ? INSTANT_DAYS_AHEAD : DAYS_AHEAD);
  const stale = doctors.filter((d) => !d.slotsThrough || dayStart(new Date(d.slotsThrough)) < addDays(today, aheadFor(d) - 1));
  if (!stale.length) return;

  const docs = [];
  const through = new Map<string, Date>();
  for (const doctor of stale) {
    const ahead = aheadFor(doctor);
    const last = addDays(today, ahead - 1);
    const from = doctor.slotsThrough && dayStart(new Date(doctor.slotsThrough)) >= today ? addDays(dayStart(new Date(doctor.slotsThrough)), 1) : today;
    for (let day = from; day <= last; day = addDays(day, 1)) docs.push(...slotsForDay(doctor, day, now));
    through.set(String(doctor._id), last);
  }
  if (docs.length) {
    try {
      await SlotModel.insertMany(docs, { ordered: false });
    } catch (error) {
      // Another request generated some of these at the same moment — the unique index kept one copy.
      if (!isDuplicateOnly(error)) throw error;
    }
  }
  await DoctorModel.bulkWrite(stale.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { slotsThrough: through.get(String(d._id)) } } } })) as never);
  // Keep the in-memory docs in step so callers can reuse them.
  for (const d of stale) d.slotsThrough = through.get(String(d._id)) ?? null;
}

/** Drops open slots that are already in the past, so the collection doesn't grow forever. */
export async function pruneSlots(now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const { deletedCount } = await SlotModel.deleteMany({ status: 'open', startsAt: { $lt: cutoff } });
  return deletedCount ?? 0;
}
