import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { objectId, reference, toDto } from '../../lib/http.js';
import { HealthRecordModel } from '../../models/health-record.model.js';
import { LabTestModel } from '../../models/lab-test.model.js';
import { MedicineModel } from '../../models/medicine.model.js';
import { OrderModel } from '../../models/order.model.js';
import { locate } from '../../lib/geo.js';
import { LabModel } from '../../models/lab.model.js';
import { collectionAvailability, collectionStart, eligibleLabs, fit, labSnapshot, loadLabs, origin, visitOnly } from '../labs/lab-network.js';
import { REPORT_TURNAROUND_MS, materializeLabReports } from './lab-reports.js';

const address = z.object({
  label: z.string().trim().max(30).default('Home'),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).default(''),
  area: z.string().trim().max(60).default(''),
  city: z.string().trim().max(40).default('Bengaluru'),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

const patient = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
});

const orderBody = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pharmacy'),
    items: z.array(z.object({ slug: z.string(), qty: z.coerce.number().int().min(1).max(10) })).min(1).max(30),
    address,
    prescriptionId: objectId.optional(),
    paymentMethod: z.enum(['upi', 'card', 'cod']).default('upi'),
  }),
  z.object({
    kind: z.literal('lab'),
    items: z.array(z.object({ slug: z.string(), qty: z.literal(1).default(1) })).min(1).max(10),
    /** Home collection needs an address; a lab visit needs the lab. */
    collectionMode: z.enum(['home', 'lab']).default('home'),
    labSlug: z.string().trim().min(1).optional(),
    address: address.optional(),
    patient,
    pickup: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), window: z.string().trim().min(5).max(30) }),
    paymentMethod: z.enum(['upi', 'card', 'cod']).default('upi'),
  }),
]);

const FREE_DELIVERY_OVER = 499;
const DELIVERY_FEE = 49;

/**
 * Pharmacy orders move through their delivery stages on a clock, so a demo order
 * visibly progresses. Lab orders progress from the collection time.
 */
function effectiveStatus(order: { kind: string; status: string; createdAt?: Date; pickup?: { date?: Date | null } | null }) {
  if (order.status === 'cancelled') return 'cancelled';
  const minutes = (Date.now() - new Date(order.createdAt ?? Date.now()).getTime()) / 60000;
  if (order.kind === 'pharmacy') {
    if (minutes > 120) return 'delivered';
    if (minutes > 60) return 'out_for_delivery';
    if (minutes > 20) return 'packed';
    if (minutes > 2) return 'confirmed';
    return 'placed';
  }
  const collectAt = order.pickup?.date ? new Date(order.pickup.date).getTime() : Infinity;
  const sinceCollection = (Date.now() - collectAt) / 3_600_000;
  if (sinceCollection * 3_600_000 > REPORT_TURNAROUND_MS) return 'report_ready';
  if (sinceCollection > 0) return 'sample_collected';
  return 'sample_scheduled';
}

const shape = (o: Record<string, any>) => ({ ...toDto(o as { _id: unknown }, true), status: effectiveStatus(o as never) });

