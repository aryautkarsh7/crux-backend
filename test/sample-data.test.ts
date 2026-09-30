/**
 * Sample data off (SHOW_SAMPLE_DATA=false, as on the live site): the website shows only imported and
 * admin-added doctors, facilities, reviews and testimonials; the admin panel sees everything; and the
 * catalogue sync never brings sample data back.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { syncCatalogue } from '../src/db/catalogue.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { withSampleData } from '../src/lib/sample-data.js';
import { ensureSlots } from '../src/lib/slot-gen.js';
import { ArticleModel } from '../src/models/article.model.js';
import { DoctorModel } from '../src/models/doctor.model.js';
import { FacilityModel } from '../src/models/facility.model.js';
import { ReviewModel } from '../src/models/review.model.js';
import { SlotModel } from '../src/models/slot.model.js';
import { TestimonialModel } from '../src/models/site.model.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin = '';

const IMPORTED = 'dr-sampletest-imported';
const CLINIC = 'sampletest-clinic-andheri';
const STORY = 'sampletest-story';
const REAL = { $or: [{ managed: true }, { source: { $nin: [null, ''] } }], sample: { $ne: true } };

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {}, payload: opts.body as object | undefined });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}
const get = (url: string) => call('GET', url);

/** Counts with sample data in view, whatever the flag says. */
const all = <T>(fn: () => Promise<T>) => withSampleData(fn);

async function signIn() {
  const phone = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const otp = await call('POST', '/auth/otp/request', { body: { phone } });
  const verified = await call('POST', '/auth/otp/verify', { body: { phone, code: otp.body.devCode } });
  assert.equal(verified.status, 200);
  return verified.body.token as string;
}

async function cleanUp() {
  await all(() => Promise.all([
    DoctorModel.deleteMany({ slug: IMPORTED }),
    FacilityModel.deleteMany({ slug: CLINIC }),
    ReviewModel.deleteMany({ doctorSlug: IMPORTED }),
    TestimonialModel.deleteMany({ slug: STORY }),
  ]));
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  env.SHOW_SAMPLE_DATA = false;
  await cleanUp();
  // An imported clinic and doctor, shaped like scripts/import-doctar.ts writes them.
  await FacilityModel.create({
    slug: CLINIC, name: 'Sampletest Clinic', shortName: 'Sampletest Clinic', type: 'clinic', category: 'Clinic', city: 'mumbai', area: 'Andheri West',
    address: '1 Test Road, Andheri West, Mumbai', phone: '02212345678', rating: 0, reviewCount: 0, source: 'doctar', doctarId: 'sampletest-f1',
  });
  await DoctorModel.create({
    slug: IMPORTED, name: 'Dr. Sampletest Imported', qualification: 'MBBS, MD', title: 'General Physician', specialty: 'general-physician',
    city: 'mumbai', area: 'Andheri West', clinicName: 'Sampletest Clinic', facilitySlug: CLINIC, gender: 'female', experienceYears: 12, fee: 500, videoFee: 500,
    rating: 0, reviewCount: 0, recommendPercent: 0, verified: false, bookable: false, feeVerified: false, source: 'doctar', doctarId: 'sampletest-d1',
    schedule: { days: [1, 2, 3, 4, 5, 6], sessions: [{ start: '10:00', end: '13:00' }], step: 30, video: 'none' },
  });
  const login = await call('POST', '/admin/auth/login', { body: { email: 'admin@curxx.test', password: 'test-admin-password' } });
  admin = login.body.token;
});

after(async () => {
  await cleanUp();
  env.SHOW_SAMPLE_DATA = true;
  await app.close();
  await disconnectDatabase();
});

