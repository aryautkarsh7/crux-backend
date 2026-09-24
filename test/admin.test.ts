/**
 * Admin API: sign-in, access control, CRUD, and that admin-managed records survive the
 * catalogue sync that runs on every deploy.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { syncCatalogue } from '../src/db/catalogue.js';
import { connectDatabase } from '../src/db/connect.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let token = '';

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {}, payload: opts.body as object | undefined });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
  await mongoose.disconnect();
});

describe('admin', () => {
  test('sign-in and access control', async () => {
    assert.equal((await call('POST', '/admin/auth/login', { body: { email: 'admin@curxx.test', password: 'wrong-password' } })).status, 401);
    const ok = await call('POST', '/admin/auth/login', { body: { email: 'ADMIN@curxx.test', password: 'test-admin-password' } });
    assert.equal(ok.status, 200);
    token = ok.body.token;
    assert.equal((await call('GET', '/admin/stats')).status, 401, 'no token');
    // A patient token is not an admin token, and an admin token is not a patient token.
    const otp = await call('POST', '/auth/otp/request', { body: { phone: '9811100001' } });
    const patient = await call('POST', '/auth/otp/verify', { body: { phone: '9811100001', code: otp.body.devCode } });
    assert.equal((await call('GET', '/admin/stats', { token: patient.body.token })).status, 403);
    assert.equal((await call('GET', '/auth/me', { token })).status, 401);
    const stats = await call('GET', '/admin/stats', { token });
    assert.ok(stats.body.counts.doctors > 1000);
    const meta = await call('GET', '/admin/meta', { token });
    assert.equal(meta.body.facilityTypes.length, 19);
  });

  test('doctors: create, list, edit, and survive a catalogue sync', async () => {
    const facility = (await call('GET', '/admin/facilities?city=pune&limit=1', { token })).body.items[0];
    const created = await call('POST', '/admin/doctors', {
      token,
      body: { name: 'Dr. Admin Added', qualification: 'MBBS, MD', title: 'Consultant Physician', specialty: 'general-physician', facilitySlug: facility.slug, experienceYears: 12, fee: 600, $where: 'evil' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const doc = created.body.item;
    assert.equal(doc.slug, 'dr-admin-added');
    assert.equal(doc.city, 'pune');
    assert.equal(doc.clinicName, facility.name);
    assert.equal(doc.managed, true);
    assert.match(doc.consultHours, /Mon–Sat/);
    assert.equal((await call('POST', '/admin/doctors', { token, body: { name: 'Dr. Admin Added', qualification: 'x', title: 'x', specialty: 'general-physician', experienceYears: 1, fee: 1, area: 'x', clinicName: 'x' } })).status, 409);
    assert.equal((await call('POST', '/admin/doctors', { token, body: { name: 'Dr. Missing Fields' } })).status, 400);

    const edited = await call('PATCH', '/admin/doctors/dr-admin-added', { token, body: { fee: 750, schedule: { days: [1, 3, 5], sessions: [{ start: '09:00', end: '12:00' }], step: 20, video: 'all' } } });
    assert.equal(edited.body.item.fee, 750);
    assert.match(edited.body.item.consultHours, /9:00 AM/);
    // The public site sees the doctor and its slots from the new schedule.
    const slots = await call('GET', '/doctors/dr-admin-added/slots');
    assert.ok(slots.body.slots.length > 0 && slots.body.slots.every((s: { mode: string }) => s.mode === 'video'));

    // A seed doctor edited in the admin keeps the edit through a sync; the new doctor stays.
    const seed = (await call('GET', '/admin/doctors?city=mumbai&limit=1', { token })).body.items[0];
    await call('PATCH', `/admin/doctors/${seed.slug}`, { token, body: { fee: 4321 } });
    await syncCatalogue();
    assert.equal((await call('GET', '/doctors/dr-admin-added')).status, 200);
    assert.equal((await call('GET', `/doctors/${seed.slug}`)).body.doctor.fee, 4321);

    assert.equal((await call('DELETE', '/admin/doctors/dr-admin-added', { token })).status, 200);
    assert.equal((await call('GET', '/doctors/dr-admin-added')).status, 404);
  });

  test('read-mostly sections only change the allowed fields', async () => {
    const lead = await call('POST', '/leads', { body: { kind: 'callback', phone: '9876500000', name: 'Lead' } });
    const updated = await call('PATCH', `/admin/leads/${lead.body.lead.id}`, { token, body: { status: 'contacted', phone: '0000000000' } });
    assert.equal(updated.body.item.status, 'contacted');
    assert.equal(updated.body.item.phone, '9876500000');
    assert.equal((await call('POST', '/admin/users', { token, body: { phone: '9000000000' } })).status, 400);
    assert.equal((await call('GET', '/admin/nope', { token })).status, 404);
  });
});
