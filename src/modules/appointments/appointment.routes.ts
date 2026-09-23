import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { objectId, reference, toDto } from '../../lib/http.js';
import { claimableBy } from '../../lib/slots.js';
import { AppointmentModel } from '../../models/appointment.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { MessageModel } from '../../models/message.model.js';
import { SlotModel } from '../../models/slot.model.js';

const HOLD_MS = 8 * 60 * 1000; // matches the 8:00 hold shown in the booking UI
/** Video rooms open 15 minutes before the slot and stay open 45 minutes after. */
const ROOM_OPENS_MS = 15 * 60 * 1000;
const ROOM_CLOSES_MS = 45 * 60 * 1000;

const bookBody = z.object({
  slotId: objectId,
  focus: z.string().trim().max(60).default(''),
  notes: z.string().trim().max(500).default(''),
  patient: z.object({
    name: z.string().trim().min(2).max(80),
    age: z.coerce.number().int().min(0).max(120).optional(),
    gender: z.enum(['female', 'male', 'other']).optional(),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  }),
});

const DOCTOR_FIELDS = 'slug name title clinicName area photoUrl specialty facilitySlug videoFee fee';

/** Past confirmed appointments read as completed without a background job. */
function statusOf(a: { status: string; startsAt: Date }) {
  if (a.status === 'confirmed' && new Date(a.startsAt).getTime() + ROOM_CLOSES_MS < Date.now()) return 'completed';
  return a.status;
}

function roomState(a: { mode: string; startsAt: Date; status: string }) {
  const start = new Date(a.startsAt).getTime();
  const now = Date.now();
  const opensAt = new Date(start - ROOM_OPENS_MS);
  const closesAt = new Date(start + ROOM_CLOSES_MS);
  // Outside production the room is always joinable so the flow can be tested any time.
  const inWindow = now >= opensAt.getTime() && now <= closesAt.getTime();
  const canJoin = a.mode === 'video' && a.status === 'confirmed' && (inWindow || (!env.isProduction && now <= closesAt.getTime()));
  return { opensAt, closesAt, canJoin };
}

const shape = (a: Record<string, any>) => {
  const { doctor, ...rest } = a;
  const status = statusOf(a as never);
  return {
    ...toDto(rest as { _id: unknown }, true),
    status,
    doctor: doctor && typeof doctor === 'object' && 'slug' in doctor ? toDto(doctor) : null,
    room: roomState({ mode: a.mode, startsAt: a.startsAt, status }),
  };
};

/** Accepts either the Mongo id or the human reference (CRX-…). */
function lookup(idOrRef: string, userId: string) {
  return Types.ObjectId.isValid(idOrRef) && idOrRef.length === 24
    ? { _id: idOrRef, user: userId }
    : { reference: idOrRef.toUpperCase(), user: userId };
}

