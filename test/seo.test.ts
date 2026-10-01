/**
 * Figures behind Diksha's dynamic SEO templates (docs/content-templates): city, city + specialty and
 * India doctor pages, surgery pages, and the doctor timings used by the profile copy.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { buildApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { SURGERIES } from '../src/db/data/surgeries.js';
import { DoctorModel } from '../src/models/doctor.model.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function get(url: string) {
  const res = await app.inject({ method: 'GET', url: `/api/v1${url}` });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, raw: res.body };
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
  // Also stops the mongod this file started, so the test process can exit.
  await disconnectDatabase();
});

const clinicOf = (d: { instant?: boolean | null; schedule?: { video?: string | null } | null }) =>
  !d.instant && d.schedule?.video !== 'all';
const videoOf = (d: { schedule?: { video?: string | null } | null }) =>
  (d.schedule?.video ?? 'mixed') !== 'none';

describe('dynamic SEO figures', () => {
  test('city page: counts and fee ranges follow the template rules', async () => {
    const res = await get('/seo/doctors?city=mumbai');
    assert.equal(res.status, 200);
    const s = res.body;
    const docs = await DoctorModel.find(
      { city: 'mumbai' },
      { fee: 1, videoFee: 1, instant: 1, schedule: 1, specialty: 1 },
    ).lean();
    assert.equal(s.total, docs.length);
    // Online-only doctors are not clinic doctors; video figures only count video doctors.
    const clinic = docs.filter(clinicOf);
    const video = docs.filter(videoOf);
    assert.equal(s.clinicCount, clinic.length);
    assert.equal(s.videoCount, video.length);
    assert.equal(s.clinicFee.min, Math.min(...clinic.map((d) => d.fee)));
    assert.equal(s.videoFee.max, Math.max(...video.map((d) => d.videoFee)));
    assert.equal(s.specialtyCount, new Set(docs.map((d) => d.specialty)).size);
    assert.ok(s.areas.length > 0 && s.areas[0].count >= s.areas.at(-1).count, 'areas by count');
    assert.ok(s.todayCount >= 0 && s.todayCount <= s.total);
    assert.ok(!/NaN|undefined/.test(res.raw));
  });

  test('city + specialty: fee bands, top doctors and the specialty text', async () => {
    const { status, body: s } = await get('/seo/doctors?city=mumbai&specialty=dermatologist');
    assert.equal(status, 200);
    assert.equal(s.scope.specialty.slug, 'dermatologist');
    assert.ok(s.scope.specialty.conditions.length > 0);
    assert.equal(
      s.feeBands.reduce((n: number, b: { count: number }) => n + b.count, 0),
      s.clinicCount,
    );
    assert.ok(s.topDoctors.length <= 10);
    // Ratings rank only with enough reviews: a doctor with 1–4 reviews never outranks one with 5+.
    const firstUntrusted = s.topDoctors.findIndex(
      (d: { reviewCount: number }) => d.reviewCount < 5,
    );
    if (firstUntrusted >= 0)
      assert.ok(
        s.topDoctors.slice(firstUntrusted).every((d: { reviewCount: number }) => d.reviewCount < 5),
      );
  });

  test('India pages: every city, a city table and specialty cities', async () => {
    const all = await get('/seo/doctors?city=india');
    assert.equal(all.status, 200);
    assert.equal(all.body.scope.city, null);
    assert.equal(all.body.total, await DoctorModel.countDocuments());
    assert.equal(all.body.cityCount, (await DoctorModel.distinct('city')).length);
    assert.ok(all.body.cities[0].count >= all.body.cities[1].count);
    const gp = await get('/seo/doctors?city=india&specialty=general-physician');
    assert.equal(gp.status, 200);
    assert.equal(
      gp.body.total,
      await DoctorModel.countDocuments({ specialty: 'general-physician' }),
    );
    assert.equal((await get('/seo/doctors?city=nowhere')).status, 404);
    assert.equal((await get('/seo/doctors?city=india&specialty=not-a-specialty')).status, 404);
  });

  test('surgery pages: procedures from the sheet, costs, day care and the no-cost list', async () => {
    const { status, body: s } = await get('/seo/surgeries?city=delhi');
    assert.equal(status, 200);
    assert.equal(s.procedureCount, SURGERIES.filter((x) => x.cost[1] > 0).length);
    assert.ok(s.procedureCount > 100, 'the procedure sheet is merged in');
    assert.ok(s.minCost > 0 && s.minCost < s.maxCost && s.cheapest && s.priciest);
    assert.ok(s.daycareCount > 0 && s.daycare.length === s.daycareCount);
    assert.ok(s.shortStayCount >= s.daycareCount);
    assert.ok(
      s.directory.length > 0 &&
        s.directory.every((g: { procedures: string[] }) => g.procedures.length > 0),
    );
    assert.equal(typeof s.indexable, 'boolean');
    const india = await get('/seo/surgeries?city=india');
    assert.equal(india.status, 200);
    assert.ok(india.body.cities.length > 0);
    assert.ok(india.body.minCost <= s.minCost, 'India quotes the widest range');
  });

  test('doctor profile carries its weekly hours for the timings section', async () => {
    const doctor = await DoctorModel.findOne(
      { 'schedule.days.0': { $exists: true } },
      { slug: 1 },
    ).lean();
    const { body } = await get(`/doctors/${doctor!.slug}`);
    assert.ok(body.doctor.timings.length > 0);
    assert.match(body.doctor.timings[0].hours[0], /\d:\d\d [AP]M – \d/);
    assert.ok(body.doctor.timings[0].days.length > 0);
  });

  test('single surgery template: surgeons, hospitals, areas, cities, nearby and related from real figures', async () => {
    const { status, body } = await get('/surgeries/hernia-surgery?city=mumbai');
    assert.equal(status, 200);
    const t = body.template;
    assert.ok(t, 'hernia surgery maps to a specialty');
    assert.equal(t.state, 'Maharashtra');
    const surgeons = await DoctorModel.countDocuments({
      city: 'mumbai',
      specialty: body.surgery.specialty,
    });
    assert.equal(t.surgeons.count, surgeons);
    assert.ok(t.surgeons.top.length <= 10);
    const exp = t.surgeons.top.map((d: { experienceYears: number }) => d.experienceYears);
    assert.deepEqual(
      exp,
      [...exp].sort((a, b) => b - a),
      'most experienced first',
    );
    assert.ok(t.hospitals.top.length <= 10);
    assert.ok(
      t.hospitals.top.every((h: { beds: number | null }) => h.beds === null || h.beds > 0),
      'no invented beds',
    );
    assert.ok(t.localities.length <= 8);
    assert.ok(t.cities.some((c: { slug: string }) => c.slug === 'mumbai'));
    const mumbai = t.cities.find((c: { slug: string }) => c.slug === 'mumbai');
    assert.deepEqual(mumbai.cost, body.surgery.cost, 'the same cost as the page');
    assert.equal(t.nearby.length, 5);
    assert.ok(!t.nearby.some((c: { slug: string }) => c.slug === 'mumbai'));
    assert.ok(t.related.length > 0 && t.related.length <= 6);
  });
});
