import { env } from '../config/env.js';

/**
 * How a patient books a doctor:
 * - instant: pick an open slot and pay; confirmed straight away (Curxx's own doctors).
 * - request: pick a time and send a request, no payment; the clinic confirms (imported doctors, when
 *   IMPORTED_BOOKABLE is on and they have weekly hours).
 * - none: Call / Visit only.
 */
export type BookingMode = 'instant' | 'request' | 'none';

type Session = { start?: string | null; end?: string | null };
export type Bookable = {
  source?: string | null;
  /** The admin panel's "Bookable" switch; false always means Call / Visit only. */
  bookable?: boolean | null;
  schedule?: {
    days?: number[] | null;
    sessions?: Session[] | null;
    perDay?: { day?: number | null; sessions?: Session[] | null }[] | null;
  } | null;
};

/** Days of request times offered ahead of today. */
export const REQUEST_DAYS_AHEAD = 7;

/** Real weekly hours: at least one day with at least one session. Never invent hours for a real doctor. */
export function hasWeeklyHours(schedule: Bookable['schedule']) {
  if (!schedule?.days?.length) return false;
  return (
    Boolean(schedule.sessions?.length) || Boolean(schedule.perDay?.some((p) => p.sessions?.length))
  );
}

export function bookingModeOf(doctor: Bookable): BookingMode {
  if (doctor.bookable === false) return 'none';
  if (doctor.source)
    return env.IMPORTED_BOOKABLE && hasWeeklyHours(doctor.schedule) ? 'request' : 'none';
  return 'instant';
}

/**
 * Request times aren't stored until someone picks one, so their ids name the doctor and the minute:
 * req_<doctor-slug>_<minutes since epoch>. Slugs never contain "_".
 */
export const requestSlotId = (slug: string, startsAt: Date) =>
  `req_${slug}_${Math.round(startsAt.getTime() / 60_000)}`;

export function parseRequestSlotId(id: string) {
  const m = /^req_([a-z0-9-]{1,120})_(\d{7,9})$/.exec(id);
  return m ? { slug: m[1]!, startsAt: new Date(Number(m[2]) * 60_000) } : null;
}
