import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { CATALOGUE_CACHE } from '../../lib/http.js';
import { InteractionModel, ReportModel, VideoModel } from '../../models/activity.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { FacilityModel } from '../../models/facility.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { LabModel } from '../../models/lab.model.js';
import { MedicineModel } from '../../models/medicine.model.js';

const TARGETS = ['doctor', 'facility', 'lab', 'lab-test', 'medicine', 'site'] as const;
type Target = (typeof TARGETS)[number];

export const deviceOf = (request: FastifyRequest) => (/Mobi|Android|iPhone|iPad/i.test(request.headers['user-agent'] ?? '') ? 'mobile' : 'desktop');

/** The signed-in patient, if the request carries a patient token. Never fails the request. */
async function patientOf(request: FastifyRequest) {
  if (!request.headers.authorization) return null;
  try {
    await request.jwtVerify();
    return request.user.role === 'admin' || !Types.ObjectId.isValid(request.user.sub) ? null : { id: request.user.sub, phone: request.user.phone };
  } catch {
    return null;
  }
}

/** Name and city of the profile an action is about, looked up server-side (never trusted from the client). */
async function describe(type: Target, slug: string) {
  const projection = { name: 1, city: 1 };
  const doc =
    type === 'doctor' ? await DoctorModel.findOne({ slug }, projection).lean()
    : type === 'facility' ? await FacilityModel.findOne({ slug }, projection).lean()
    : type === 'lab' ? await LabModel.findOne({ slug }, projection).lean()
    : type === 'lab-test' ? await LabTestModel.findOne({ slug }, { name: 1 }).lean()
    : type === 'medicine' ? await MedicineModel.findOne({ slug }, { name: 1 }).lean()
    : null;
  if (type !== 'site' && !doc) throw badRequest('Unknown profile', 'unknown_target');
  return { targetName: (doc as { name?: string } | null)?.name ?? 'Curxx', city: (doc as { city?: string } | null)?.city ?? '' };
}

/** YouTube / Shorts / Instagram reel / direct file → how the website should embed it. */
export function embedFor(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') ?? u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/)?.[2];
      if (id) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === 'instagram.com') {
      const m = u.pathname.match(/\/(reel|reels|p)\/([\w-]+)/);
      if (m) return { provider: 'instagram', embedUrl: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed` };
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u.pathname)) return { provider: 'file', embedUrl: url };
    return { provider: 'link', embedUrl: '' };
  } catch {
    return { provider: 'link', embedUrl: '' };
  }
}

export async function activityRoutes(app: FastifyInstance) {
  /** Call / WhatsApp taps on profiles, so the team can follow up and measure demand. */
  app.post('/track', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = z
      .object({
        kind: z.enum(['call', 'whatsapp']),
        targetType: z.enum(TARGETS),
        targetSlug: z.string().trim().max(120).default(''),
        number: z.string().trim().max(20).default(''),
        page: z.string().trim().max(200).default(''),
      })
      .parse(request.body);
    const [target, patient] = await Promise.all([describe(body.targetType, body.targetSlug), patientOf(request)]);
    await InteractionModel.create({ ...body, ...target, device: deviceOf(request), ...(patient ? { user: patient.id, userPhone: patient.phone } : {}) });
    reply.code(201);
    return { ok: true };
  });

  /** "Report wrong information" on any profile. */
  app.post('/reports', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = z
      .object({
        targetType: z.enum(TARGETS),
        targetSlug: z.string().trim().max(120).default(''),
        issues: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
        details: z.string().trim().max(1000).default(''),
        contact: z.string().trim().max(100).default(''),
        page: z.string().trim().max(200).default(''),
      })
      .refine((b) => b.issues.length > 0 || b.details.length >= 5, { message: 'Tell us what is wrong', path: ['details'] })
      .parse(request.body);
    const [target, patient] = await Promise.all([describe(body.targetType, body.targetSlug), patientOf(request)]);
    const report = await ReportModel.create({ ...body, ...target, ...(patient ? { user: patient.id } : {}) });
    reply.code(201);
    return { report: { id: String(report._id) } };
  });

  /** Published reels and videos, for a doctor profile, a specialty, or the homepage (featured). */
  app.get('/videos', async (request, reply) => {
    const q = z
      .object({
        doctor: z.string().trim().max(120).optional(),
        specialty: z.string().trim().max(80).optional(),
        city: z.string().trim().max(40).optional(),
        featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
        limit: z.coerce.number().int().min(1).max(24).default(12),
      })
      .parse(request.query);
    const filter: Record<string, unknown> = { published: true };
    if (q.doctor) filter.doctorSlug = q.doctor;
    if (q.specialty) filter.specialty = q.specialty;
    if (q.city) filter.city = { $in: [q.city, ''] };
    if (q.featured) filter.featured = true;
    const videos = await VideoModel.find(filter).sort({ order: 1, createdAt: -1 }).limit(q.limit).lean();
    reply.header('cache-control', CATALOGUE_CACHE);
    return {
      videos: videos.map(({ _id, managed: _m, updatedAt: _u, ...v }) => ({ id: String(_id), ...v, ...embedFor(v.url) })),
    };
  });
}
