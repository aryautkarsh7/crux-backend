/**
 * The Doctar directory (src/modules/doctar) against an in-memory stand-in for Doctar's database: which
 * records are listed, slugs, overlays from the admin panel, listings / SEO / sitemap reading the union,
 * behaviour while Doctar is down, and that nothing ever writes to Doctar.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { Types } from 'mongoose';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { DoctorModel } from '../src/models/doctor.model.js';
import { clearDetailCache } from '../src/modules/doctar/detail.js';
import { directoryStatus, loadSavedIndex, refreshDirectory, useDoctarSource } from '../src/modules/doctar/directory.js';
import { DirectoryCacheModel, DoctarOverlayModel } from '../src/modules/doctar/models.js';
import { placeName } from '../src/modules/doctar/mapping.js';
import { memoryDoctarSource, type DoctarSource } from '../src/modules/doctar/source.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin = '';

const id = () => new Types.ObjectId();
const H1 = id();
const H2 = id();
const D = { asha: id(), noGender: id(), generic: id(), org: id(), noQual: id(), clash: id(), badSlug: id(), faraway: id(), hiddenLater: id() };
let clashSlug = '';

const week = {
  monday: { isAvailable: true, slots: [{ startTime: '10:00', endTime: '13:00' }] },
  wednesday: { isAvailable: true, slots: [{ startTime: '10:00', endTime: '13:00' }] },
};
const doctor = (over: Record<string, unknown>) => ({
  qualification: 'MBBS, MD', experience: 12, specialization: 'General Physician', location: 'Mumbai', consultationFee: 600, feeSource: 'doctor',
  isAdminVerified: true, gender: 'female', clinicName: 'Testcare Clinic', ...over,
});

function fixtures() {
  return {
    hospitals: [
      { _id: H1, slug: 'testcare-hospital-andheri', name: 'Testcare Hospital', type: 'hospital', city: 'Mumbai', locality: 'Andheri West', address: '1 Test Road, Andheri West, Mumbai', pincode: '400053' },
      { _id: H2, slug: 'testcare-pharmacy', name: 'Testcare Pharmacy', type: 'pharmacy', city: 'Mumbai', address: '2 Test Road, Mumbai' },
    ],
    doctors: [
      doctor({ _id: D.asha, slug: 'dr-asha-testdoctor', firstName: 'Asha', lastName: 'Testdoctor', registrationNumber: 'MMC-2011-12345' }),
      doctor({ _id: D.noGender, slug: 'dr-ravi-nogender', firstName: 'Ravi', lastName: 'Nogender', gender: undefined, isAdminVerified: false }),
      doctor({ _id: D.generic, slug: 'santosh-doctor', firstName: 'Santosh', lastName: 'Doctor' }),
      doctor({ _id: D.org, slug: 'apollo-clinic', firstName: 'Apollo', lastName: 'Clinic' }),
      doctor({ _id: D.noQual, slug: 'dr-no-qual', firstName: 'Neha', lastName: 'Noqual', qualification: '' }),
      doctor({ _id: D.clash, slug: 'CLASH', firstName: 'Clash', lastName: 'Testdoctor' }),
      doctor({ _id: D.badSlug, slug: 'Bad Slug!', firstName: 'Meera', lastName: 'Badslug', clinicName: 'Meera Clinic | Best Physician near me Andheri' }),
      doctor({ _id: D.faraway, slug: 'dr-far-away', firstName: 'Far', lastName: 'Away', location: 'Atlantis' }),
      doctor({ _id: D.hiddenLater, slug: 'dr-kiran-hideme', firstName: 'Kiran', lastName: 'Hideme' }),
    ],
    doctorschedules: [{ _id: id(), doctor: D.asha, hospital: H1, weeklySchedule: week, slotDuration: 20, consultationFee: 700, isActive: true }],
  };
}

async function call(method: string, url: string, body?: unknown) {
  const res = await app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: admin && url.startsWith('/admin') ? { authorization: `Bearer ${admin}` } : {}, payload: body as object | undefined });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}
const get = (url: string) => call('GET', url);

/** A fresh directory from these Doctar records (as if just rebuilt). */
async function useDoctar(source: DoctarSource) {
  useDoctarSource(source);
  clearDetailCache();
  await refreshDirectory();
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  await Promise.all([DoctarOverlayModel.deleteMany({}), DirectoryCacheModel.deleteMany({})]);
  // A Curxx doctor whose slug a Doctar record also uses.
  const curxx = await DoctorModel.findOne({ city: 'mumbai' }, { slug: 1 }).lean();
  clashSlug = curxx!.slug;
  const data = fixtures();
  (data.doctors.find((d) => d._id === D.clash) as { slug: string }).slug = clashSlug;
  await useDoctar(memoryDoctarSource(data));
  const login = await call('POST', '/admin/auth/login', { email: 'admin@curxx.test', password: 'test-admin-password' });
  admin = login.body.token;
});

