/**
 * POST /doctors/:slug/requests: "Request an appointment" for doctors who can't be booked online (Doctar
 * listings). Saved with status "requested" for the Curxx team to confirm by phone; nobody outside Curxx is
 * contacted (lib/notify/appointment-request.ts).
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, badRequest } from '../../lib/errors.js';
import { reference } from '../../lib/http.js';
import { notifyAppointmentRequest } from '../../lib/notify/appointment-request.js';
import { AppointmentRequestModel } from '../../models/appointment-request.model.js';
import { Doctors, Facilities, notListed } from '../doctar/store.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Spam limits (also checked in the DB, as the rate-limit plugin is per instance and off in tests). */
export const REQUEST_LIMITS = { perPhonePerDay: 3, perIpPerHour: 10 };

const body = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  preferredDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(''))
    .default(''),
  preferredTime: z.enum(['any', 'morning', 'afternoon', 'evening']).default('any'),
  facilitySlug: z.string().trim().max(160).default(''),
});

const hashIp = (ip: string) =>
  createHash('sha256').update(`${env.JWT_SECRET}:${ip}`).digest('hex').slice(0, 32);

/** A preferred day must be today or within the next 30 days (Indian time). */
export function validDay(day: string, now = new Date()) {
  if (!day) return true;
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const picked = new Date(day);
  return (
    !Number.isNaN(picked.getTime()) &&
    picked.getTime() >= today.getTime() &&
    picked.getTime() <= today.getTime() + 30 * DAY_MS
  );
}

export async function appointmentRequestRoutes(app: FastifyInstance) {
  app.post(
    '/doctors/:slug/requests',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const { slug } = z.object({ slug: z.string().max(160) }).parse(request.params);
      const input = body.parse(request.body);
      if (!validDay(input.preferredDay))
        throw badRequest('Pick a day within the next 30 days', 'invalid_day');
      const doctor = await Doctors.findOne({ slug });
      if (!doctor) throw notListed('Doctor not found');
      // Curxx's own doctors are booked on real slots; a doctor the team set to Call / Visit only takes none.
      if (!doctor.source)
        throw new HttpError(409, 'Book a time online for this doctor instead', 'book_online');
      if (doctor.bookable === false)
        throw new HttpError(403, 'This doctor doesn’t take requests on Curxx', 'requests_off');

      const since = new Date(Date.now() - DAY_MS);
      const ip = hashIp(request.ip);
      const [samePhone, sameDoctor, sameIp] = await Promise.all([
        AppointmentRequestModel.countDocuments({
          'patient.phone': input.phone,
          createdAt: { $gte: since },
        }),
        AppointmentRequestModel.countDocuments({
          'patient.phone': input.phone,
          doctorSlug: slug,
          status: 'requested',
        }),
        AppointmentRequestModel.countDocuments({
          requestIp: ip,
          createdAt: { $gte: new Date(Date.now() - DAY_MS / 24) },
        }),
      ]);
      if (sameDoctor)
        throw new HttpError(
          409,
          'You already have a request with this doctor. We’ll call you to confirm it.',
          'already_requested',
        );
      if (samePhone >= REQUEST_LIMITS.perPhonePerDay || sameIp >= REQUEST_LIMITS.perIpPerHour)
        throw new HttpError(
          429,
          'Too many requests. Please try again tomorrow.',
          'too_many_requests',
        );

      const facility = input.facilitySlug
        ? await Facilities.findOne({ slug: input.facilitySlug, city: doctor.city })
        : null;
      const saved = await AppointmentRequestModel.create({
        reference: reference('REQ'),
        doctorSlug: slug,
        doctorName: doctor.name,
        doctarId: String(doctor.doctarId ?? ''),
        facilitySlug: facility?.slug ?? '',
        facilityName: facility?.name ?? doctor.clinicName ?? '',
        city: doctor.city,
        patient: { name: input.name, phone: input.phone },
        preferredDay: input.preferredDay,
        preferredTime: input.preferredTime,
        requestIp: ip,
      });
      // Not awaited: a slow or failing notice never fails the request (its outcome is stored on it).
      void notifyAppointmentRequest({
        _id: saved._id,
        reference: saved.reference,
        doctorName: saved.doctorName,
        facilityName: saved.facilityName,
        patient: { name: input.name, phone: input.phone },
        preferredDay: saved.preferredDay,
        preferredTime: saved.preferredTime,
      }).catch(() => {});
      reply.code(201);
      return {
        request: {
          reference: saved.reference,
          status: saved.status,
          doctorName: saved.doctorName,
          facilityName: saved.facilityName,
          preferredDay: saved.preferredDay,
          preferredTime: saved.preferredTime,
        },
      };
    },
  );
}
