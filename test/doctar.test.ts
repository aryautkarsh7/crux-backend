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
import {
  directoryStatus,
  loadSavedIndex,
  refreshDirectory,
  useDoctarSource,
} from '../src/modules/doctar/directory.js';
import { setProviders, type SmsMessage } from '../src/lib/notify/providers.js';
import { AppointmentRequestModel } from '../src/models/appointment-request.model.js';
import { DirectoryCacheModel, DoctarOverlayModel } from '../src/modules/doctar/models.js';
import { mappingContext, placeName, withoutPlace } from '../src/modules/doctar/mapping.js';
import { memoryDoctarSource, type DoctarSource } from '../src/modules/doctar/source.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let admin = '';

const id = () => new Types.ObjectId();
const H1 = id();
const H2 = id();
const H3 = id();
/** Doctar's scraped hospital photos (an advert banner, an unrelated close-up). */
const COVER = 'https://doctar.example/scraped/banner-ad.jpg';
const GALLERY = 'https://doctar.example/scraped/teeth-close-up.jpg';
const D = {
  asha: id(),
  noGender: id(),
  generic: id(),
  org: id(),
  noQual: id(),
  clash: id(),
  badSlug: id(),
  faraway: id(),
  hiddenLater: id(),
};
let clashSlug = '';

const week = {
  monday: { isAvailable: true, slots: [{ startTime: '10:00 AM', endTime: '01:00 PM' }] },
  wednesday: { isAvailable: true, slots: [{ startTime: '10:00 AM', endTime: '01:00 PM' }] },
};
const doctor = (over: Record<string, unknown>) => ({
  qualification: 'MBBS, MD',
  experience: 12,
  specialization: 'General Physician',
  location: 'Mumbai',
  consultationFee: 600,
  feeSource: 'doctor',
  isAdminVerified: true,
  gender: 'female',
  clinicName: 'Testcare Clinic',
  ...over,
});

function fixtures() {
  return {
    hospitals: [
      {
        _id: H1,
        slug: 'testcare-hospital-andheri',
        name: 'Testcare Hospital',
        type: 'hospital',
        city: 'Mumbai',
        locality: 'Andheri West',
        address: '1 Test Road, Andheri West, Mumbai',
        pincode: '400053',
        // Scraped search-page tails: a Curxx city, a city only Doctar has, and real words after "In".
        departments: [
          'Oral Surgeon In Mumbai',
          'Oral Surgeon',
          'Hip Replacement Surgeon In Agra',
          'Ivf Specialist In Kolkata',
          'Blood In Urine',
          'Dentist In Kolkata',
          'oral surgeon in atlantis',
        ],
        coverImage: COVER,
        logo: 'https://doctar.example/scraped/logo.png',
        gallery: [{ url: GALLERY }],
      },
      {
        _id: H2,
        slug: 'testcare-pharmacy',
        name: 'Testcare Pharmacy',
        type: 'pharmacy',
        city: 'Mumbai',
        address: '2 Test Road, Mumbai',
      },
      // Not a Curxx city, so never read; but Agra is one of the places Doctar uses.
      {
        _id: H3,
        slug: 'agra-care-hospital',
        name: 'Agra Care Hospital',
        type: 'hospital',
        city: 'Agra',
        address: '1 Fort Road, Agra',
      },
    ],
    doctors: [
      doctor({
        _id: D.asha,
        slug: 'dr-asha-testdoctor',
        firstName: 'Asha',
        lastName: 'Testdoctor',
        registrationNumber: 'MMC-2011-12345',
      }),
      doctor({
        _id: D.noGender,
        slug: 'dr-ravi-nogender',
        firstName: 'Ravi',
        lastName: 'Nogender',
        gender: undefined,
        isAdminVerified: false,
        specialization: 'General Physician In Mumbai',
      }),
      doctor({ _id: D.generic, slug: 'santosh-doctor', firstName: 'Santosh', lastName: 'Doctor' }),
      doctor({ _id: D.org, slug: 'apollo-clinic', firstName: 'Apollo', lastName: 'Clinic' }),
      doctor({
        _id: D.noQual,
        slug: 'dr-no-qual',
        firstName: 'Neha',
        lastName: 'Noqual',
        qualification: '',
      }),
      doctor({ _id: D.clash, slug: 'CLASH', firstName: 'Clash', lastName: 'Testdoctor' }),
      doctor({
        _id: D.badSlug,
        slug: 'Bad Slug!',
        firstName: 'Meera',
        lastName: 'Badslug',
        clinicName: 'Meera Clinic | Best Physician near me Andheri',
      }),
      doctor({
        _id: D.faraway,
        slug: 'dr-far-away',
        firstName: 'Far',
        lastName: 'Away',
        location: 'Atlantis',
      }),
      doctor({
        _id: D.hiddenLater,
        slug: 'dr-kiran-hideme',
        firstName: 'Kiran',
        lastName: 'Hideme',
      }),
    ],
    doctorschedules: [
      {
        _id: id(),
        doctor: D.asha,
        hospital: H1,
        weeklySchedule: week,
        slotDuration: 20,
        consultationFee: 700,
        isActive: true,
      },
    ],
  };
}