describe('sample data hidden from the website', () => {
  test('the test database has sample data to hide', async () => {
    assert.ok((await all(() => DoctorModel.countDocuments({ city: 'mumbai', sample: true }))) > 50);
    assert.ok((await all(() => FacilityModel.countDocuments({ city: 'mumbai', sample: true }))) > 5);
    assert.ok((await all(() => ReviewModel.countDocuments({ sample: true }))) > 1000);
  });

  test('doctor listings, profiles, reviews and slots', async () => {
    const list = await get('/doctors?city=mumbai&limit=50');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, await all(() => DoctorModel.countDocuments({ city: 'mumbai', ...REAL })));
    assert.ok(list.body.doctors.some((d: { slug: string }) => d.slug === IMPORTED));
    assert.ok(list.body.doctors.every((d: { source?: string; managed?: boolean }) => d.source || d.managed), 'no seed doctors');
    const facets = list.body.facets.areas.reduce((n: number, a: { count: number }) => n + a.count, 0);
    assert.equal(facets, list.body.total, 'facet counts leave sample doctors out too');

    const seed = (await all(() => DoctorModel.findOne({ city: 'mumbai', sample: true }, { slug: 1 }).lean()))!;
    assert.equal((await get(`/doctors/${seed.slug}`)).status, 404);
    assert.equal((await get(`/doctors/${seed.slug}/reviews`)).status, 404);
    assert.equal((await get(`/doctors/${seed.slug}/slots`)).status, 404);

    const profile = await get(`/doctors/${IMPORTED}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.facility.slug, CLINIC);
    assert.ok(profile.body.similar.every((d: { source?: string; managed?: boolean }) => d.source || d.managed));
    assert.equal(profile.body.doctor.reviewSummary.total, 0);

    const specialties = await get('/specialties?city=mumbai');
    const gp = specialties.body.specialties.find((s: { slug: string }) => s.slug === 'general-physician');
    assert.equal(gp.doctorCount, await all(() => DoctorModel.countDocuments({ city: 'mumbai', specialty: 'general-physician', ...REAL })));
    const cities = await get('/cities');
    assert.equal(cities.body.cities.find((c: { slug: string }) => c.slug === 'mumbai').doctorCount, list.body.total);
  });

  test('facilities, search and suggestions', async () => {
    const list = await get('/facilities?city=mumbai&limit=60');
    assert.equal(list.body.total, await all(() => FacilityModel.countDocuments({ city: 'mumbai', ...REAL })));
    assert.ok(list.body.items.some((f: { slug: string; doctorCount: number }) => f.slug === CLINIC && f.doctorCount === 1));
    const seed = (await all(() => FacilityModel.findOne({ city: 'mumbai', sample: true }, { slug: 1 }).lean()))!;
    assert.equal((await get(`/facilities/${seed.slug}`)).status, 404);
    const clinic = await get(`/facilities/${CLINIC}`);
    assert.deepEqual(clinic.body.doctors.map((d: { slug: string }) => d.slug), [IMPORTED]);

    const search = await get('/search?q=general&city=mumbai');
    assert.ok(search.body.doctors.length >= 1);
    assert.ok(search.body.doctors.every((d: { source?: string; managed?: boolean }) => d.source || d.managed));
    const suggest = await get('/search/suggest?q=dr&city=mumbai');
    const listed = new Set(await all(() => DoctorModel.distinct('slug', { city: 'mumbai', ...REAL })));
    assert.ok(suggest.body.doctors.every((d: { slug: string }) => listed.has(d.slug)));
    const listedFacilities = new Set(await all(() => FacilityModel.distinct('slug', { city: 'mumbai', ...REAL })));
    assert.ok(suggest.body.facilities.every((f: { slug: string }) => listedFacilities.has(f.slug)));
  });

  test('SEO figures and site stats count real records only', async () => {
    const city = await get('/seo/doctors?city=mumbai');
    assert.equal(city.body.total, await all(() => DoctorModel.countDocuments({ city: 'mumbai', ...REAL })));
    const india = await get('/seo/doctors?city=india');
    assert.equal(india.body.total, await all(() => DoctorModel.countDocuments(REAL)));
    const surgeries = await get('/seo/surgeries?city=mumbai');
    assert.equal(surgeries.body.hospitalCount, await all(() => FacilityModel.countDocuments({ city: 'mumbai', type: 'hospital', ...REAL })));

    const { stats } = (await get('/site/stats')).body;
    assert.equal(stats.doctors, await all(() => DoctorModel.countDocuments(REAL)));
    assert.equal(stats.facilities, await all(() => FacilityModel.countDocuments(REAL)));
    assert.equal(stats.reviews, await all(() => ReviewModel.countDocuments({ sample: { $ne: true }, $or: [{ user: { $ne: null } }, { managed: true }] })));
  });

  test('the sitemap lists only pages with real doctors or facilities', async () => {
    const res = await get('/seo/sitemap');
    assert.equal(res.status, 200);
    const { cities, india, doctors, facilities } = res.body;
    assert.equal(doctors.length, await all(() => DoctorModel.countDocuments(REAL)));
    assert.ok(doctors.some((d: { slug: string }) => d.slug === IMPORTED));
    assert.equal(facilities.length, await all(() => FacilityModel.countDocuments(REAL)));
    const mumbai = cities.find((c: { slug: string }) => c.slug === 'mumbai');
    assert.deepEqual(mumbai.specialties, (await all(() => DoctorModel.distinct('specialty', { city: 'mumbai', ...REAL }))).sort());
    assert.ok(mumbai.localities.doctors.includes('andheri-west') && mumbai.localities['general-physician'].includes('andheri-west'));
    assert.ok(mumbai.conditions.includes('fever'), 'condition pages for specialties with doctors');
    assert.ok(!mumbai.conditions.includes('acne') || mumbai.specialties.includes('dermatologist'));
    for (const c of cities) assert.ok(c.doctors > 0 || c.hospitals + c.clinics > 0 || c.surgeries.length > 0, `${c.slug} has something to list`);
    assert.ok(india.specialties.includes('general-physician'));
  });

  test('conditions pages say when nobody is listed yet', async () => {
    const res = await get('/conditions/acne?city=patna');
    assert.equal(res.status, 200);
    assert.equal(res.body.doctorCount, await all(() => DoctorModel.countDocuments({ city: 'patna', specialty: res.body.condition.specialty, ...REAL })));
    if (res.body.doctorCount === 0) assert.match(res.body.faqs[0].answer, /are listed on Curxx yet/);
    assert.doesNotMatch(JSON.stringify(res.body.faqs), /verified/i);
  });

  test('testimonials and marketing claims need a person to confirm them', async () => {
    assert.equal((await all(() => TestimonialModel.countDocuments({ sample: true }))) > 0, true);
    const seeded = new Set(await all(() => TestimonialModel.distinct('slug', { sample: true })));
    const shown = async (audience: string) => ((await get(`/testimonials?audience=${audience}`)).body.testimonials as { slug: string }[]).map((t) => t.slug);
    assert.ok((await shown('patient')).every((slug) => !seeded.has(slug)));
    assert.ok((await shown('provider')).every((slug) => !seeded.has(slug)));
    const created = await call('POST', '/admin/testimonials', { token: admin, body: { slug: STORY, name: 'Asha K.', text: 'Found a clinic near home in minutes.', audience: 'patient', rating: 5 } });
    assert.equal(created.status, 201);
    assert.ok((await shown('patient')).includes(STORY), 'stories added in the admin show');

    let settings = (await get('/site/settings')).body.settings;
    assert.equal(settings['claim-consultations'], undefined, 'seeded claims are hidden');
    assert.ok(settings['image-home-hero'], 'other settings stay');
    const confirmed = await call('PATCH', '/admin/site-settings/claim-app-rating', { token: admin, body: { value: '4.5' } });
    assert.equal(confirmed.status, 200);
    settings = (await get('/site/settings')).body.settings;
    assert.equal(settings['claim-app-rating'], '4.5');
    // Leave the seeded claim as the next sync would find it.
    await call('PATCH', '/admin/site-settings/claim-app-rating', { token: admin, body: { value: '4.9' } });
    await all(() => mongoose.connection.collection('sitesettings').updateOne({ slug: 'claim-app-rating' }, { $set: { managed: false } }));
  });

  test('articles keep their text, but a hidden author becomes the editorial team', async () => {
    const article = (await all(() => ArticleModel.findOne({ 'author.slug': { $nin: [null, ''] } }, { slug: 1, author: 1 }).lean()))!;
    assert.equal(await DoctorModel.exists({ slug: article.author!.slug }), null, 'the author is a sample doctor');
    const res = await get(`/articles/${article.slug}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.article.author, { slug: '', name: 'Curxx Editorial Team', title: '' });
    assert.equal(res.body.author, null);
    assert.ok(res.body.article.sections.length > 0);
    const list = await get('/articles?limit=30');
    const listed = new Set(await all(() => DoctorModel.distinct('slug', REAL)));
    assert.ok(list.body.items.every((a: { author?: { slug: string } }) => !a.author?.slug || listed.has(a.author.slug)));
  });

  test('patients can review a real doctor, but not book a sample one', async () => {
    const token = await signIn();
    const review = await call('POST', `/doctors/${IMPORTED}/reviews`, { token, body: { rating: 5, text: 'Listened carefully and explained the plan.', mode: 'clinic' } });
    assert.equal(review.status, 201);
    const reviews = await get(`/doctors/${IMPORTED}/reviews`);
    assert.equal(reviews.body.total, 1);
    assert.equal((await get(`/doctors/${IMPORTED}`)).body.doctor.reviewSummary.total, 1);

    const seed = (await all(() => DoctorModel.findOne({ city: 'mumbai', sample: true, 'schedule.days.0': { $exists: true } }).lean()))!;
    await all(() => ensureSlots([seed] as never));
    const slot = (await all(() => SlotModel.findOne({ doctorSlug: seed.slug, status: 'open', startsAt: { $gt: new Date(Date.now() + 3_600_000) } }).lean()))!;
    const book = await call('POST', '/appointments', { token, body: { slotId: String(slot._id), patient: { name: 'Test Patient', phone: '9876501234' } } });
    assert.equal(book.status, 404);
    await all(() => SlotModel.updateOne({ _id: slot._id }, { $set: { status: 'open' } }));
  });
});

