import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { escapeRegex, objectId, toDto } from '../../lib/http.js';
import { AccessGrantModel } from '../../models/access-grant.model.js';
import { HealthRecordModel } from '../../models/health-record.model.js';
import { materializeLabReports } from '../orders/lab-reports.js';

const KINDS = ['prescription', 'lab_report', 'imaging', 'discharge', 'vaccination', 'invoice'] as const;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 10 * 1024 * 1024;

const uploadBody = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(2).max(120),
  doctorName: z.string().trim().max(80).default(''),
  facility: z.string().trim().max(120).default(''),
  date: z.coerce.date().refine((d) => d <= new Date(Date.now() + 86_400_000), 'Date cannot be in the future'),
  summary: z.string().trim().max(1000).default(''),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.coerce.number().int().min(1).max(MAX_BYTES, 'Files must be under 10 MB'),
  mimeType: z.string().refine((t) => ALLOWED_TYPES.includes(t), 'Upload a PDF, JPG, PNG or HEIC file'),
});

const grantBody = z.object({
  granteeName: z.string().trim().min(2).max(80),
  granteeKind: z.enum(['doctor', 'hospital', 'family', 'insurer']),
  granteeDetail: z.string().trim().max(120).default(''),
  scope: z.enum(['all', 'prescriptions', 'lab_reports', 'selected']).default('all'),
  recordIds: z.array(objectId).max(50).default([]),
  permission: z.enum(['view', 'download']).default('view'),
  /** Either hours (1 hour – 1 year) or days; hours wins when both are sent. */
  hours: z.coerce.number().int().min(1).max(8760).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** Lapsed consents read as expired without a background job. */
const grantShape = (g: Record<string, any>) => ({
  ...toDto(g as { _id: unknown }, true),
  status: g.status === 'active' && new Date(g.expiresAt) < new Date() ? 'expired' : g.status,
});

export async function recordRoutes(app: FastifyInstance) {
  app.get('/records', { preHandler: authenticate }, async (request) => {
    const { kind, q } = z.object({ kind: z.enum(KINDS).optional(), q: z.string().trim().min(1).optional() }).parse(request.query);
    await materializeLabReports(request.user.sub);
    const filter: Record<string, unknown> = { user: request.user.sub };
    if (kind) filter.kind = kind;
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: re }, { doctorName: re }, { facility: re }, { tags: re }];
    }
    const [records, counts] = await Promise.all([
      HealthRecordModel.find(filter).sort({ date: -1 }).limit(100).lean(),
      HealthRecordModel.aggregate<{ _id: string; count: number }>([{ $match: { user: new Types.ObjectId(request.user.sub) } }, { $group: { _id: '$kind', count: { $sum: 1 } } }]),
    ]);
    return { records: records.map((r) => toDto(r, true)), counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) };
  });

  app.get('/records/:id', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const record = await HealthRecordModel.findOne({ _id: id, user: request.user.sub }).lean();
    if (!record) throw notFound('Record not found');
    return { record: toDto(record, true) };
  });

  /** Adds a document to the locker. File bytes go to object storage later; this stores the metadata. */
  app.post('/records', { preHandler: authenticate }, async (request, reply) => {
    const body = uploadBody.parse(request.body);
    const record = await HealthRecordModel.create({ ...body, user: request.user.sub, source: 'upload', tags: [body.kind === 'prescription' ? 'Uploaded Rx' : 'Uploaded'] });
    reply.code(201);
    return { record: toDto(record.toObject(), true) };
  });

  app.delete('/records/:id', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const record = await HealthRecordModel.findOne({ _id: id, user: request.user.sub });
    if (!record) throw notFound('Record not found');
    if (record.source !== 'upload') throw badRequest('Records issued by doctors or labs cannot be deleted', 'not_deletable');
    await record.deleteOne();
    await AccessGrantModel.updateMany({ user: request.user.sub }, { $pull: { records: record._id } });
    return { ok: true };
  });

  app.get('/access', { preHandler: authenticate }, async (request) => {
    const grants = await AccessGrantModel.find({ user: request.user.sub }).sort({ createdAt: -1 }).lean();
    return { grants: grants.map(grantShape) };
  });

  app.post('/access', { preHandler: authenticate }, async (request, reply) => {
    const body = grantBody.parse(request.body);
    if (body.scope === 'selected' && body.recordIds.length === 0) throw badRequest('Choose at least one record to share', 'no_records');
    if (body.recordIds.length) {
      const owned = await HealthRecordModel.countDocuments({ _id: { $in: body.recordIds }, user: request.user.sub });
      if (owned !== body.recordIds.length) throw badRequest('Some of those records are not in your locker', 'invalid_records');
    }
    const grant = await AccessGrantModel.create({
      user: request.user.sub,
      grantee: { name: body.granteeName, kind: body.granteeKind, detail: body.granteeDetail },
      scope: body.scope,
      permission: body.permission,
      records: body.scope === 'selected' ? body.recordIds : [],
      expiresAt: new Date(Date.now() + (body.hours ?? body.days * 24) * 3_600_000),
    });
    reply.code(201);
    return { grant: grantShape(grant.toObject()) };
  });

  app.patch('/access/:id/revoke', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const grant = await AccessGrantModel.findOneAndUpdate({ _id: id, user: request.user.sub }, { status: 'revoked' }, { new: true }).lean();
    if (!grant) throw notFound('Access grant not found');
    return { grant: grantShape(grant) };
  });
}