after(async () => {
  useDoctarSource(null);
  await Promise.all([DoctarOverlayModel.deleteMany({}), DirectoryCacheModel.deleteMany({})]);
  await app.close();
  await disconnectDatabase();
});

describe('Doctar directory', () => {
  test('lists real people in Curxx cities and specialties, and counts what it skipped', () => {
    const s = directoryStatus();
    assert.equal(s.status, 'ready');
    assert.equal(s.from, 'doctar');
    // Atlantis isn't a Curxx city, so that doctor isn't even read.
    assert.equal(s.report!.scanned, 8);
    assert.equal(s.doctors, 5, 'asha, no-gender, clash, bad slug, hide-me');
    assert.equal(s.facilities, 1, 'the pharmacy is not a medical facility type');
    assert.equal(s.report!.skippedDoctors['generic name (a role, e.g. "Specialist")'], 1);
    assert.equal(s.report!.skippedDoctors['organisation, not a person'], 1);
    assert.equal(s.report!.skippedDoctors['no qualification'], 1);
    assert.equal(s.report!.skippedFacilities['not a medical facility type'], 1);
  });

  test('a Doctar doctor appears in the listing like any other, listing-only and unrated', async () => {
    const res = await get('/doctors?city=mumbai&specialty=general-physician&limit=50');
    assert.equal(res.status, 200);
    assert.equal(res.body.unavailable, false);
    const asha = res.body.doctors.find((d: { slug: string }) => d.slug === 'dr-asha-testdoctor');
    assert.ok(asha, 'listed');
    assert.equal(asha.source, 'doctar');
    assert.equal(asha.booking, 'none', 'Call / Visit only while IMPORTED_BOOKABLE is off');
    assert.equal(asha.rating, 0);
    assert.equal(asha.gender, 'female');
    assert.equal(asha.fee, 600, "the doctor's own fee wins over the schedule's");
    assert.equal(asha.facilitySlug, 'testcare-hospital-andheri');
    assert.equal(asha.area, 'Andheri West');
    const ravi = res.body.doctors.find((d: { slug: string }) => d.slug === 'dr-ravi-nogender');
    assert.ok(ravi && !('gender' in ravi), 'no gender is stored when Doctar has none');
    for (const slug of ['santosh-doctor', 'apollo-clinic', 'dr-no-qual', 'dr-far-away']) assert.ok(!res.body.doctors.some((d: { slug: string }) => d.slug === slug), `${slug} is not listed`);
    // Facets and totals count Doctar doctors too.
    assert.ok(res.body.facets.areas.some((a: { value: string; count: number }) => a.value === 'Andheri West' && a.count >= 1));
    const cities = await get('/cities');
    assert.ok(cities.body.cities.find((c: { slug: string }) => c.slug === 'mumbai').doctorCount >= 5, 'city counts include Doctar doctors');
  });

  test('slugs: Doctar’s when clean, a clean one with a short id otherwise, and Curxx keeps a clashing slug', async () => {
    const all = await get('/doctors?city=mumbai&specialty=general-physician&limit=50');
    const slugs = all.body.doctors.map((d: { slug: string }) => d.slug);
    assert.ok(slugs.includes(`dr-meera-badslug-${String(D.badSlug).slice(-6)}`), 'unusable Doctar slug → name + id');
    const meera = all.body.doctors.find((d: { slug: string }) => d.slug.startsWith('dr-meera-badslug'));
    assert.equal(meera.clinicName, 'Meera Clinic', 'search-ad tails are cut from clinic names');
    assert.ok(slugs.includes(`${clashSlug}-${String(D.clash).slice(-6)}`), 'clash → suffix on the Doctar record');
    const curxx = await get(`/doctors/${clashSlug}`);
    assert.equal(curxx.status, 200);
    assert.notEqual(curxx.body.doctor.source, 'doctar', "the Curxx doctor keeps the URL");
  });

  test('profile and hospital pages read Doctar live, including page-only fields', async () => {
    const res = await get('/doctors/dr-asha-testdoctor');
    assert.equal(res.status, 200);
    assert.equal(res.body.doctor.registration, 'MMC-2011-12345', 'registration comes from the detail read');
    assert.equal(res.body.facility.slug, 'testcare-hospital-andheri');
    const hospital = await get('/facilities/testcare-hospital-andheri');
    assert.equal(hospital.status, 200);
    assert.equal(hospital.body.facility.openHours, '', 'no hours in Doctar: none invented');
    assert.ok(hospital.body.doctors.some((d: { slug: string }) => d.slug === 'dr-asha-testdoctor'));
    const list = await get('/facilities?city=mumbai&type=hospital&limit=50');
    const h = list.body.items.find((f: { slug: string }) => f.slug === 'testcare-hospital-andheri');
    assert.ok(h, 'in the hospitals listing');
    assert.equal(h.doctorCount, 1);
    assert.equal((await get('/doctors/santosh-doctor')).status, 404);
  });

  test('SEO figures, search and the sitemap include Doctar records', async () => {
    const listing = await get('/doctors?city=mumbai&specialty=general-physician&limit=1');
    const stats = await get('/seo/doctors?city=mumbai&specialty=general-physician');
    assert.equal(stats.status, 200);
    assert.equal(stats.body.total, listing.body.total, "the copy counts the same doctors as the listing");
    const search = await get('/search?q=Testdoctor&city=mumbai');
    assert.ok(search.body.doctors.some((d: { slug: string }) => d.slug === 'dr-asha-testdoctor'));
    const index = await get('/seo/sitemap/index');
    assert.equal(index.status, 200);
    assert.ok(!('doctors' in index.body), 'the index leaves the long lists out');
    assert.ok(index.body.counts.doctors >= 5 && index.body.partSize === 45_000);
    const part = await get('/seo/sitemap/doctors?part=0');
    assert.equal(part.body.entries.length, index.body.counts.doctors);
    assert.ok(part.body.entries.some((e: { slug: string }) => e.slug === 'dr-asha-testdoctor'));
    assert.equal((await get('/seo/sitemap/doctors?part=1')).body.entries.length, 0);
    const facilities = await get('/seo/sitemap/facilities?part=0');
    assert.ok(facilities.body.entries.some((e: { slug: string }) => e.slug === 'testcare-hospital-andheri'));
  });

  test('admin: overlays hide, rank and adjust Doctar records without touching Doctar', async () => {
    const list = await get('/admin/doctar/doctors?city=mumbai&q=Hideme');
    assert.equal(list.status, 200);
    assert.equal(list.body.items.length, 1);
    const kiran = list.body.items[0];
    assert.equal(kiran.liveSlug, 'dr-kiran-hideme');

    const hide = await call('PUT', `/admin/doctar/overlays/doctor/${kiran.doctarId}`, { hidden: true, note: 'duplicate profile' });
    assert.equal(hide.status, 200);
    assert.equal((await get('/doctors/dr-kiran-hideme')).status, 404, 'hidden at once');
    const hiddenList = await get('/admin/doctar/doctors?overlay=hidden');
    assert.ok(hiddenList.body.items.some((d: { doctarId: string }) => d.doctarId === kiran.doctarId), 'the admin still sees it');

    const bad = await call('PUT', `/admin/doctar/overlays/doctor/${kiran.doctarId}`, { photoUrl: 'http://insecure.example/x.jpg' });
    assert.equal(bad.status, 400);
    assert.equal((await call('PUT', `/admin/doctar/overlays/doctor/${new Types.ObjectId()}`, { hidden: true })).status, 404);

    // Rankings board: Doctar records rank through overlays.
    const board = await get('/admin/rankings?type=doctors&city=mumbai&specialty=general-physician');
    assert.ok(board.body.items.some((d: { slug: string; source?: string }) => d.slug === 'dr-asha-testdoctor' && d.source === 'doctar'));
    const saved = await call('POST', '/admin/rankings', { type: 'doctors', ranks: [{ slug: 'dr-asha-testdoctor', rank: 1 }] });
    assert.equal(saved.status, 200);
    const first = await get('/doctors?city=mumbai&specialty=general-physician&limit=1');
    assert.equal(first.body.doctors[0].slug, 'dr-asha-testdoctor', 'rank 1 leads the listing');

    await call('DELETE', `/admin/doctar/overlays/doctor/${kiran.doctarId}`);
    await call('DELETE', `/admin/doctar/overlays/doctor/${String(D.asha)}`);
    assert.equal((await get('/doctors/dr-kiran-hideme')).status, 200, 'back to Doctar’s record');
    assert.equal((await get('/admin/doctar/status')).body.overlays, 0);
  });

  test('verified-only setting lists only Doctar’s admin-verified doctors', async (t) => {
    t.after(() => (env.DOCTAR_VERIFIED_ONLY = false));
    env.DOCTAR_VERIFIED_ONLY = true;
    await useDoctar(memoryDoctarSource(fixtures()));
    assert.equal((await get('/doctors/dr-ravi-nogender')).status, 404);
    assert.equal((await get('/doctors/dr-asha-testdoctor')).status, 200);
    env.DOCTAR_VERIFIED_ONLY = false;
    await useDoctar(memoryDoctarSource(fixtures()));
    assert.equal((await get('/doctors/dr-ravi-nogender')).status, 200);
  });

  test('Doctar down: the saved copy keeps the site up; with nothing saved, pages say so instead of 404', async () => {
    // The last good build was saved gzipped in the Curxx DB.
    assert.ok((await DirectoryCacheModel.countDocuments({})) >= 1);
    const down = memoryDoctarSource(fixtures(), { failing: () => true });
    useDoctarSource(down);
    clearDetailCache();
    const unavailable = await get('/doctors?city=mumbai&specialty=general-physician');
    assert.equal(unavailable.status, 200);
    assert.equal(unavailable.body.unavailable, true);
    assert.equal(unavailable.headers['cache-control'], 'no-store', 'an incomplete list is never cached by a CDN');
    assert.equal((await get('/doctors/dr-asha-testdoctor')).status, 503, 'not a 404 that would drop the page from search');
    assert.equal((await get('/facilities/testcare-hospital-andheri')).status, 503);
    assert.equal((await get('/doctors/no-such-doctor-anywhere')).status, 503);

    assert.equal(await loadSavedIndex(), true);
    assert.equal(directoryStatus().from, 'cache');
    const back = await get('/doctors?city=mumbai&specialty=general-physician&limit=50');
    assert.equal(back.body.unavailable, false);
    assert.ok(back.body.doctors.some((d: { slug: string }) => d.slug === 'dr-asha-testdoctor'));
    // The profile falls back to the listing copy when the live read fails (no hang, no crash).
    const profile = await get('/doctors/dr-asha-testdoctor');
    assert.equal(profile.status, 200);
    assert.equal(profile.body.doctor.name, 'Dr. Asha Testdoctor');

    // A failed rebuild keeps serving what's there.
    await refreshDirectory();
    assert.equal(directoryStatus().status, 'ready');
    assert.match(directoryStatus().error ?? '', /unavailable/);
    await useDoctar(memoryDoctarSource(fixtures()));
  });

  test('clinic and hospital names lose search-ad tails; pure adverts are dropped', () => {
    const cases: [string, string][] = [
      ['Nova IVF Fertility Centre - Best IVF Center in Naroda, Ahmedabad', 'Nova IVF Fertility Centre'],
      ['Mila Aesthetics—Hair Transplant, Best Cosmetic Surgery Clinic in Bodakdev', 'Mila Aesthetics'],
      ['Dr. Sameer Dani, 27+ yrs of Exp', 'Dr. Sameer Dani'],
      ['𝐃𝐫. 𝐏𝐫𝐢𝐲𝐚𝐧𝐤 𝐆𝐮𝐩𝐭𝐚 - Best Joint Replacement Surgeon in Ahmedabad', 'Dr. Priyank Gupta'],
      ['DIVINE AYURVEDA : BEST AYURVEDIC HOSPITAL IN AHMEDABAD', 'DIVINE AYURVEDA'],
      ['Best Radiologist in Bangalore', ''],
      ['Best Urologist - Dr Sudharsan', ''],
      ['12 Yrs of Exp', ''],
      ['Best Hospital', 'Best Hospital'],
      ['7 Orange Hospitals', '7 Orange Hospitals'],
      ['Rainbow Children’s Hospital: Banjara Hills', 'Rainbow Children’s Hospital: Banjara Hills'],
    ];
    for (const [raw, clean] of cases) assert.equal(placeName(raw), clean, raw);
  });

  test('nothing writes to Doctar: the connection only reads', () => {
    const code = readFileSync(new URL('../src/modules/doctar/source.ts', import.meta.url), 'utf8');
    for (const write of ['insert', 'update', 'delete', 'replace', 'bulkWrite', 'drop', 'createIndex', 'findOneAnd', 'save(', 'rename']) {
      assert.ok(!code.includes(`.${write}`), `source.ts must not call .${write}`);
    }
    assert.match(code, /secondaryPreferred/);
    assert.match(code, /autoIndex: false/);
  });
});