describe('admin panel sees everything', () => {
  test('sample vs real filter', async () => {
    const sample = await call('GET', '/admin/doctors?city=mumbai&sample=true&limit=5', { token: admin });
    assert.equal(sample.status, 200);
    assert.equal(sample.body.total, await all(() => DoctorModel.countDocuments({ city: 'mumbai', sample: true })));
    assert.ok(sample.body.items.every((d: { sample: boolean }) => d.sample === true));
    const real = await call('GET', '/admin/doctors?city=mumbai&sample=false&limit=100', { token: admin });
    assert.ok(real.body.items.some((d: { slug: string; sample: boolean }) => d.slug === IMPORTED && d.sample === false));
    assert.equal((await call('GET', '/admin/facilities?city=mumbai&sample=true&limit=1', { token: admin })).body.total > 0, true);
    assert.equal((await call('GET', '/admin/reviews?sample=true&limit=1', { token: admin })).body.total > 0, true);
  });

  test('editing a sample doctor keeps it off the website until it is marked real', async () => {
    const seed = (await all(() => DoctorModel.findOne({ city: 'mumbai', sample: true, managed: { $ne: true } }).lean()))!;
    try {
      assert.equal((await call('GET', `/admin/doctors/${seed.slug}`, { token: admin })).status, 200);
      const edited = await call('PATCH', `/admin/doctors/${seed.slug}`, { token: admin, body: { fee: seed.fee + 100 } });
      assert.equal(edited.status, 200);
      assert.equal((await get(`/doctors/${seed.slug}`)).status, 404, 'managed now, but still sample');
      assert.equal((await call('PATCH', `/admin/doctors/${seed.slug}`, { token: admin, body: { sample: false } })).status, 200);
      assert.equal((await get(`/doctors/${seed.slug}`)).status, 200, 'marked real in the admin');
    } finally {
      await all(() => DoctorModel.updateOne({ slug: seed.slug }, { $set: { fee: seed.fee, managed: false, sample: true } }));
    }
  });
});

