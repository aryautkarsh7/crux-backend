/**
 * Admin panel: the Doctar directory. Doctar's records are read-only here; what the team changes is saved
 * as an overlay in the Curxx DB (doctar_overlays) and applied to the website at once.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { escapeRegex } from '../../lib/http.js';
import { matches, sortBy } from '../../lib/query-match.js';
import {
  directoryEnabled,
  directoryIndex,
  directoryStatus,
  liveDirectory,
  refreshDirectory,
  refreshOverlays,
} from './directory.js';
import { DoctarOverlayModel } from './models.js';

type Doc = Record<string, any>;
const KIND = z.enum(['doctor', 'facility']);
/** The fields the admin can set on a Doctar record. */
const overlayBody = z
  .object({
    rank: z.coerce.number().int().min(0).max(9999),
    featured: z.boolean(),
    registrationVerified: z.boolean(),
    hidden: z.boolean(),
    bookable: z.boolean(),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+\s-]*$/, 'Phone: digits, spaces, + and - only'),
    whatsapp: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+\s-]*$/, 'WhatsApp: digits, spaces, + and - only'),
    photoUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || /^https:\/\//.test(v), 'Photo URL must start with https://'),
    note: z.string().trim().max(500),
  })
  .partial()
  .strict();

const LIST_FIELDS = [
  'doctarId',
  'slug',
  'name',
  'city',
  'area',
  'specialty',
  'category',
  'type',
  'clinicName',
  'qualification',
  'experienceYears',
  'fee',
  'doctarVerified',
  'phone',
];
const pick = (d: Doc) =>
  Object.fromEntries(LIST_FIELDS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));

export async function doctarAdminRoutes(app: FastifyInstance) {
  /** Whether the directory is on, when it was last built, how many records it holds, and why records were skipped. */
  app.get('/doctar/status', async () => ({
    enabled: directoryEnabled(),
    overlays: await DoctarOverlayModel.estimatedDocumentCount(),
    ...directoryStatus(),
  }));

  /** Rebuild from Doctar now (runs in the background; the website keeps the current copy until it's done). */
  app.post('/doctar/refresh', async () => {
    if (!directoryEnabled())
      throw badRequest('The Doctar directory is off (DOCTAR_DB_URL not set)', 'directory_off');
    void refreshDirectory().catch(() => {});
    return { started: true, ...directoryStatus() };
  });

  /** Doctar doctors or hospitals as read from Doctar (hidden ones included), with the team's overlay if any. */
  app.get('/doctar/:kind', async (request) => {
    const { kind } = z.object({ kind: z.enum(['doctors', 'facilities']) }).parse(request.params);
    const q = z
      .object({
        city: z.string().trim().max(40).optional(),
        specialty: z.string().trim().max(60).optional(),
        q: z.string().trim().max(80).optional(),
        overlay: z.enum(['any', 'only', 'hidden']).default('any'),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);
    const one = kind === 'doctors' ? 'doctor' : 'facility';
    const overlays = await DoctarOverlayModel.find({ kind: one }).lean();
    const byId = new Map(overlays.map((o) => [o.doctarId, o]));
    const filter: Doc = {};
    if (q.city) filter.city = q.city;
    if (q.specialty) filter[kind === 'doctors' ? 'specialty' : 'specialties'] = q.specialty;
    if (q.q) {
      const re = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [
        { name: re },
        { slug: re },
        { doctarId: q.q },
        { clinicName: re },
        { area: re },
      ];
    }
    const all: Doc[] = directoryIndex()?.[kind] ?? [];
    let rows = all.filter((d) => matches(d, filter));
    if (q.overlay === 'only') rows = rows.filter((d) => byId.has(String(d.doctarId)));
    if (q.overlay === 'hidden') rows = rows.filter((d) => byId.get(String(d.doctarId))?.hidden);
    rows = sortBy(rows, { name: 1, doctarId: 1 });
    const live = kind === 'doctors' ? liveDirectory().doctorBySlug : liveDirectory().facilityBySlug;
    const liveSlug = new Map([...live.values()].map((d) => [String(d.doctarId), d.slug]));
    const items = rows.slice((q.page - 1) * q.limit, q.page * q.limit).map((d) => ({
      ...pick(d),
      /** The URL the website uses (a clash with a Curxx record adds a suffix); empty when hidden. */
      liveSlug: liveSlug.get(String(d.doctarId)) ?? '',
      overlay: byId.get(String(d.doctarId)) ?? null,
    }));
    return {
      items,
      total: rows.length,
      page: q.page,
      limit: q.limit,
      pages: Math.max(1, Math.ceil(rows.length / q.limit)),
    };
  });

  /** Saves the team's settings for one Doctar record and applies them to the website. */
  app.put('/doctar/overlays/:kind/:doctarId', async (request) => {
    const { kind, doctarId } = z
      .object({ kind: KIND, doctarId: z.string().regex(/^[a-f0-9]{24}$/) })
      .parse(request.params);
    const body = overlayBody.parse(request.body ?? {});
    const record = (
      directoryIndex()?.[kind === 'doctor' ? 'doctors' : 'facilities'] as Doc[] | undefined
    )?.find((d) => String(d.doctarId) === doctarId);
    if (!record) throw notFound('No such Doctar record in the directory');
    const overlay = await DoctarOverlayModel.findOneAndUpdate(
      { kind, doctarId },
      { $set: { ...body, slug: record.slug, name: record.name } },
      { upsert: true, new: true, runValidators: true },
    ).lean();
    await refreshOverlays();
    return { overlay };
  });

  /** Back to Doctar's record as is. */
  app.delete('/doctar/overlays/:kind/:doctarId', async (request) => {
    const { kind, doctarId } = z.object({ kind: KIND, doctarId: z.string() }).parse(request.params);
    const removed = await DoctarOverlayModel.deleteOne({ kind, doctarId });
    await refreshOverlays();
    return { ok: removed.deletedCount > 0 };
  });
}
