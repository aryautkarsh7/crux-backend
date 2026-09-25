/**
 * Testing-team requests: audio teleconsultation, per-day doctor hours, rankings, Call/WhatsApp
 * tracking, sign-in history, wrong-information reports, and reels & videos.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { connectDatabase } from '../src/db/connect.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin = '';

async function call(method: string, url: string, opts: { token?: string; body?: unknown; ua?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.ua) headers['user-agent'] = opts.ua;
  const res = await app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers, payload: opts.body as object | undefined });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
async function patient() {
  const number = phone();
  const otp = await call('POST', '/auth/otp/request', { body: { phone: number } });
  const verified = await call('POST', '/auth/otp/verify', { body: { phone: number, code: otp.body.devCode }, ua: 'Mozilla/5.0 (iPhone)' });
  return { token: verified.body.token as string, id: verified.body.user.id as string, phone: number };
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  admin = (await call('POST', '/admin/auth/login', { body: { email: 'admin@curxx.test', password: 'test-admin-password' } })).body.token;
});

after(async () => {
  await app.close();
  await mongoose.disconnect();
});

describe('testing-team requests', () => {
  test('a tele slot can be booked as a phone consultation, and admin filters by mode', async () => {
    const me = await patient();
    const slots = (await call('GET', '/doctors/dr-priya-sharma/slots?mode=video')).body.slots;
    const booked = await call('POST', '/appointments', { token: me.token, body: { slotId: slots[0].id, mode: 'audio', patient: { name: 'Audio Patient', phone: me.phone } } });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    assert.equal(booked.body.appointment.mode, 'audio');
    // A clinic slot can't become a phone call.
    const clinic = (await call('GET', '/doctors/dr-priya-sharma/slots?mode=clinic')).body.slots;
    const visit = await call('POST', '/appointments', { token: me.token, body: { slotId: clinic[0].id, mode: 'audio', patient: { name: 'Visit Patient', phone: me.phone } } });
    assert.equal(visit.body.appointment.mode, 'clinic');
    const audio = await call('GET', '/admin/appointments?mode=audio', { token: admin });
    assert.ok(audio.body.items.length >= 1 && audio.body.items.every((a: { mode: string }) => a.mode === 'audio'));
    const stats = await call('GET', '/admin/stats', { token: admin });
    assert.ok('audio' in stats.body.appointmentsTodayByMode);
  });

  test('a doctor can keep different hours on different days', async () => {
    const facility = (await call('GET', '/admin/facilities?city=chennai&limit=1', { token: admin })).body.items[0];
    const created = await call('POST', '/admin/doctors', {
      token: admin,
      body: {
        name: 'Dr. Per Day', qualification: 'MBBS', title: 'Physician', specialty: 'general-physician', facilitySlug: facility.slug, experienceYears: 8, fee: 500,
        schedule: { days: [0, 1, 2, 3, 4, 5, 6], sessions: [{ start: '09:00', end: '12:00' }], perDay: [{ day: 0, sessions: [{ start: '16:00', end: '17:00' }] }], step: 30, video: 'none' },
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.item.consultHours, /Sun · 4:00 PM – 5:00 PM/);
    const slots = (await call('GET', '/doctors/dr-per-day/slots?days=8')).body.slots as { startsAt: string }[];
    const hoursOn = (weekday: number) => [...new Set(slots.filter((s) => new Date(s.startsAt).getDay() === weekday).map((s) => new Date(s.startsAt).getHours()))];
    assert.deepEqual(hoursOn(0), [16], 'Sunday uses its own hours');
    assert.deepEqual(hoursOn(1), [9, 10, 11], 'Monday uses the common hours');
    // Editing only a contact number must not leave the doctor without bookable slots.
    const edited = await call('PATCH', '/admin/doctors/dr-per-day', { token: admin, body: { whatsapp: '919876543210' } });
    assert.equal(edited.status, 200);
    const after = (await call('GET', '/doctors/dr-per-day/slots?days=8')).body.slots as unknown[];
    assert.equal(after.length, slots.length, 'slots regenerate after any edit');
    await call('DELETE', '/admin/doctors/dr-per-day', { token: admin });
  });

  test('rankings put chosen doctors, hospitals and labs first', async () => {
    const board = await call('GET', '/admin/rankings?type=doctors&city=pune&specialty=dermatologist', { token: admin });
    const last = board.body.items.at(-1);
    assert.ok(last);
    const saved = await call('POST', '/admin/rankings', { token: admin, body: { type: 'doctors', ranks: [{ slug: last.slug, rank: 1 }] } });
    assert.equal(saved.body.updated, 1);
    const listing = await call('GET', '/doctors?city=pune&specialty=dermatologist&limit=3');
    assert.equal(listing.body.doctors[0].slug, last.slug);
    const lab = (await call('GET', '/labs?city=pune')).body.items.at(-1);
    await call('POST', '/admin/rankings', { token: admin, body: { type: 'labs', ranks: [{ slug: lab.slug, rank: 1 }] } });
    assert.equal((await call('GET', '/labs?city=pune')).body.items[0].slug, lab.slug);
    // Ranking isn't an "admin edit": the record still refreshes from seed data.
    assert.notEqual((await call("GET", `/admin/doctors/${last.slug}`, { token: admin })).body.item.managed, true);
    await call('POST', '/admin/rankings', { token: admin, body: { type: 'doctors', ranks: [{ slug: last.slug, rank: 0 }] } });
    await call('POST', '/admin/rankings', { token: admin, body: { type: 'labs', ranks: [{ slug: lab.slug, rank: 0 }] } });
  });

  test('Call / WhatsApp taps and sign-ins are tracked', async () => {
    const me = await patient();
    assert.equal((await call('POST', '/track', { token: me.token, body: { kind: 'whatsapp', targetType: 'doctor', targetSlug: 'dr-priya-sharma', number: '919800000000' } })).status, 201);
    assert.equal((await call('POST', '/track', { body: { kind: 'call', targetType: 'facility', targetSlug: 'nope' } })).status, 400);
    const taps = await call('GET', '/admin/interactions?kind=whatsapp', { token: admin });
    assert.equal(taps.body.items[0].targetName, 'Dr. Priya Sharma');
    assert.equal(taps.body.items[0].userPhone, me.phone);
    const logins = await call('GET', `/admin/login-events?q=${me.phone}`, { token: admin });
    assert.equal(logins.body.items[0].firstLogin, true);
    assert.equal(logins.body.items[0].device, 'mobile');
    const activity = await call('GET', `/admin/users/${me.id}/activity`, { token: admin });
    assert.equal(activity.body.logins.length, 1);
    assert.equal(activity.body.interactions.length, 1);
    const stats = await call('GET', '/admin/stats', { token: admin });
    assert.ok(stats.body.whatsappToday >= 1 && stats.body.loginsToday >= 1);
  });

  test('wrong-information reports reach the admin', async () => {
    assert.equal((await call('POST', '/reports', { body: { targetType: 'lab', targetSlug: 'precision-path-hsr' } })).status, 400, 'needs an issue');
    const sent = await call('POST', '/reports', { body: { targetType: 'lab', targetSlug: 'precision-path-hsr', issues: ['Wrong phone number'], details: 'Number is switched off' } });
    assert.equal(sent.status, 201);
    const list = await call('GET', '/admin/reports?status=new', { token: admin });
    const report = list.body.items.find((r: { id: string }) => r.id === sent.body.report.id);
    assert.equal(report.targetName.length > 0, true);
    const fixed = await call('PATCH', `/admin/reports/${report.id}`, { token: admin, body: { status: 'fixed', details: 'tampered' } });
    assert.equal(fixed.body.item.status, 'fixed');
    assert.equal(fixed.body.item.details, 'Number is switched off');
  });

  test('reels and videos: added in admin, shown on the site with an embed', async () => {
    assert.equal((await call('POST', '/admin/videos', { token: admin, body: { title: 'Bad link', url: 'https://example.com/page' } })).status, 400);
    const created = await call('POST', '/admin/videos', { token: admin, body: { title: 'Acne myths', kind: 'reel', url: 'https://www.youtube.com/shorts/abc123XYZ', doctorSlug: 'dr-priya-sharma', featured: true } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const pub = await call('GET', '/videos?doctor=dr-priya-sharma');
    const video = pub.body.videos.find((v: { slug: string }) => v.slug === 'acne-myths');
    assert.equal(video.provider, 'youtube');
    assert.equal(video.embedUrl, 'https://www.youtube-nocookie.com/embed/abc123XYZ');
    await call('PATCH', '/admin/videos/acne-myths', { token: admin, body: { published: false } });
    assert.ok(!(await call('GET', '/videos?doctor=dr-priya-sharma')).body.videos.some((v: { slug: string }) => v.slug === 'acne-myths'));
    await call('DELETE', '/admin/videos/acne-myths', { token: admin });
  });
});