export async function appointmentRoutes(app: FastifyInstance) {
  /** Reserves a slot for 8 minutes so two patients can't take the same time. */
  app.post('/slots/:id/hold', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const held = await SlotModel.findOneAndUpdate(
      { _id: id, startsAt: { $gt: new Date() }, ...claimableBy(request.user.sub) },
      { status: 'held', heldBy: request.user.sub, holdExpiresAt: new Date(Date.now() + HOLD_MS) },
      { new: true },
    ).lean();
    if (!held) throw conflict('That slot was just taken', 'slot_unavailable');
    return { slotId: String(held._id), expiresAt: held.holdExpiresAt, holdSeconds: HOLD_MS / 1000 };
  });

  app.post('/appointments', { preHandler: authenticate }, async (request, reply) => {
    const { slotId, patient, focus, notes } = bookBody.parse(request.body);

    // One atomic write claims the slot: open, lapsed, or held by this same patient.
    const slot = await SlotModel.findOneAndUpdate(
      { _id: slotId, startsAt: { $gt: new Date() }, ...claimableBy(request.user.sub) },
      { status: 'booked', $unset: { holdExpiresAt: 1, heldBy: 1 } },
      { new: true },
    );
    if (!slot) throw conflict('That slot is no longer available', 'slot_unavailable');

    const doctor = await DoctorModel.findById(slot.doctor).lean();
    if (!doctor) throw notFound('Doctor not found');

    try {
      const appointment = await AppointmentModel.create({
        reference: reference('CRX'),
        user: request.user.sub,
        doctor: slot.doctor,
        doctorSlug: slot.doctorSlug,
        slot: slot._id,
        startsAt: slot.startsAt,
        mode: slot.mode,
        amount: slot.fee,
        patient,
        focus,
        notes,
      });
      await MessageModel.create({
        appointment: appointment._id,
        from: 'system',
        text: `Appointment ${appointment.reference} confirmed with ${doctor.name}. You can share symptoms or reports here before your ${slot.mode === 'video' ? 'video consult' : 'visit'}.`,
      });
      reply.code(201);
      return { appointment: shape({ ...appointment.toObject(), doctor }) };
    } catch (error) {
      await SlotModel.updateOne({ _id: slot._id }, { status: 'open' }); // release on failure
      throw error;
    }
  });

  app.get('/appointments', { preHandler: authenticate }, async (request) => {
    const appointments = await AppointmentModel.find({ user: request.user.sub })
      .sort({ startsAt: -1 })
      .limit(50)
      .populate('doctor', DOCTOR_FIELDS)
      .lean();
    return { appointments: appointments.map(shape) };
  });

  app.get('/appointments/:id', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().min(6).max(30) }).parse(request.params);
    const appointment = await AppointmentModel.findOne(lookup(id, request.user.sub)).populate('doctor', DOCTOR_FIELDS).lean();
    if (!appointment) throw notFound('Appointment not found');
    return { appointment: shape(appointment) };
  });

  app.patch('/appointments/:id/cancel', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().min(6).max(30) }).parse(request.params);
    const appointment = await AppointmentModel.findOneAndUpdate(
      { ...lookup(id, request.user.sub), status: 'confirmed', startsAt: { $gt: new Date() } },
      { status: 'cancelled' },
      { new: true },
    ).populate('doctor', DOCTOR_FIELDS).lean();
    if (!appointment) throw notFound('Appointment not found or already started');

    await SlotModel.updateOne({ _id: appointment.slot }, { status: 'open', $unset: { heldBy: 1, holdExpiresAt: 1 } }); // back on sale
    await MessageModel.create({ appointment: appointment._id, from: 'system', text: 'This appointment was cancelled. Any payment is refunded to the original method within 5–7 working days.' });
    return { appointment: shape(appointment) };
  });

  /** Moves a booking to another open slot of the same doctor, releasing the old one. */
  app.patch('/appointments/:id/reschedule', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().min(6).max(30) }).parse(request.params);
    const { slotId } = z.object({ slotId: objectId }).parse(request.body);
    const appointment = await AppointmentModel.findOne({ ...lookup(id, request.user.sub), status: 'confirmed', startsAt: { $gt: new Date() } });
    if (!appointment) throw notFound('Appointment not found or already started');
    if (String(appointment.slot) === slotId) throw badRequest('Pick a different time', 'same_slot');

    const next = await SlotModel.findOneAndUpdate(
      { _id: slotId, doctorSlug: appointment.doctorSlug, startsAt: { $gt: new Date() }, ...claimableBy(request.user.sub) },
      { status: 'booked', $unset: { holdExpiresAt: 1, heldBy: 1 } },
      { new: true },
    );
    if (!next) throw conflict('That slot is no longer available', 'slot_unavailable');

    const previousSlot = appointment.slot;
    appointment.slot = next._id;
    appointment.startsAt = next.startsAt;
    appointment.mode = next.mode;
    appointment.amount = next.fee;
    await appointment.save();
    await SlotModel.updateOne({ _id: previousSlot }, { status: 'open', $unset: { heldBy: 1, holdExpiresAt: 1 } });
    await MessageModel.create({ appointment: appointment._id, from: 'system', text: `Rescheduled to ${next.startsAt.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}.` });

    const populated = await AppointmentModel.findById(appointment._id).populate('doctor', DOCTOR_FIELDS).lean();
    return { appointment: shape(populated!) };
  });

  // ---- Consultation chat ----
  app.get('/appointments/:id/messages', { preHandler: authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().min(6).max(30) }).parse(request.params);
    const appointment = await AppointmentModel.findOne(lookup(id, request.user.sub), { _id: 1 }).lean();
    if (!appointment) throw notFound('Appointment not found');
    const messages = await MessageModel.find({ appointment: appointment._id }).sort({ createdAt: 1 }).limit(200).lean();
    return { messages: messages.map((m) => toDto(m, true)) };
  });

  app.post('/appointments/:id/messages', { preHandler: authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(6).max(30) }).parse(request.params);
    const body = z.object({
      text: z.string().trim().min(1).max(2000),
      attachment: z.object({ name: z.string().max(200), size: z.number().int().max(10 * 1024 * 1024) }).optional(),
    }).parse(request.body);
    const appointment = await AppointmentModel.findOne(lookup(id, request.user.sub)).populate('doctor', 'name').lean();
    if (!appointment) throw notFound('Appointment not found');
    if (appointment.status === 'cancelled') throw badRequest('This appointment was cancelled', 'cancelled');

    const message = await MessageModel.create({ appointment: appointment._id, from: 'patient', text: body.text, attachment: body.attachment });

    // Until the doctor app exists, the first patient message gets the clinic's standard acknowledgement.
    const doctorReplied = await MessageModel.exists({ appointment: appointment._id, from: 'doctor' });
    const replies = [];
    if (!doctorReplied) {
      const doctorName = (appointment.doctor as { name?: string } | null)?.name ?? 'Your doctor';
      replies.push(await MessageModel.create({
        appointment: appointment._id,
        from: 'doctor',
        text: `Thanks for sharing — ${doctorName} will review this before your ${appointment.mode === 'video' ? 'call' : 'visit'}. If symptoms get worse suddenly, call 108.`,
      }));
    }
    reply.code(201);
    return { messages: [message, ...replies].map((m) => toDto(m.toObject(), true)) };
  });
}

