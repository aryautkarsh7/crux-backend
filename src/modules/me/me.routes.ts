import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { objectId, toDto } from '../../lib/http.js';
import { AccessGrantModel } from '../../models/access-grant.model.js';
import { AppointmentModel } from '../../models/appointment.model.js';
import { ArticleModel } from '../../models/article.model.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { HealthRecordModel } from '../../models/health-record.model.js';
import { OrderModel } from '../../models/order.model.js';
import { UserModel } from '../../models/user.model.js';

const addressBody = z.object({
  label: z.string().trim().max(30).default('Home'),
  name: z.string().trim().max(80).default(''),
  line1: z.string().trim().min(3, 'Enter house / flat and street').max(120),
  line2: z.string().trim().max(120).default(''),
  area: z.string().trim().max(60).default(''),
  city: z.string().trim().max(40).default('Bengaluru'),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  isDefault: z.boolean().default(false),
});

type Notification = { id: string; icon: string; title: string; body: string; href: string; at: Date; tone: 'info' | 'success' | 'warning' };

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ---- Saved doctors & articles ----
  app.get('/saved', async (request) => {
    const user = await UserModel.findById(request.user.sub, { savedDoctors: 1, savedArticles: 1 }).lean();
    if (!user) throw notFound('Account not found');
    const [doctors, articles] = await Promise.all([
      DoctorModel.find({ slug: { $in: user.savedDoctors } }).lean(),
      ArticleModel.find({ slug: { $in: user.savedArticles } }, { sections: 0 }).lean(),
    ]);
    return { doctors: doctors.map((d) => toDto(d)), articles: articles.map((a) => toDto(a)), slugs: { doctors: user.savedDoctors, articles: user.savedArticles } };
  });

  const savedParams = z.object({ kind: z.enum(['doctors', 'articles']), slug: z.string().min(2).max(120) });
  const savedField = (kind: 'doctors' | 'articles') => (kind === 'doctors' ? 'savedDoctors' : 'savedArticles');

  app.put('/saved/:kind/:slug', async (request) => {
    const { kind, slug } = savedParams.parse(request.params);
    const exists = kind === 'doctors' ? await DoctorModel.exists({ slug }) : await ArticleModel.exists({ slug });
    if (!exists) throw notFound(kind === 'doctors' ? 'Doctor not found' : 'Article not found');
    const user = await UserModel.findByIdAndUpdate(request.user.sub, { $addToSet: { [savedField(kind)]: slug } }, { new: true }).lean();
    return { saved: true, slugs: { doctors: user?.savedDoctors ?? [], articles: user?.savedArticles ?? [] } };
  });

  app.delete('/saved/:kind/:slug', async (request) => {
    const { kind, slug } = savedParams.parse(request.params);
    const user = await UserModel.findByIdAndUpdate(request.user.sub, { $pull: { [savedField(kind)]: slug } }, { new: true }).lean();
    return { saved: false, slugs: { doctors: user?.savedDoctors ?? [], articles: user?.savedArticles ?? [] } };
  });

  // ---- Addresses ----
  app.get('/addresses', async (request) => {
    const user = await UserModel.findById(request.user.sub, { addresses: 1 }).lean();
    return { addresses: (user?.addresses ?? []).map((a) => toDto(a)) };
  });

  app.post('/addresses', async (request, reply) => {
    const body = addressBody.parse(request.body);
    const user = await UserModel.findById(request.user.sub);
    if (!user) throw notFound('Account not found');
    if (user.addresses.length >= 10) throw badRequest('You can save up to 10 addresses', 'too_many_addresses');
    const makeDefault = body.isDefault || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    user.addresses.push({ ...body, isDefault: makeDefault });
    await user.save();
    reply.code(201);
    return { addresses: user.toObject().addresses.map((a) => toDto(a)) };
  });

  app.patch('/addresses/:id/default', async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const user = await UserModel.findById(request.user.sub);
    if (!user || !user.addresses.id(id)) throw notFound('Address not found');
    user.addresses.forEach((a) => { a.isDefault = String(a._id) === id; });
    await user.save();
    return { addresses: user.toObject().addresses.map((a) => toDto(a)) };
  });

  app.delete('/addresses/:id', async (request) => {
    const { id } = z.object({ id: objectId }).parse(request.params);
    const user = await UserModel.findById(request.user.sub);
    const address = user?.addresses.id(id);
    if (!user || !address) throw notFound('Address not found');
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
    await user.save();
    return { addresses: user.toObject().addresses.map((a) => toDto(a)) };
  });

  // ---- Notifications (derived from appointments, orders, records and consents) ----
  app.get('/notifications', async (request) => {
    const userId = request.user.sub;
    const now = Date.now();
    const [appointments, orders, records, grants] = await Promise.all([
      AppointmentModel.find({ user: userId, status: 'confirmed', startsAt: { $gte: new Date(now - 3_600_000), $lte: new Date(now + 3 * 86_400_000) } }).sort({ startsAt: 1 }).limit(5).populate('doctor', 'name clinicName area').lean(),
      OrderModel.find({ user: userId, createdAt: { $gte: new Date(now - 7 * 86_400_000) } }).sort({ createdAt: -1 }).limit(5).lean(),
      HealthRecordModel.find({ user: userId, date: { $gte: new Date(now - 30 * 86_400_000) } }).sort({ date: -1 }).limit(3).lean(),
      AccessGrantModel.find({ user: userId, status: 'active', expiresAt: { $gte: new Date(now), $lte: new Date(now + 7 * 86_400_000) } }).lean(),
    ]);

    const items: Notification[] = [];
    for (const a of appointments as any[]) {
      const when = new Date(a.startsAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      items.push({ id: `apt-${a._id}`, icon: a.mode === 'video' ? 'videocam' : 'event_available', title: `${a.mode === 'video' ? 'Video consult' : 'Clinic visit'} · ${when}`, body: `${a.doctor?.name ?? 'Your doctor'}${a.mode === 'clinic' && a.doctor?.clinicName ? ` · ${a.doctor.clinicName}, ${a.doctor.area}` : ''}`, href: a.mode === 'video' ? `/consult/lobby/${a._id}` : '/account', at: a.startsAt, tone: 'info' });
    }
    for (const o of orders) {
      const label = o.kind === 'pharmacy' ? `Medicine order ${o.reference}` : `Lab booking ${o.reference}`;
      items.push({ id: `ord-${o._id}`, icon: o.kind === 'pharmacy' ? 'local_shipping' : 'science', title: o.status === 'cancelled' ? `${label} cancelled` : label, body: `${o.items.length} item${o.items.length === 1 ? '' : 's'} · ₹${o.total.toLocaleString('en-IN')}`, href: `/orders/${o.reference}`, at: o.createdAt!, tone: o.status === 'cancelled' ? 'warning' : 'success' });
    }
    for (const r of records) {
      items.push({ id: `rec-${r._id}`, icon: r.kind === 'lab_report' ? 'lab_profile' : 'description', title: r.kind === 'lab_report' ? 'Lab report added' : 'Record added to your locker', body: r.title, href: `/records?record=${r._id}`, at: r.date, tone: 'info' });
    }
    for (const g of grants) {
      items.push({ id: `grt-${g._id}`, icon: 'shield_person', title: 'Record access expiring soon', body: `${g.grantee?.name ?? "Someone"} · until ${new Date(g.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: '/records/access', at: g.expiresAt, tone: 'warning' });
    }
    items.sort((a, b) => Math.abs(new Date(a.at).getTime() - now) - Math.abs(new Date(b.at).getTime() - now));
    return { notifications: items.slice(0, 10) };
  });

  // ---- Dashboard summary ----
  app.get('/summary', async (request) => {
    const userId = request.user.sub;
    const [upcoming, orders, records, grants] = await Promise.all([
      AppointmentModel.countDocuments({ user: userId, status: 'confirmed', startsAt: { $gte: new Date() } }),
      OrderModel.countDocuments({ user: userId, status: { $ne: 'cancelled' } }),
      HealthRecordModel.countDocuments({ user: userId }),
      AccessGrantModel.countDocuments({ user: userId, status: 'active', expiresAt: { $gte: new Date() } }),
    ]);
    return { upcomingAppointments: upcoming, orders, records, activeGrants: grants };
  });
}
