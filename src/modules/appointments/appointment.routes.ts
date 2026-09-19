import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { conflict, notFound } from '../../lib/errors.js';
import { AppointmentModel } from '../../models/appointment.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { SlotModel } from '../../models/slot.model.js';

const HOLD_MS = 8 * 60 * 1000; // matches the 8:00 hold shown in the booking UI

const bookBody = z.object({
  slotId: z.string().length(24),
  patient: z.object({
    name: z.string().trim().min(2).max(80),
    age: z.coerce.number().int().min(0).max(120).optional(),
    gender: z.enum(['female', 'male', 'other']).optional(),
    phone: z.string().min(10).max(15),
  }),
});

const reference = () => `CRX-${randomBytes(4).toString('hex').toUpperCase()}`;

const shape = (a: Record<string, any>) => ({
  id: String(a._id),
  reference: a.reference,
  doctorSlug: a.doctorSlug,
  startsAt: a.startsAt,
  mode: a.mode,
  amount: a.amount,
  status: a.status,
  patient: a.patient,
});

export async function appointmentRoutes(app: FastifyInstance) {
  /** Reserves a slot for 8 minutes so two patients can't take the same time. */
  app.post('/slots/:id/hold', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().length(24) }).parse(request.params);
    const held = await SlotModel.findOneAndUpdate(
      { _id: id, status: 'open' },
      { status: 'held', holdExpiresAt: new Date(Date.now() + HOLD_MS) },
      { new: true },
    ).lean();
    if (!held) throw conflict('That slot was just taken', 'slot_unavailable');
    return { slotId: String(held._id), expiresAt: held.holdExpiresAt, holdSeconds: HOLD_MS / 1000 };
  });

  app.post('/appointments', { preHandler: authenticate }, async (request, reply) => {
    const { slotId, patient } = bookBody.parse(request.body);

    // One atomic write claims the slot: whoever gets here first wins.
    const slot = await SlotModel.findOneAndUpdate(
      { _id: slotId, status: { $in: ['open', 'held'] } },
      { status: 'booked', $unset: { holdExpiresAt: 1 } },
      { new: true },
    );
    if (!slot) throw conflict('That slot is no longer available', 'slot_unavailable');

    const doctor = await DoctorModel.findById(slot.doctor).lean();
    if (!doctor) throw notFound('Doctor not found');

    try {
      const appointment = await AppointmentModel.create({
        reference: reference(),
        user: request.user.sub,
        doctor: slot.doctor,
        doctorSlug: slot.doctorSlug,
        slot: slot._id,
        startsAt: slot.startsAt,
        mode: slot.mode,
        amount: slot.fee,
        patient,
      });
      reply.code(201);
      return { appointment: { ...shape(appointment.toObject()), doctor: { slug: doctor.slug, name: doctor.name, clinicName: doctor.clinicName, area: doctor.area } } };
    } catch (error) {
      await SlotModel.updateOne({ _id: slot._id }, { status: 'open' }); // release on failure
      throw error;
    }
  });

  app.get('/appointments', { preHandler: authenticate }, async (request) => {
    const appointments = await AppointmentModel.find({ user: request.user.sub })
      .sort({ startsAt: -1 })
      .limit(50)
      .populate('doctor', 'slug name title clinicName area photoUrl')
      .lean();

    return {
      appointments: appointments.map((a: any) => ({
        ...shape(a),
        doctor: a.doctor ? { slug: a.doctor.slug, name: a.doctor.name, title: a.doctor.title, clinicName: a.doctor.clinicName, area: a.doctor.area, photoUrl: a.doctor.photoUrl } : null,
      })),
    };
  });

  app.patch('/appointments/:id/cancel', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().length(24) }).parse(request.params);
    const appointment = await AppointmentModel.findOneAndUpdate(
      { _id: id, user: request.user.sub, status: 'confirmed' },
      { status: 'cancelled' },
      { new: true },
    ).lean();
    if (!appointment) throw notFound('Appointment not found');

    await SlotModel.updateOne({ _id: appointment.slot }, { status: 'open' }); // back on sale
    return { appointment: shape(appointment) };
  });
}