describe('catalogue sync with sample data off', () => {
  test('never re-creates or re-shows sample data, and flags what it finds', async () => {
    const doctor = (await all(() => DoctorModel.findOne({ city: 'pune', sample: true, managed: { $ne: true } }).lean()))!;
    const facility = (await all(() => FacilityModel.findOne({ city: 'pune', sample: true, managed: { $ne: true } }).lean()))!;
    const story = (await all(() => TestimonialModel.findOne({ sample: true }).lean()))!;
    const reviews = await all(() => ReviewModel.countDocuments({ doctorSlug: doctor.slug }));
    assert.ok(reviews > 0);
    await all(() => Promise.all([
      DoctorModel.deleteOne({ slug: doctor.slug }),
      FacilityModel.deleteOne({ slug: facility.slug }),
      TestimonialModel.deleteOne({ slug: story.slug }),
      ReviewModel.deleteMany({ doctorSlug: doctor.slug }),
    ]));
    // A stored seed doctor that was never flagged (as on the live database before this change).
    const unflagged = (await all(() => DoctorModel.findOne({ city: 'pune', sample: true, slug: { $ne: doctor.slug } }).lean()))!;
    await all(() => DoctorModel.updateOne({ slug: unflagged.slug }, { $unset: { sample: 1 } }));
    assert.equal((await get(`/doctors/${unflagged.slug}`)).status, 404, 'hidden even before the sync flags it');

    await syncCatalogue();
    assert.equal(await all(() => DoctorModel.exists({ slug: doctor.slug })), null);
    assert.equal(await all(() => FacilityModel.exists({ slug: facility.slug })), null);
    assert.equal(await all(() => TestimonialModel.exists({ slug: story.slug })), null);
    assert.equal(await all(() => ReviewModel.countDocuments({ doctorSlug: doctor.slug })), 0);
    assert.equal((await all(() => DoctorModel.findOne({ slug: unflagged.slug }, { sample: 1 }).lean()))?.sample, true);
    assert.ok(await DoctorModel.exists({ slug: IMPORTED }), 'imported doctors are untouched');
    const stories = ((await get('/testimonials?audience=patient')).body.testimonials as { slug: string }[]).map((t) => t.slug);
    assert.ok(stories.includes(STORY) && !stories.includes(story.slug));

    // Turning sample data back on (tests, demos) restores it.
    env.SHOW_SAMPLE_DATA = true;
    try {
      await syncCatalogue();
      assert.ok(await DoctorModel.exists({ slug: doctor.slug }));
      assert.ok(await FacilityModel.exists({ slug: facility.slug }));
      assert.ok(await TestimonialModel.exists({ slug: story.slug }));
      assert.ok((await ReviewModel.countDocuments({ doctorSlug: doctor.slug })) > 0);
    } finally {
      env.SHOW_SAMPLE_DATA = false;
    }
  });
});
