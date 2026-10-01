import { bookingModeOf } from './booking-mode.js';

/**
 * A doctor as every public list and profile sends it (the website's one doctor card reads this shape): the
 * id as a string, no internal dates or slot bookkeeping, plus whether they offer video and how they book.
 */
export const doctorDto = ({
  _id,
  createdAt: _c,
  updatedAt: _u,
  schedule,
  slotsThrough: _t,
  ...d
}: Record<string, any>) => ({
  id: String(_id),
  ...d,
  offersVideo: schedule?.video !== 'none',
  /** instant (book & pay) · request (send a request, the clinic confirms) · none (Call / Visit). */
  booking: bookingModeOf({ source: d.source, bookable: d.bookable, schedule }),
});
