/**
 * End-to-end API suite. Runs against the seeded `curxx_test` database (see `npm test`)
 * through Fastify's inject(), so no port is opened.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { connectDatabase } from '../src/db/connect.js';
import { MedicineModel } from '../src/models/medicine.model.js';
import { OrderModel } from '../src/models/order.model.js';
import { SlotModel } from '../src/models/slot.model.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({
    method: method as 'GET',
    url: `/api/v1${url}`,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    payload: opts.body as object | undefined,
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

/** Fresh random phone per run, so accounts never collide across runs. */
const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

async function signIn(number = phone()) {
  const otp = await call('POST', '/auth/otp/request', { body: { phone: number } });
  assert.equal(otp.status, 200);
  const verified = await call('POST', '/auth/otp/verify', { body: { phone: number, code: otp.body.devCode } });
  assert.equal(verified.status, 200);
  return { token: verified.body.token as string, user: verified.body.user, phone: number };
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

describe('service basics', () => {
  test('health and root index', async () => {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    const root = await app.inject({ method: 'GET', url: '/' });
    assert.equal(JSON.parse(root.body).service, 'curxx-api');
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await call('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'not_found');
  });

  test('protected routes reject missing and forged tokens', async () => {
    for (const url of ['/appointments', '/orders', '/records', '/access', '/me/saved', '/me/notifications', '/auth/me']) {
      assert.equal((await call('GET', url)).status, 401, `${url} without token`);
    }
    assert.equal((await call('GET', '/appointments', { token: 'not.a.jwt' })).status, 401);
  });
});

describe('doctors & specialties', () => {
  test('specialties list, with bookable counts per mode', async () => {
    const plain = await call('GET', '/specialties');
    assert.equal(plain.body.specialties.length, 56);
    assert.equal(plain.body.categories.length, 12);
    const video = await call('GET', '/specialties?mode=video');
    assert.ok(video.body.specialties.every((s: { availableDoctors: number }) => typeof s.availableDoctors === 'number'));
  });

  test('every specialty has doctors in every city', async () => {
    const { body } = await call('GET', '/specialties');
    for (const s of body.specialties) assert.ok(s.doctorCount >= 2, `${s.slug} has ${s.doctorCount} in Bengaluru`);
    const mumbai = await call('GET', '/specialties?city=mumbai');
    for (const s of mumbai.body.specialties) assert.ok(s.doctorCount >= 2, `${s.slug} has ${s.doctorCount} in Mumbai`);
    // Aliases resolve: /bengaluru and /trichologist are the same pages as /bangalore and /dermatologist.
    const alias = await call('GET', '/doctors?city=bengaluru&specialty=trichologist&limit=1');
    const canonical = await call('GET', '/doctors?city=bangalore&specialty=dermatologist&limit=1');
    assert.equal(alias.body.total, canonical.body.total);
  });

  test('specialty content is specific to the specialty, city and locality', async () => {
    const gp = await call('GET', '/specialties/general-physician?city=mumbai');
    assert.equal(gp.status, 200);
    assert.equal(gp.body.city.name, 'Mumbai');
    assert.match(gp.body.intro, /General Physicians in Mumbai/);
    assert.ok(!JSON.stringify(gp.body).includes('Dermatolog'), 'no dermatology copy on a GP page');
    assert.ok(gp.body.faqs.length >= 5);
    assert.ok(gp.body.localities.every((l: { count: number }) => l.count > 0));
    const local = await call('GET', `/specialties/general-physician?city=mumbai&area=${gp.body.localities[0].slug}`);
    assert.equal(local.body.locality.slug, gp.body.localities[0].slug);
    assert.equal(local.body.stats.doctors, gp.body.localities[0].count);
    assert.equal((await call('GET', '/specialties/general-physician?city=atlantis')).status, 404);
    const cities = await call('GET', '/cities');
    assert.ok(cities.body.cities.length >= 20);
  });

  test('consult now and free consults', async () => {
    // Every city has a 24x7 online GP, so "now" is never empty.
    for (const city of ['bangalore', 'patna']) {
      const now = await call('GET', `/doctors?city=${city}&availability=now&limit=20`);
      assert.ok(now.body.total >= 1, `${city} has someone online now`);
      const soon = Date.now() + 61 * 60 * 1000;
      assert.ok(now.body.doctors.every((d: { nextSlot: { mode: string; startsAt: string } }) => d.nextSlot.mode === 'video' && new Date(d.nextSlot.startsAt).getTime() <= soon));
    }
    const everywhere = await call('GET', '/doctors?city=all&availability=now&specialty=general-physician&limit=50');
    assert.ok(new Set(everywhere.body.doctors.map((d: { city: string }) => d.city)).size > 1, 'video search spans cities');
    const free = await call('GET', '/doctors?city=mumbai&free=true&limit=20');
    assert.ok(free.body.total > 0);
    assert.ok(free.body.doctors.every((d: { freeVideo: boolean; nextSlot: { fee: number; free: boolean } }) => d.freeVideo && d.nextSlot.free && d.nextSlot.fee === 0));
    const soonest = await call('GET', '/doctors?specialty=dermatologist&sort=soonest&limit=5');
    const times = soonest.body.doctors.map((d: { nextSlotAt: string }) => new Date(d.nextSlotAt).getTime());
    assert.ok(times.length > 0);
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  test('filters narrow results and facets describe the specialty', async () => {
    const all = await call('GET', '/doctors?specialty=dermatologist&limit=50');
    const area = all.body.facets.areas[0].value;
    const inArea = await call('GET', `/doctors?specialty=dermatologist&area=${encodeURIComponent(area)}&limit=50`);
    assert.ok(inArea.body.total > 0 && inArea.body.total <= all.body.total);
    assert.ok(inArea.body.doctors.every((d: { area: string }) => d.area === area));

    const cheap = await call('GET', '/doctors?maxFee=600&limit=50');
    assert.ok(cheap.body.doctors.every((d: { fee: number }) => d.fee <= 600));

    const senior = await call('GET', '/doctors?minExperience=15&limit=50');
    assert.ok(senior.body.doctors.every((d: { experienceYears: number }) => d.experienceYears >= 15));

    const kannada = await call('GET', '/doctors?language=Kannada&limit=50');
    assert.ok(kannada.body.doctors.every((d: { languages: string[] }) => d.languages.includes('Kannada')));
  });

  test('sort orders are honoured', async () => {
    const asc = await call('GET', '/doctors?sort=fee_asc&limit=20');
    const fees = asc.body.doctors.map((d: { fee: number }) => d.fee);
    assert.deepEqual(fees, [...fees].sort((a, b) => a - b));
    const exp = await call('GET', '/doctors?sort=experience&limit=20');
    const years = exp.body.doctors.map((d: { experienceYears: number }) => d.experienceYears);
    assert.deepEqual(years, [...years].sort((a, b) => b - a));
  });

  test('pagination is consistent', async () => {
    const p1 = await call('GET', '/doctors?limit=10&page=1');
    const p2 = await call('GET', '/doctors?limit=10&page=2');
    assert.equal(p1.body.pages, Math.ceil(p1.body.total / 10));
    const ids = new Set(p1.body.doctors.map((d: { id: string }) => d.id));
    assert.ok(p2.body.doctors.every((d: { id: string }) => !ids.has(d.id)), 'pages overlap');
  });

  test('search matches symptoms, not just names', async () => {
    const acne = await call('GET', '/doctors?q=acne&limit=50');
    assert.ok(acne.body.total > 0);
    assert.equal(acne.body.doctors[0].specialty, 'dermatologist');
    assert.ok(acne.body.doctors.every((d: { specialty: string }) => acne.body.matchedSpecialties.includes(d.specialty)));
    const fever = await call('GET', '/doctors?q=fever&limit=5');
    assert.equal(fever.body.doctors[0].specialty, 'general-physician', 'best-matching specialty first');
    const cardio = await call('GET', '/doctors?q=cardiologist&limit=50');
    assert.ok(cardio.body.doctors.every((d: { specialty: string }) => d.specialty === 'cardiologist'));
  });

  test('doctor detail includes facility, reviews summary and similar doctors; unknown is 404', async () => {
    const { body } = await call('GET', '/doctors/dr-priya-sharma');
    assert.equal(body.doctor.slug, 'dr-priya-sharma');
    assert.ok(body.facility?.name);
    assert.ok(body.doctor.reviewSummary.total > 0);
    assert.ok(body.similar.length > 0);
    assert.equal((await call('GET', '/doctors/dr-nobody')).status, 404);
  });

  test('slots are future and bookable only', async () => {
    const { body } = await call('GET', '/doctors/dr-priya-sharma/slots');
    assert.ok(body.slots.length > 0);
    assert.ok(body.slots.every((s: { startsAt: string }) => new Date(s.startsAt) > new Date()));
  });

  test('reviews paginate with a rating breakdown that adds up', async () => {
    const { body } = await call('GET', '/doctors/dr-priya-sharma/reviews?limit=3');
    assert.equal(body.items.length, 3);
    const sum = Object.values(body.summary.breakdown as Record<string, number>).reduce((a, b) => a + b, 0);
    assert.equal(sum, body.summary.total);
    const video = await call('GET', '/doctors/dr-priya-sharma/reviews?mode=video&limit=30');
    assert.ok(video.body.items.every((r: { mode: string }) => r.mode === 'video'));
  });
});

describe('facilities', () => {
  test('hospitals and clinics filter separately, with detail pages', async () => {
    const hospitals = await call('GET', '/facilities?type=hospital&limit=50');
    const clinics = await call('GET', '/facilities?type=clinic&limit=50');
    assert.ok(hospitals.body.items.every((f: { type: string }) => f.type === 'hospital'));
    assert.ok(clinics.body.items.every((f: { type: string }) => f.type === 'clinic'));
    const emergency = await call('GET', '/facilities?emergency=true&limit=50');
    assert.ok(emergency.body.items.every((f: { emergency24x7: boolean }) => f.emergency24x7));

    const detail = await call('GET', '/facilities/manipal-hospital');
    assert.equal(detail.body.facility.slug, 'manipal-hospital');
    assert.ok(detail.body.doctors.length > 0);
    assert.equal((await call('GET', '/facilities/nowhere')).status, 404);
  });
});

describe('pharmacy catalogue', () => {
  test('categories report counts; list filters, searches and sorts', async () => {
    const cats = await call('GET', '/medicine-categories');
    assert.ok(cats.body.categories.find((c: { slug: string; count: number }) => c.slug === 'skin-care')!.count > 0);

    const skin = await call('GET', '/medicines?category=skin-care&limit=50');
    assert.ok(skin.body.items.every((m: { categories: string[] }) => m.categories.includes('skin-care')));

    const search = await call('GET', '/medicines?q=paracetamol');
    assert.ok(search.body.items.some((m: { slug: string }) => m.slug === 'dolo-650'));

    const priced = await call('GET', '/medicines?sort=price_asc&limit=40');
    const prices = priced.body.items.map((m: { price: number }) => m.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

    const rx = await call('GET', '/medicines?rx=required&limit=50');
    assert.ok(rx.body.items.every((m: { rxRequired: boolean }) => m.rxRequired));
  });

  test('medicine detail returns full info plus similar items', async () => {
    const { body } = await call('GET', '/medicines/augmentin-625');
    assert.ok(body.medicine.uses.length > 0 && body.medicine.howToUse);
    assert.ok(body.similar.length > 0);
    assert.equal((await call('GET', '/medicines/unobtainium')).status, 404);
  });
});

describe('labs catalogue', () => {
  test('categories, packages vs tests, detail and collection windows', async () => {
    const cats = await call('GET', '/lab-categories');
    assert.ok(cats.body.categories.some((c: { group: string }) => c.group === 'concern'));
    assert.ok(cats.body.categories.filter((c: { group: string }) => c.group === 'department').length >= 12);
    const all = await call('GET', '/lab-tests?limit=1');
    assert.ok(all.body.total >= 250, 'the full diagnostic directory is listed');
    const scans = await call('GET', '/lab-tests?kind=scan&limit=50');
    assert.ok(scans.body.total > 0 && scans.body.items.every((t: { homeCollection: boolean }) => t.homeCollection === false));
    const packages = await call('GET', '/lab-tests?kind=package&limit=50');
    assert.ok(packages.body.items.every((t: { kind: string }) => t.kind === 'package'));
    const search = await call('GET', '/lab-tests?q=hba1c');
    assert.ok(search.body.total > 0);

    const detail = await call('GET', '/lab-tests/comprehensive-full-body-checkup');
    assert.ok(detail.body.test.parameterGroups.length > 0);

    const slots = await call('GET', '/lab-collection-slots');
    assert.equal(slots.body.days.length, 5);
    assert.ok(detail.body.availability.labCount >= 2, 'test detail says where it can be done');
    assert.ok(detail.body.availability.nearest.name);
  });

  test('partner lab directory: distance, filters, profile', async () => {
    const all = await call('GET', '/labs');
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 13);
    const delhi = await call('GET', '/labs?city=delhi');
    assert.ok(delhi.body.total >= 4 && delhi.body.items.every((l: { pincode: string }) => l.pincode.startsWith('11')));
    const km = all.body.items.map((l: { distanceKm: number }) => l.distanceKm);
    assert.deepEqual(km, [...km].sort((a, b) => a - b), 'nearest first');
    assert.equal(all.body.near.area, 'Indiranagar');

    // Specialised tests only run at reference labs.
    const psa = await call('GET', '/labs?test=psa-total');
    assert.ok(psa.body.items.length >= 2 && psa.body.items.every((l: { type: string }) => l.type === 'reference'));
    // Walk-in-only points never claim home collection.
    const home = await call('GET', '/labs?homeCollection=true&pincode=560001');
    assert.ok(home.body.items.every((l: { canCollect: boolean }) => l.canCollect));
    assert.ok(!home.body.items.some((l: { slug: string }) => l.slug === 'curxx-collection-point-mg-road'));
    const nabl = await call('GET', '/labs?accreditation=CAP');
    assert.ok(nabl.body.items.every((l: { accreditations: string[] }) => l.accreditations.includes('CAP')));

    const profile = await call('GET', '/labs/precision-path-hsr?pincode=560102');
    assert.equal(profile.body.lab.area, 'HSR Layout');
    assert.ok(profile.body.lab.distanceKm < 1);
    assert.ok(profile.body.tests.length > 10);
    assert.equal(profile.body.nearby.length, 3);
    assert.equal((await call('GET', '/labs/nope')).status, 404);
  });

  test('pincode matching picks the nearest lab that can do every test', async () => {
    const hsr = await call('GET', '/labs/match?pincode=560102&tests=lipid-profile,hba1c');
    assert.equal(hsr.body.serviceable, true);
    assert.equal(hsr.body.recommended, 'precision-path-hsr');
    // Adding a reference-only test moves the booking to a reference lab.
    const psa = await call('GET', '/labs/match?pincode=560102&tests=lipid-profile,psa-total');
    assert.equal(psa.body.recommended, 'curxx-diagnostics-koramangala');
    const outside = await call('GET', '/labs/match?pincode=744101&tests=hba1c');
    assert.equal(outside.body.serviceable, false);
    assert.match(outside.body.reason, /cities/);
    const delhi = await call('GET', '/labs/match?pincode=110001&tests=hba1c');
    assert.equal(delhi.body.serviceable, true, 'other cities have home collection too');
    const scan = await call('GET', '/lab-tests?kind=scan&limit=1');
    const visitOnly = await call('GET', `/labs/match?pincode=560102&tests=${scan.body.items[0].slug}`);
    assert.equal(visitOnly.body.serviceable, false);
    assert.deepEqual(visitOnly.body.visitOnly, [scan.body.items[0].slug]);
    const visit = await call('GET', '/labs/match?tests=hba1c&mode=lab');
    assert.equal(visit.body.serviceable, true);

    const walkIns = await call('GET', '/lab-collection-slots?lab=curxx-collection-point-mg-road&mode=lab');
    assert.equal(walkIns.body.days.length, 5);
    assert.equal((await call('GET', '/lab-collection-slots?lab=curxx-collection-point-mg-road&mode=home')).body.days.every((d: { windows: { available: boolean }[] }) => d.windows.every((w) => !w.available)), true, 'no home collection from a walk-in point');
  });
});

describe('content, search & triage', () => {
  test('articles list and detail with author and related', async () => {
    const list = await call('GET', '/articles?limit=5');
    assert.equal(list.body.items.length, 5);
    const detail = await call('GET', '/articles/managing-heart-health');
    assert.ok(detail.body.article.sections.length > 0);
    assert.equal(detail.body.author?.slug, 'dr-vikram-desai');
    assert.equal(detail.body.related.length, 3);
  });

  test('site search spans every catalogue', async () => {
    const { body } = await call('GET', '/search?q=skin');
    assert.ok(body.doctors.length > 0);
    assert.ok(body.medicines.length > 0);
    assert.equal((await call('GET', '/search?q=a')).status, 400, 'one-character queries are rejected');
  });

  test('triage escalates red flags and routes the rest', async () => {
    const emergency = await call('POST', '/triage', { body: { symptoms: 'sudden chest pain spreading to my jaw' } });
    assert.equal(emergency.body.urgency, 'emergency');
    const derm = await call('POST', '/triage', { body: { symptoms: 'itchy red rash on my arms' } });
    assert.equal(derm.body.specialty.slug, 'dermatologist');
    const child = await call('POST', '/triage', { body: { symptoms: 'fever and cough', forWhom: 'child', age: 4 } });
    assert.equal(child.body.specialty.slug, 'pediatrician');
    const bad = await call('POST', '/triage', { body: { symptoms: 'x' } });
    assert.equal(bad.status, 400);
  });

  test('conditions, surgeries and autosuggest', async () => {
    const acne = await call('GET', '/conditions/acne?city=pune');
    assert.equal(acne.body.specialty.slug, 'dermatologist');
    assert.equal(acne.body.city.name, 'Pune');
    assert.ok(acne.body.faqs.length >= 3);
    const surgeries = await call('GET', '/surgeries?city=patna');
    assert.ok(surgeries.body.surgeries.length >= 30);
    const metro = await call('GET', '/surgeries/cataract-surgery?city=mumbai');
    const tier2 = await call('GET', '/surgeries/cataract-surgery?city=patna');
    assert.ok(tier2.body.surgery.cost[0] < metro.body.surgery.cost[0], 'tier-2 cities cost less');
    assert.ok(metro.body.hospitals.length > 0);
    assert.equal((await call('GET', '/surgeries/nope')).status, 404);
    const suggest = await call('GET', '/search/suggest?q=fev');
    assert.equal(suggest.body.specialties[0].slug, 'general-physician');
    assert.ok(suggest.body.conditions.some((c: { slug: string }) => c.slug === 'fever'));
    const types = await call('GET', '/facilities?city=delhi&category=eye-hospital');
    assert.ok(types.body.items.every((f: { category: string }) => f.category === 'Eye Hospital'));
    assert.equal(types.body.facets.categories.length, 19);
  });

  test('leads need a way to reach the person', async () => {
    assert.equal((await call('POST', '/leads', { body: { kind: 'callback', name: 'A' } })).status, 400);
    assert.equal((await call('POST', '/leads', { body: { kind: 'newsletter', email: 'reader@example.com' } })).status, 201);
    assert.equal((await call('POST', '/leads', { body: { kind: 'surgery', surgery: 'cataract-surgery', phone: '9876543210', city: 'mumbai' } })).status, 201);
    assert.equal((await call('POST', '/leads', { body: { kind: 'provider', phone: '12345' } })).status, 400);
  });
});

describe('auth & profile', () => {
  test('OTP validates numbers and a new account gets a demo locker', async () => {
    assert.equal((await call('POST', '/auth/otp/request', { body: { phone: '12345' } })).status, 400);
    const { token, user } = await signIn();
    assert.match(user.abhaId, /^\d{2}-\d{4}-\d{4}-\d{4}$/);
    const records = await call('GET', '/records', { token });
    assert.equal(records.body.records.length, 7);
    const access = await call('GET', '/access', { token });
    assert.equal(access.body.grants.length, 4);
  });

  test('login and register are separate', async () => {
    const number = phone();
    const login = await call('POST', '/auth/otp/request', { body: { phone: number, intent: 'login' } });
    assert.equal(login.status, 404);
    assert.equal(login.body.error, 'not_registered');
    const register = await call('POST', '/auth/otp/request', { body: { phone: number, intent: 'register' } });
    assert.equal(register.status, 200);
    const verified = await call('POST', '/auth/otp/verify', { body: { phone: number, code: register.body.devCode, registration: { name: 'Meera Nair', email: 'meera@example.com', gender: 'female', dob: '1992-04-12' } } });
    assert.equal(verified.body.user.name, 'Meera Nair');
    assert.equal(verified.body.user.gender, 'female');
    const again = await call('POST', '/auth/otp/request', { body: { phone: number, intent: 'register' } });
    assert.equal(again.status, 409);
    const back = await call('POST', '/auth/otp/request', { body: { phone: number, intent: 'login' } });
    assert.equal(back.body.registered, true);
  });

  test('profile updates validate fields', async () => {
    const { token } = await signIn();
    const ok = await call('PATCH', '/auth/me', { token, body: { name: 'Asha Rao', bloodGroup: 'O+' } });
    assert.equal(ok.body.user.name, 'Asha Rao');
    const bad = await call('PATCH', '/auth/me', { token, body: { email: 'not-an-email' } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, 'email');
  });
});

describe('booking lifecycle', () => {
  test('holds protect a slot from other patients until they lapse', async () => {
    const alice = await signIn();
    const bob = await signIn();
    const { body } = await call('GET', '/doctors/dr-meera-nambiar/slots');
    const slot = body.slots[body.slots.length - 1];

    assert.equal((await call('POST', `/slots/${slot.id}/hold`, { token: alice.token })).status, 200);
    assert.equal((await call('POST', `/slots/${slot.id}/hold`, { token: bob.token })).status, 409, 'bob cannot take alice’s hold');
    const patient = { name: 'Bob Test', phone: bob.phone };
    assert.equal((await call('POST', '/appointments', { token: bob.token, body: { slotId: slot.id, patient } })).status, 409, 'bob cannot book it either');

    // Once the hold lapses, the slot is bookable again (and not deleted).
    await SlotModel.updateOne({ _id: slot.id }, { holdExpiresAt: new Date(Date.now() - 1000) });
    const booked = await call('POST', '/appointments', { token: bob.token, body: { slotId: slot.id, patient } });
    assert.equal(booked.status, 201);
    assert.ok(await SlotModel.exists({ _id: slot.id }), 'lapsed hold must not delete the slot');
  });

  test('book, chat, reschedule and cancel', async () => {
    const me = await signIn();
    const { body } = await call('GET', '/doctors/dr-vikram-desai/slots?mode=video');
    const [first, second] = body.slots.slice(-2);
    const patient = { name: 'Chat Test', phone: me.phone, age: 34, gender: 'female' };

    const booked = await call('POST', '/appointments', { token: me.token, body: { slotId: first.id, patient } });
    assert.equal(booked.status, 201);
    const appt = booked.body.appointment;
    assert.match(appt.reference, /^CRX-/);
    assert.equal(appt.room.canJoin, true);

    // Double booking the same slot fails.
    assert.equal((await call('POST', '/appointments', { token: me.token, body: { slotId: first.id, patient } })).status, 409);

    // Lookup by id and by reference.
    assert.equal((await call('GET', `/appointments/${appt.id}`, { token: me.token })).status, 200);
    assert.equal((await call('GET', `/appointments/${appt.reference}`, { token: me.token })).status, 200);

    // Chat: first patient message gets the clinic acknowledgement.
    const sent = await call('POST', `/appointments/${appt.id}/messages`, { token: me.token, body: { text: 'Mild chest tightness after climbing stairs' } });
    assert.equal(sent.body.messages.length, 2);
    const thread = await call('GET', `/appointments/${appt.id}/messages`, { token: me.token });
    assert.ok(thread.body.messages.length >= 3);

    // Reschedule frees the old slot.
    const moved = await call('PATCH', `/appointments/${appt.id}/reschedule`, { token: me.token, body: { slotId: second.id } });
    assert.equal(moved.status, 200);
    assert.equal((await SlotModel.findById(first.id).lean())!.status, 'open');

    // Cancel frees the new one.
    const cancelled = await call('PATCH', `/appointments/${appt.id}/cancel`, { token: me.token });
    assert.equal(cancelled.body.appointment.status, 'cancelled');
    assert.equal((await SlotModel.findById(second.id).lean())!.status, 'open');

    // Other users cannot see it.
    const stranger = await signIn();
    assert.equal((await call('GET', `/appointments/${appt.id}`, { token: stranger.token })).status, 404);
  });
});

describe('orders', () => {
  test('pharmacy: Rx items need a prescription; prices come from the server; stock is reserved and restored', async () => {
    const me = await signIn();
    const address = { line1: '12, 4th Cross, Indiranagar', pincode: '560038', phone: me.phone };
    const before = (await MedicineModel.findOne({ slug: 'dolo-650' }).lean())!.stock;

    const noRx = await call('POST', '/orders', { token: me.token, body: { kind: 'pharmacy', items: [{ slug: 'augmentin-625', qty: 1 }], address } });
    assert.equal(noRx.status, 400);
    assert.equal(noRx.body.error, 'prescription_required');

    const records = await call('GET', '/records?kind=prescription', { token: me.token });
    const prescriptionId = records.body.records[0].id;
    const ok = await call('POST', '/orders', { token: me.token, body: { kind: 'pharmacy', items: [{ slug: 'augmentin-625', qty: 1 }, { slug: 'dolo-650', qty: 2 }], address, prescriptionId } });
    assert.equal(ok.status, 201);
    const order = ok.body.order;
    assert.equal(order.total, 201 + 2 * 30 + 49, 'server prices + delivery fee under ₹499');
    assert.equal((await MedicineModel.findOne({ slug: 'dolo-650' }).lean())!.stock, before - 2);

    const cancelled = await call('PATCH', `/orders/${order.reference}/cancel`, { token: me.token });
    assert.equal(cancelled.body.order.status, 'cancelled');
    assert.equal((await MedicineModel.findOne({ slug: 'dolo-650' }).lean())!.stock, before);

    const bad = await call('POST', '/orders', { token: me.token, body: { kind: 'pharmacy', items: [{ slug: 'dolo-650', qty: 1 }], address: { ...address, pincode: '12' } } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, 'address.pincode');
  });

  test('pharmacy: out-of-stock lines roll back earlier reservations', async () => {
    const me = await signIn();
    const address = { line1: '12, 4th Cross, Indiranagar', pincode: '560038', phone: me.phone };
    await MedicineModel.updateOne({ slug: 'limcee-500' }, { stock: 0 });
    const shelcalBefore = (await MedicineModel.findOne({ slug: 'shelcal-500' }).lean())!.stock;
    const res = await call('POST', '/orders', { token: me.token, body: { kind: 'pharmacy', items: [{ slug: 'shelcal-500', qty: 1 }, { slug: 'limcee-500', qty: 1 }], address } });
    assert.equal(res.status, 409);
    assert.equal((await MedicineModel.findOne({ slug: 'shelcal-500' }).lean())!.stock, shelcalBefore);
    await MedicineModel.updateOne({ slug: 'limcee-500' }, { stock: 100 });
  });

  test('lab booking uses a live collection window', async () => {
    const me = await signIn();
    const { body } = await call('GET', '/lab-collection-slots?lab=precision-path-hsr');
    const day = body.days.find((d: { windows: { available: boolean }[] }) => d.windows.some((w) => w.available));
    const slot = day.windows.find((w: { available: boolean }) => w.available);
    const window = slot.window;
    const res = await call('POST', '/orders', {
      token: me.token,
      body: {
        kind: 'lab',
        items: [{ slug: 'lipid-profile' }, { slug: 'hba1c' }],
        address: { line1: '5, 2nd Main, HSR Layout', pincode: '560102', phone: me.phone },
        patient: { name: 'Lab Test', phone: me.phone, age: 40 },
        pickup: { date: day.date, window },
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.status, 'sample_scheduled');
    assert.equal(res.body.order.total, 449 + 399);
    // No lab chosen: the nearest one that collects in HSR and runs both tests is assigned.
    assert.equal(res.body.order.lab.slug, 'precision-path-hsr');
    assert.equal(res.body.order.collectionMode, 'home');
    const after = await call('GET', '/lab-collection-slots?lab=precision-path-hsr');
    const left = after.body.days.find((d: { date: string }) => d.date === day.date).windows.find((w: { window: string }) => w.window === window).remaining;
    assert.equal(left, slot.remaining - 1, 'capacity is per lab');
    const mine = await call('GET', '/orders?kind=lab', { token: me.token });
    assert.equal(mine.body.orders.length, 1);

    // Once the sample is collected and the turnaround passes, the report lands in the locker — once.
    const before = (await call('GET', '/records?kind=lab_report', { token: me.token })).body.records.length;
    await OrderModel.updateOne({ reference: res.body.order.reference }, { 'pickup.date': new Date(Date.now() - 30 * 3_600_000) });
    const ready = await call('GET', `/orders/${res.body.order.reference}`, { token: me.token });
    assert.equal(ready.body.order.status, 'report_ready');
    const reports = (await call('GET', '/records?kind=lab_report', { token: me.token })).body.records;
    assert.equal(reports.length, before + 1);
    const report = reports.find((r: { tags: string[] }) => r.tags.includes(res.body.order.reference));
    assert.ok(report.findings.length > 0, 'report has measured values');
    assert.ok(report.findings.every((f: { flag: string }) => ['normal', 'high', 'low'].includes(f.flag)));
    assert.equal(report.facility, 'Precision Path Labs, HSR Layout', 'report names the lab that ran it');
    assert.equal((await call('GET', '/records?kind=lab_report', { token: me.token })).body.records.length, before + 1, 'not filed twice');

    // A report-ready booking can no longer be cancelled.
    assert.equal((await call('PATCH', `/orders/${res.body.order.reference}/cancel`, { token: me.token })).status, 409);
  });

  test('lab visits, lab choice and serviceability rules', async () => {
    const me = await signIn();
    const patient = { name: 'Walk In', phone: me.phone };
    const firstOpen = async (lab: string, mode: string) => {
      const { body } = await call('GET', `/lab-collection-slots?lab=${lab}&mode=${mode}`);
      const day = body.days.find((d: { windows: { available: boolean }[] }) => d.windows.some((w) => w.available));
      return { date: day.date, window: day.windows.find((w: { available: boolean }) => w.available).window };
    };
    const book = (body: Record<string, unknown>) => call('POST', '/orders', { token: me.token, body: { kind: 'lab', patient, ...body } });

    // Walk-in: no address needed, lab required.
    const visitSlot = await firstOpen('curxx-collection-point-mg-road', 'lab');
    const visit = await book({ collectionMode: 'lab', labSlug: 'curxx-collection-point-mg-road', items: [{ slug: 'hba1c' }], pickup: visitSlot });
    assert.equal(visit.status, 201);
    assert.equal(visit.body.order.lab.name, 'Curxx Collection Point, MG Road');
    assert.equal(visit.body.order.address, undefined);
    assert.equal((await book({ collectionMode: 'lab', items: [{ slug: 'hba1c' }], pickup: visitSlot })).body.error, 'lab_required');

    // A walk-in point can't do a home visit, and can't run a specialised test.
    const homeSlot = await firstOpen('curxx-diagnostics-koramangala', 'home');
    const address = { line1: '12, 4th Cross, MG Road', pincode: '560001', phone: me.phone };
    assert.equal((await book({ labSlug: 'curxx-collection-point-mg-road', items: [{ slug: 'hba1c' }], address, pickup: homeSlot })).body.error, 'lab_out_of_range');
    assert.equal((await book({ collectionMode: 'lab', labSlug: 'curxx-collection-point-mg-road', items: [{ slug: 'psa-total' }], pickup: visitSlot })).body.error, 'lab_missing_tests');
    // Home collection needs an address inside Bengaluru.
    assert.equal((await book({ items: [{ slug: 'hba1c' }], pickup: homeSlot })).body.error, 'address_required');
    assert.equal((await book({ items: [{ slug: 'hba1c' }], address: { ...address, pincode: '744101' }, pickup: homeSlot })).body.error, 'not_serviceable');
    const scan = await call('GET', '/lab-tests?kind=scan&limit=1');
    assert.equal((await book({ items: [{ slug: scan.body.items[0].slug }], address, pickup: homeSlot })).body.error, 'visit_only');
    // Windows come from the chosen mode.
    assert.equal((await book({ collectionMode: 'lab', labSlug: 'medisure-diagnostics-indiranagar', items: [{ slug: 'hba1c' }], pickup: { date: visitSlot.date, window: '03:00 – 04:00 AM' } })).body.error, 'invalid_window');
  });
});

describe('records & consent', () => {
  test('uploads validate type and size; only uploads can be deleted', async () => {
    const me = await signIn();
    const base = { kind: 'lab_report', title: 'Old CBC', date: '2025-01-10', fileName: 'cbc.pdf', fileSize: 20000, mimeType: 'application/pdf' };
    assert.equal((await call('POST', '/records', { token: me.token, body: { ...base, mimeType: 'application/zip' } })).status, 400);
    assert.equal((await call('POST', '/records', { token: me.token, body: { ...base, fileSize: 50 * 1024 * 1024 } })).status, 400);
    const created = await call('POST', '/records', { token: me.token, body: base });
    assert.equal(created.status, 201);
    assert.equal((await call('DELETE', `/records/${created.body.record.id}`, { token: me.token })).status, 200);

    const issued = (await call('GET', '/records', { token: me.token })).body.records[0];
    assert.equal((await call('DELETE', `/records/${issued.id}`, { token: me.token })).status, 400);
  });

  test('grant and revoke access', async () => {
    const me = await signIn();
    const grant = await call('POST', '/access', { token: me.token, body: { granteeName: 'Dr. Test', granteeKind: 'doctor', days: 7 } });
    assert.equal(grant.status, 201);
    assert.equal(grant.body.grant.status, 'active');
    const hourly = await call('POST', '/access', { token: me.token, body: { granteeName: 'Dr. Hour', granteeKind: 'doctor', hours: 1, permission: 'download' } });
    const minutesLeft = (new Date(hourly.body.grant.expiresAt).getTime() - Date.now()) / 60000;
    assert.ok(minutesLeft > 55 && minutesLeft <= 60, 'one-hour grants expire in an hour');
    assert.equal(hourly.body.grant.permission, 'download');
    const revoked = await call('PATCH', `/access/${grant.body.grant.id}/revoke`, { token: me.token });
    assert.equal(revoked.body.grant.status, 'revoked');
    assert.equal((await call('POST', '/access', { token: me.token, body: { granteeName: 'X Y', granteeKind: 'family', scope: 'selected' } })).status, 400);
  });
});

describe('account', () => {
  test('saved doctors and articles', async () => {
    const me = await signIn();
    await call('PUT', '/me/saved/doctors/dr-priya-sharma', { token: me.token });
    await call('PUT', '/me/saved/articles/managing-heart-health', { token: me.token });
    const saved = await call('GET', '/me/saved', { token: me.token });
    assert.equal(saved.body.doctors.length, 1);
    assert.equal(saved.body.articles.length, 1);
    await call('DELETE', '/me/saved/doctors/dr-priya-sharma', { token: me.token });
    assert.equal((await call('GET', '/me/saved', { token: me.token })).body.doctors.length, 0);
    assert.equal((await call('PUT', '/me/saved/doctors/dr-nobody', { token: me.token })).status, 404);
  });

  test('addresses keep exactly one default', async () => {
    const me = await signIn();
    const a = await call('POST', '/me/addresses', { token: me.token, body: { line1: 'Flat 2, MG Road', pincode: '560001', phone: me.phone } });
    assert.equal(a.body.addresses[0].isDefault, true);
    const b = await call('POST', '/me/addresses', { token: me.token, body: { label: 'Work', line1: 'Tower B, ORR', pincode: '560103', phone: me.phone } });
    const work = b.body.addresses.find((x: { label: string }) => x.label === 'Work');
    const updated = await call('PATCH', `/me/addresses/${work.id}/default`, { token: me.token });
    assert.equal(updated.body.addresses.filter((x: { isDefault: boolean }) => x.isDefault).length, 1);
    const left = await call('DELETE', `/me/addresses/${work.id}`, { token: me.token });
    assert.equal(left.body.addresses[0].isDefault, true, 'deleting the default promotes another');
  });

  test('notifications and summary reflect activity', async () => {
    const me = await signIn();
    const summary = await call('GET', '/me/summary', { token: me.token });
    assert.equal(summary.body.records, 7);
    const notes = await call('GET', '/me/notifications', { token: me.token });
    assert.ok(notes.body.notifications.length > 0);
  });

  test('reviews: one per patient, verified only after a visit; helpful is idempotent', async () => {
    const me = await signIn();
    const body = { rating: 5, text: 'Very thorough and kind consultation.', mode: 'video' };
    const first = await call('POST', '/doctors/dr-ananya-sen/reviews', { token: me.token, body });
    assert.equal(first.status, 201);
    assert.equal(first.body.review.verified, false);
    const second = await call('POST', '/doctors/dr-ananya-sen/reviews', { token: me.token, body: { ...body, rating: 4 } });
    assert.equal(second.body.review.id, first.body.review.id, 'second review updates the first');
    assert.equal((await call('POST', '/doctors/dr-ananya-sen/reviews', { token: me.token, body: { ...body, text: 'ok' } })).status, 400);

    const id = first.body.review.id;
    const v1 = await call('POST', `/reviews/${id}/helpful`, { token: me.token });
    const v2 = await call('POST', `/reviews/${id}/helpful`, { token: me.token });
    assert.equal(v1.body.counted, true);
    assert.equal(v2.body.counted, false);
    assert.equal(v2.body.helpful, v1.body.helpful);
  });
});
