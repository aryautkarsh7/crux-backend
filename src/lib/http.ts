import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/** Public catalogue data changes rarely: let the CDN and browser cache it briefly. */
export const CATALOGUE_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
};

export const paged = <T>(items: T[], total: number, page: number, limit: number) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});

/** Mongo lean doc → API shape: `_id` becomes `id`, timestamps dropped unless asked for. */
export function toDto<T extends { _id: unknown }>(doc: T, keepDates = false) {
  const { _id, ...rest } = doc as T & { createdAt?: Date; updatedAt?: Date };
  if (!keepDates) {
    delete (rest as { createdAt?: Date }).createdAt;
    delete (rest as { updatedAt?: Date }).updatedAt;
  }
  return { id: String(_id), ...rest };
}

/** Human-readable reference such as CRX-3F9A21BC. */
export const reference = (prefix: string) => `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;

/** Escapes user input for use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
