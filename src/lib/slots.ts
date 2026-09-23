import { Types } from 'mongoose';

/**
 * A slot can be offered to a patient when it is open, or when someone's hold on it
 * has lapsed. Holds are never deleted — they simply stop counting after expiry.
 */
export function bookableSlot(now = new Date()) {
  return { $or: [{ status: 'open' }, { status: 'held', holdExpiresAt: { $lt: now } }] };
}

/** Bookable for this user: open, lapsed, or currently held by them. */
export function claimableBy(userId: string, now = new Date()) {
  return {
    $or: [
      { status: 'open' },
      { status: 'held', holdExpiresAt: { $lt: now } },
      { status: 'held', heldBy: new Types.ObjectId(userId) },
    ],
  };
}