async function call(method: string, url: string, body?: unknown) {
  const res = await app.inject({
    method: method as 'GET',
    url: `/api/v1${url}`,
    headers: admin && url.startsWith('/admin') ? { authorization: `Bearer ${admin}` } : {},
    payload: body as object | undefined,
  });
  return {
    status: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
    headers: res.headers,
  };
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
  const login = await call('POST', '/admin/auth/login', {
    email: 'admin@curxx.test',
    password: 'test-admin-password',
  });
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
    for (const slug of ['santosh-doctor', 'apollo-clinic', 'dr-no-qual', 'dr-far-away'])
      assert.ok(
        !res.body.doctors.some((d: { slug: string }) => d.slug === slug),
        `${slug} is not listed`,
      );
    // Facets and totals count Doctar doctors too.
    assert.ok(
      res.body.facets.areas.some(
        (a: { value: string; count: number }) => a.value === 'Andheri West' && a.count >= 1,
      ),
    );
    const cities = await get('/cities');
    assert.ok(
      cities.body.cities.find((c: { slug: string }) => c.slug === 'mumbai').doctorCount >= 5,
      'city counts include Doctar doctors',
    );
  });

  test('slugs: Doctar’s when clean, a clean one with a short id otherwise, and Curxx keeps a clashing slug', async () => {
    const all = await get('/doctors?city=mumbai&specialty=general-physician&limit=50');
    const slugs = all.body.doctors.map((d: { slug: string }) => d.slug);
    assert.ok(
      slugs.includes(`dr-meera-badslug-${String(D.badSlug).slice(-6)}`),
      'unusable Doctar slug → name + id',
    );
    const meera = all.body.doctors.find((d: { slug: string }) =>
      d.slug.startsWith('dr-meera-badslug'),
    );
    assert.equal(meera.clinicName, 'Meera Clinic', 'search-ad tails are cut from clinic names');
    assert.ok(
      slugs.includes(`${clashSlug}-${String(D.clash).slice(-6)}`),
      'clash → suffix on the Doctar record',
    );
    const curxx = await get(`/doctors/${clashSlug}`);
    assert.equal(curxx.status, 200);
    assert.notEqual(curxx.body.doctor.source, 'doctar', 'the Curxx doctor keeps the URL');
  });

  test('profile and hospital pages read Doctar live, including page-only fields', async () => {
    const res = await get('/doctors/dr-asha-testdoctor');
    assert.equal(res.status, 200);
    assert.equal(
      res.body.doctor.registration,
      'MMC-2011-12345',
      'registration comes from the detail read',
    );
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
    assert.equal(
      stats.body.total,
      listing.body.total,
      'the copy counts the same doctors as the listing',
    );
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
    assert.ok(
      facilities.body.entries.some((e: { slug: string }) => e.slug === 'testcare-hospital-andheri'),
    );
  });

  test('admin: overlays hide, rank and adjust Doctar records without touching Doctar', async () => {
    const list = await get('/admin/doctar/doctors?city=mumbai&q=Hideme');
    assert.equal(list.status, 200);
    assert.equal(list.body.items.length, 1);
    const kiran = list.body.items[0];
    assert.equal(kiran.liveSlug, 'dr-kiran-hideme');

    const hide = await call('PUT', `/admin/doctar/overlays/doctor/${kiran.doctarId}`, {
      hidden: true,
      note: 'duplicate profile',
    });
    assert.equal(hide.status, 200);
    assert.equal((await get('/doctors/dr-kiran-hideme')).status, 404, 'hidden at once');
    const hiddenList = await get('/admin/doctar/doctors?overlay=hidden');
    assert.ok(
      hiddenList.body.items.some((d: { doctarId: string }) => d.doctarId === kiran.doctarId),
      'the admin still sees it',
    );

    const bad = await call('PUT', `/admin/doctar/overlays/doctor/${kiran.doctarId}`, {
      photoUrl: 'http://insecure.example/x.jpg',
    });
    assert.equal(bad.status, 400);
    assert.equal(
      (await call('PUT', `/admin/doctar/overlays/doctor/${new Types.ObjectId()}`, { hidden: true }))
        .status,
      404,
    );

    // Rankings board: Doctar records rank through overlays.
    const board = await get('/admin/rankings?type=doctors&city=mumbai&specialty=general-physician');
    assert.ok(
      board.body.items.some(
        (d: { slug: string; source?: string }) =>
          d.slug === 'dr-asha-testdoctor' && d.source === 'doctar',
      ),
    );
    const saved = await call('POST', '/admin/rankings', {
      type: 'doctors',
      ranks: [{ slug: 'dr-asha-testdoctor', rank: 1 }],
    });
    assert.equal(saved.status, 200);
    const first = await get('/doctors?city=mumbai&specialty=general-physician&limit=1');
    assert.equal(first.body.doctors[0].slug, 'dr-asha-testdoctor', 'rank 1 leads the listing');

    await call('DELETE', `/admin/doctar/overlays/doctor/${kiran.doctarId}`);
    await call('DELETE', `/admin/doctar/overlays/doctor/${String(D.asha)}`);
    assert.equal((await get('/doctors/dr-kiran-hideme')).status, 200, 'back to Doctar’s record');
    assert.equal((await get('/admin/doctar/status')).body.overlays, 0);
  });

  test('the profile lists each place the doctor consults at, with Doctar’s days, hours and fee', async () => {
    const res = await get('/doctors/dr-asha-testdoctor');
    assert.equal(res.status, 200);
    const practices = res.body.doctor.practices as {
      facilitySlug: string;
      name: string;
      fee: number;
      feeFromSchedule: boolean;
      timings: { days: string; hours: string[] }[];
    }[];
    assert.equal(practices.length, 1, 'the pharmacy and unknown places are left out');
    assert.equal(practices[0]!.facilitySlug, 'testcare-hospital-andheri');
    assert.equal(practices[0]!.fee, 700, 'that place’s own fee');
    assert.equal(practices[0]!.feeFromSchedule, true);
    assert.ok(practices[0]!.timings.length > 0, 'Mon and Wed hours');
    assert.ok(!('schedule' in practices[0]!));
    // Doctors without schedules: no places, nothing invented.
    assert.deepEqual((await get('/doctors/dr-ravi-nogender')).body.doctor.practices, []);
  });

  test('Request an appointment: saved as "requested", only test recipients are told, spam is limited', async (t) => {
    await AppointmentRequestModel.deleteMany({});
    const sms: SmsMessage[] = [];
    const emails: string[] = [];
    setProviders({
      sms: { name: 'fake', send: async (m) => (sms.push(m), { id: 'x' }) },
      email: { name: 'fake', send: async (m) => (emails.push(m.to), { id: 'y' }) },
    });
    const saved = {
      phone: env.TEST_NOTIFY_PHONE,
      email: env.TEST_NOTIFY_EMAIL,
      mode: env.NOTIFY_MODE,
    };
    t.after(async () => {
      setProviders({});
      Object.assign(env, {
        TEST_NOTIFY_PHONE: saved.phone,
        TEST_NOTIFY_EMAIL: saved.email,
        NOTIFY_MODE: saved.mode,
      });
      await AppointmentRequestModel.deleteMany({});
    });
    env.TEST_NOTIFY_PHONE = '9000000001';
    env.TEST_NOTIFY_EMAIL = 'team@curxx.test';
    env.NOTIFY_MODE = 'live'; // even "live" never reaches the doctor or hospital
    const ask = (slug: string, over: Record<string, unknown> = {}) =>
      call('POST', `/doctors/${slug}/requests`, {
        name: 'Test Patient',
        phone: '9876500001',
        preferredDay: '',
        preferredTime: 'morning',
        facilitySlug: 'testcare-hospital-andheri',
        ...over,
      });
    const first = await ask('dr-asha-testdoctor');
    assert.equal(first.status, 201);
    assert.equal(first.body.request.status, 'requested');
    assert.match(first.body.request.reference, /^REQ-/);
    assert.equal(first.body.request.facilityName, 'Testcare Hospital');
    // The notice is sent in the background.
    let row = null;
    for (let i = 0; i < 50 && !row?.notify?.status; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
      row = await AppointmentRequestModel.findOne({
        reference: first.body.request.reference,
      }).lean();
    }
    assert.equal(row?.notify?.status, 'test');
    assert.deepEqual(
      sms.map((m) => m.to),
      ['9000000001'],
    );
    assert.deepEqual(emails, ['team@curxx.test']);
    assert.match(sms[0]!.text, /not sent to the doctor or hospital/);

    assert.equal((await ask('dr-asha-testdoctor')).status, 409, 'one open request per doctor');
    assert.equal((await ask('dr-asha-testdoctor', { phone: '12345' })).status, 400);
    assert.equal((await ask('dr-asha-testdoctor', { preferredDay: '2099-01-01' })).status, 400);
    assert.equal((await ask(clashSlug)).status, 409, 'Curxx doctors are booked on slots instead');
    assert.equal((await ask('no-such-doctor')).status, 404);
    assert.equal((await ask('dr-ravi-nogender')).status, 201);
    assert.equal((await ask('dr-kiran-hideme')).status, 201);
    assert.equal((await ask(`dr-meera-badslug-${String(D.badSlug).slice(-6)}`)).status, 429);

    const list = await get('/admin/appointment-requests');
    assert.equal(list.status, 200);
    assert.equal(list.body.total ?? list.body.items.length, 3);
  });

  test('the admin marks a claimed doctor’s medical registration as verified', async () => {
    assert.ok(!(await get('/doctors/dr-asha-testdoctor')).body.doctor.registrationVerified);
    const set = await call('PUT', `/admin/doctar/overlays/doctor/${String(D.asha)}`, {
      registrationVerified: true,
    });
    assert.equal(set.status, 200);
    clearDetailCache();
    assert.equal((await get('/doctors/dr-asha-testdoctor')).body.doctor.registrationVerified, true);
    const claim = await call('POST', '/leads', {
      kind: 'provider',
      role: 'doctor',
      claim: 'dr-asha-testdoctor',
      phone: '9876543210',
    });
    assert.equal(claim.status, 201);
    await call('DELETE', `/admin/doctar/overlays/doctor/${String(D.asha)}`);
    assert.ok(!(await get('/doctors/dr-asha-testdoctor')).body.doctor.registrationVerified);
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
    assert.equal(
      unavailable.headers['cache-control'],
      'no-store',
      'an incomplete list is never cached by a CDN',
    );
    assert.equal(
      (await get('/doctors/dr-asha-testdoctor')).status,
      503,
      'not a 404 that would drop the page from search',
    );
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
      [
        'Nova IVF Fertility Centre - Best IVF Center in Naroda, Ahmedabad',
        'Nova IVF Fertility Centre',
      ],
      [
        'Mila Aesthetics—Hair Transplant, Best Cosmetic Surgery Clinic in Bodakdev',
        'Mila Aesthetics',
      ],
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

  test('a trailing "In <place>" is cut from a speciality name only when it names a known place', () => {
    const ctx = mappingContext(
      [
        { slug: 'kolkata', name: 'Kolkata', localities: [] },
        { slug: 'delhi', name: 'Delhi', localities: [] },
      ],
      [],
      { places: ['Agra', 'Pimpri-Chinchwad', 'Dehra Dun'] },
    );
    const cases: [string, string][] = [
      ['Oral Surgeon In Kolkata', 'Oral Surgeon'],
      ['Hip Replacement Surgeon In Agra', 'Hip Replacement Surgeon'],
      ['cancer surgeon in pimpri-chinchwad', 'cancer surgeon'],
      ['Brain Surgeon In Dehra Dun', 'Brain Surgeon'],
      ['Dentist In New Delhi.', 'Dentist'],
      ['Treatment In Children In Kolkata', 'Treatment In Children'],
      ['Blood In Urine', 'Blood In Urine'],
      [
        'Assessment Of Behavioural Problems In Elderly',
        'Assessment Of Behavioural Problems In Elderly',
      ],
      ['In Vitro Fertilization', 'In Vitro Fertilization'],
      ['Oral Surgeon In Atlantis', 'Oral Surgeon In Atlantis'],
    ];
    for (const [raw, clean] of cases) assert.equal(withoutPlace(raw, ctx), clean, raw);
  });

  test('speciality names lose scraped place tails, and the duplicates merge, on every page', async () => {
    const clean = [
      'Oral Surgeon',
      'Hip Replacement Surgeon',
      'Ivf Specialist',
      'Blood In Urine',
      'Dentist',
    ];
    const list = await get('/facilities?city=mumbai&type=hospital&limit=50');
    const card = list.body.items.find(
      (f: { slug: string }) => f.slug === 'testcare-hospital-andheri',
    );
    assert.deepEqual(card.departments, clean);
    assert.ok(card.specialties.includes('dentist'), '"Dentist In Kolkata" counts as Dentist');
    // One filter entry and count for "Oral Surgeon", not one per city.
    const facet = list.body.facets.departments as { value: string; count: number }[];
    assert.deepEqual(
      facet.filter((d) => d.value.toLowerCase().startsWith('oral surgeon')),
      [{ value: 'Oral Surgeon', count: 1 }],
    );
    assert.ok(!facet.some((d) => /\bin (mumbai|agra|kolkata|atlantis)$/i.test(d.value)));
    const filtered = await get('/facilities?city=mumbai&type=hospital&department=Oral%20Surgeon');
    assert.deepEqual(
      filtered.body.items.map((f: { slug: string }) => f.slug),
      ['testcare-hospital-andheri'],
    );
    const page = await get('/facilities/testcare-hospital-andheri');
    assert.deepEqual(
      page.body.facility.departments,
      clean,
      'the hospital page shows the same list',
    );
    // Doctors: Doctar's "General Physician In Mumbai" is Curxx's General Physician.
    assert.equal(
      (await get('/doctors/dr-ravi-nogender')).body.doctor.specialty,
      'general-physician',
    );
    // SEO: the surgery page's hospital table (ranked first here, so it's in the top 10).
    await call('PUT', `/admin/doctar/overlays/facility/${String(H1)}`, { rank: 1 });
    const seo = await get('/seo/surgeries?city=mumbai');
    assert.equal(seo.body.hospitals[0].slug, 'testcare-hospital-andheri');
    assert.deepEqual(seo.body.hospitals[0].departments, clean.slice(0, 3));
    await call('DELETE', `/admin/doctar/overlays/facility/${String(H1)}`);
  });

  test('hospital photos from Doctar show only with DOCTAR_SHOW_FACILITY_PHOTOS; one set in the admin always shows', async (t) => {
    t.after(() => (env.DOCTAR_SHOW_FACILITY_PHOTOS = false));
    const photos = async () => {
      const list = await get('/facilities?city=mumbai&type=hospital&limit=50');
      const page = await get('/facilities/testcare-hospital-andheri');
      const profile = await get('/doctors/dr-asha-testdoctor');
      return {
        card: list.body.items.find((f: { slug: string }) => f.slug === 'testcare-hospital-andheri')
          .photoUrl,
        page: page.body.facility.photoUrl,
        gallery: page.body.facility.gallery,
        doctorPage: profile.body.facility.photoUrl,
      };
    };
    // Off by default: no Doctar photo anywhere, so the website shows its placeholder.
    assert.deepEqual(await photos(), { card: '', page: '', gallery: [], doctorPage: '' });

    const own = 'https://curxx.example/testcare-front.jpg';
    const set = await call('PUT', `/admin/doctar/overlays/facility/${String(H1)}`, {
      photoUrl: own,
    });
    assert.equal(set.status, 200);
    assert.deepEqual(await photos(), { card: own, page: own, gallery: [], doctorPage: own });
    await call('DELETE', `/admin/doctar/overlays/facility/${String(H1)}`);

    env.DOCTAR_SHOW_FACILITY_PHOTOS = true;
    await useDoctar(memoryDoctarSource(fixtures()));
    assert.deepEqual(await photos(), {
      card: COVER,
      page: COVER,
      gallery: [GALLERY],
      doctorPage: COVER,
    });

    // Turned off again, a copy saved while they were on doesn't bring them back.
    env.DOCTAR_SHOW_FACILITY_PHOTOS = false;
    useDoctarSource(memoryDoctarSource(fixtures(), { failing: () => true }));
    clearDetailCache();
    assert.equal(await loadSavedIndex(), true);
    assert.deepEqual(await photos(), { card: '', page: '', gallery: [], doctorPage: '' });
    await useDoctar(memoryDoctarSource(fixtures()));
  });

  test('nothing writes to Doctar: the connection only reads', () => {
    const code = readFileSync(new URL('../src/modules/doctar/source.ts', import.meta.url), 'utf8');
    for (const write of [
      'insert',
      'update',
      'delete',
      'replace',
      'bulkWrite',
      'drop',
      'createIndex',
      'findOneAnd',
      'save(',
      'rename',
    ]) {
      assert.ok(!code.includes(`.${write}`), `source.ts must not call .${write}`);
    }
    assert.match(code, /secondaryPreferred/);
    assert.match(code, /autoIndex: false/);
  });
});