export async function orderRoutes(app: FastifyInstance) {
  app.post('/orders', { preHandler: authenticate }, async (request, reply) => {
    const body = orderBody.parse(request.body);
    const userId = request.user.sub;

    if (body.kind === 'pharmacy') {
      const slugs = [...new Set(body.items.map((i) => i.slug))];
      const products = await MedicineModel.find({ slug: { $in: slugs } }).lean();
      if (products.length !== slugs.length) throw badRequest('Some items are no longer available', 'unknown_item');
      const bySlug = new Map(products.map((p) => [p.slug, p]));

      const needsRx = products.some((p) => p.rxRequired);
      if (needsRx) {
        if (!body.prescriptionId) throw badRequest('Upload a valid prescription for the Rx medicines in your cart', 'prescription_required');
        const rx = await HealthRecordModel.exists({ _id: body.prescriptionId, user: userId, kind: 'prescription' });
        if (!rx) throw badRequest('That prescription was not found in your health locker', 'prescription_invalid');
      }

      // Reserve stock item by item; roll back if any line runs out.
      const reserved: { slug: string; qty: number }[] = [];
      for (const line of body.items) {
        const ok = await MedicineModel.updateOne({ slug: line.slug, stock: { $gte: line.qty } }, { $inc: { stock: -line.qty } });
        if (!ok.modifiedCount) {
          await Promise.all(reserved.map((r) => MedicineModel.updateOne({ slug: r.slug }, { $inc: { stock: r.qty } })));
          throw conflict(`${bySlug.get(line.slug)?.name ?? line.slug} is out of stock`, 'out_of_stock');
        }
        reserved.push(line);
      }

      const items = body.items.map((line) => {
        const p = bySlug.get(line.slug)!;
        return { slug: p.slug, name: p.name, price: p.price, mrp: p.mrp, qty: line.qty, rxRequired: p.rxRequired };
      });
      const subtotal = items.reduce((n, i) => n + i.mrp * i.qty, 0);
      const payable = items.reduce((n, i) => n + i.price * i.qty, 0);
      const deliveryFee = payable >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;

      const order = await OrderModel.create({
        reference: reference('RX'),
        user: userId,
        kind: 'pharmacy',
        items,
        subtotal,
        discount: subtotal - payable,
        deliveryFee,
        total: payable + deliveryFee,
        address: body.address,
        prescription: body.prescriptionId,
        payment: { method: body.paymentMethod, status: body.paymentMethod === 'cod' ? 'pending' : 'paid' },
        etaAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      reply.code(201);
      return { order: shape(order.toObject()) };
    }

    // Lab booking: price from the catalogue, assign a lab, then check its window still has room.
    const slugs = [...new Set(body.items.map((i) => i.slug))];
    const tests = await LabTestModel.find({ slug: { $in: slugs } }).lean();
    if (tests.length !== slugs.length) throw badRequest('Some tests are no longer available', 'unknown_item');

    const mode = body.collectionMode;
    if (mode === 'home' && !body.address) throw badRequest('Add the address where we should collect the sample', 'address_required');
    if (mode === 'home') {
      const atCentre = visitOnly(tests);
      if (atCentre.length) throw badRequest(`${atCentre.map((t) => t.name).join(', ')} can’t be done at home. Book a lab visit for ${atCentre.length > 1 ? 'these' : 'it'}.`, 'visit_only');
    }
    const place = mode === 'home' ? locate(body.address!.pincode) : origin();
    if (!place) throw badRequest(`Home collection isn’t available at ${body.address!.pincode} yet. You can book a lab visit instead.`, 'not_serviceable');

    let lab;
    if (body.labSlug) {
      lab = await LabModel.findOne({ slug: body.labSlug }).lean();
      if (!lab) throw badRequest('That lab is not on Curxx', 'unknown_lab');
      const match = fit(lab, place, slugs);
      if (!match.offersAll) {
        const names = tests.filter((t) => match.missingTests.includes(t.slug)).map((t) => t.name);
        throw badRequest(`${lab.shortName} doesn’t run ${names.join(', ')}. Pick another lab or remove ${names.length > 1 ? 'those tests' : 'that test'}.`, 'lab_missing_tests');
      }
      if (mode === 'home' && !match.canCollect) throw badRequest(`${lab.shortName} doesn’t collect at ${place.area} (${place.pincode}). Pick a lab nearer to you.`, 'lab_out_of_range');
      if (mode === 'lab' && !match.canVisit) throw badRequest(`${lab.shortName} doesn’t take walk-ins`, 'lab_no_walk_in');
    } else {
      if (mode === 'lab') throw badRequest('Choose the lab you will visit', 'lab_required');
      lab = eligibleLabs(await loadLabs(place.city), place, slugs, 'home')[0]?.lab;
      if (!lab) throw badRequest(`No partner lab collects at ${place.area} (${place.pincode}) for all these tests. You can book a lab visit instead.`, 'not_serviceable');
    }

    const collectionDate = collectionStart(body.pickup.date, body.pickup.window, mode);
    if (!collectionDate) throw badRequest('Pick a collection time from the list', 'invalid_window');
    const days = await collectionAvailability({ lab, mode });
    const window = days.find((d) => d.date === body.pickup.date)?.windows.find((w) => w.window === body.pickup.window);
    if (!window?.available) throw conflict('That slot is full. Please pick another time.', 'slot_unavailable');

    const items = tests.map((t) => ({ slug: t.slug, name: t.name, price: t.price, mrp: t.mrp, qty: 1, rxRequired: false }));
    const subtotal = items.reduce((n, i) => n + i.mrp, 0);
    const payable = items.reduce((n, i) => n + i.price, 0);

    const order = await OrderModel.create({
      reference: reference('LB'),
      user: userId,
      kind: 'lab',
      items,
      subtotal,
      discount: subtotal - payable,
      deliveryFee: 0,
      total: payable,
      status: 'sample_scheduled',
      collectionMode: mode,
      lab: labSnapshot(lab),
      ...(mode === 'home' ? { address: body.address } : {}),
      patient: body.patient,
      pickup: { date: collectionDate, window: body.pickup.window },
      payment: { method: body.paymentMethod, status: body.paymentMethod === 'cod' ? 'pending' : 'paid' },
    });
    reply.code(201);
    return { order: shape(order.toObject()) };
  });

  app.get('/orders', { preHandler: authenticate }, async (request) => {
    await materializeLabReports(request.user.sub);
    const { kind } = z.object({ kind: z.enum(['pharmacy', 'lab']).optional() }).parse(request.query);
    const orders = await OrderModel.find({ user: request.user.sub, ...(kind ? { kind } : {}) }).sort({ createdAt: -1 }).limit(50).lean();
    return { orders: orders.map(shape) };
  });

  app.get('/orders/:reference', { preHandler: authenticate }, async (request) => {
    const { reference: ref } = z.object({ reference: z.string().min(4).max(20) }).parse(request.params);
    await materializeLabReports(request.user.sub);
    const order = await OrderModel.findOne({ reference: ref.toUpperCase(), user: request.user.sub }).lean();
    if (!order) throw notFound('Order not found');
    return { order: shape(order) };
  });

  app.patch('/orders/:reference/cancel', { preHandler: authenticate }, async (request) => {
    const { reference: ref } = z.object({ reference: z.string().min(4).max(20) }).parse(request.params);
    const order = await OrderModel.findOne({ reference: ref.toUpperCase(), user: request.user.sub });
    if (!order) throw notFound('Order not found');
    const current = effectiveStatus(order.toObject() as never);
    const cancellable = order.kind === 'pharmacy' ? ['placed', 'confirmed'] : ['sample_scheduled'];
    if (!cancellable.includes(current)) throw conflict('This order can no longer be cancelled', 'not_cancellable');

    order.status = 'cancelled';
    await order.save();
    if (order.kind === 'pharmacy') {
      await Promise.all(order.items.map((i) => MedicineModel.updateOne({ slug: i.slug }, { $inc: { stock: i.qty ?? 0 } })));
    }
    return { order: shape(order.toObject()) };
  });
}
