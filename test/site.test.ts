/**
 * Editable website data: the public endpoints the website reads (settings, stats, page content,
 * testimonials, plans, the routing catalogue) and editing each of them — plus cities, conditions and
 * surgeries — from the admin panel, including surviving the catalogue sync that runs on deploy.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { syncCatalogue } from '../src/db/catalogue.js';
import { connectDatabase } from '../src/db/connect.js';
import { HOME_FAQS } from '../src/db/data/site-content.js';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let token = '';

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {}, payload: opts.body as object | undefined });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

before(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  token = (await call('POST', '/admin/auth/login', { body: { email: 'admin@curxx.test', password: 'test-admin-password' } })).body.token;
  // Records a previous, interrupted run may have left behind (admin-made records survive the seed).
  for (const path of ['/admin/testimonials/test-patient', '/admin/surgeries/test-bunion-surgery', '/admin/conditions/test-heel-pain', '/admin/cities/testpur']) await call('DELETE', path, { token });
});

after(async () => {
  await app.close();
  await mongoose.disconnect();
});

describe('public site data', () => {
  test('settings: claims, links and images by key, cacheable', async () => {
    const res = await call('GET', '/site/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.settings['claim-patients'], '1.2M+');
    assert.equal(res.body.settings['image-home-hero'], '/images/home-hero.jpg');
    assert.match(String(res.headers['cache-control']), /s-maxage/);
  });

  test('stats are counted from the database', async () => {
    const { stats } = (await call('GET', '/site/stats')).body;
    const doctors = (await call('GET', '/doctors?city=all&limit=1')).body.total;
    assert.ok(stats.doctors > 1000);
    assert.ok(stats.doctors >= doctors);
    assert.equal(stats.cities, 24);
    assert.equal(stats.specialties, 56);
    assert.ok(stats.accreditedFacilities > 0 && stats.accreditedFacilities <= stats.facilities);
    assert.ok(stats.averageRating >= 1 && stats.averageRating <= 5);
    assert.ok(stats.labTests > 200);
  });

  test('page content comes back word for word, several pages at once', async () => {
    const { sections } = (await call('GET', '/content/home,shared')).body;
    assert.deepEqual(sections['home/faqs'].items, HOME_FAQS);
    assert.equal(sections['home/faqs'].title, 'Frequently Asked Questions');
    assert.equal(sections['home/bands'].items.length, 4);
    assert.equal(sections['home/services'].items.length, 8);
    assert.equal(sections['shared/partner-sections'].items.length, 3);
    assert.deepEqual(sections['shared/trust-badges'].items, ['NABH Partner Network', 'ISO 27001 Certified', 'HIPAA Compliant', 'ABDM Certified']);
    const legal = (await call('GET', '/content/privacy')).body.sections['privacy/policy'];
    assert.equal(legal.title, 'Privacy Policy');
    assert.equal(legal.items.length, 5);
    assert.equal((await call('GET', '/content/NOT A PAGE')).status, 400);
  });

  test('testimonials and plans by audience', async () => {
    const patients = (await call('GET', '/testimonials')).body.testimonials;
    assert.deepEqual(patients.map((t: { name: string }) => t.name), ['Priya Sharma', 'Rohan Mehta', 'Kavita Krishnan']);
    const providers = (await call('GET', '/testimonials?audience=provider')).body.testimonials;
    assert.equal(providers[0].badge.label, '3.4x Booking Growth');
    const plus = (await call('GET', '/plans')).body.plans;
    assert.deepEqual(plus.map((p: { slug: string; price: number }) => [p.slug, p.price]), [['solo', 499], ['family', 1199], ['family-max', 1799]]);
    const provider = (await call('GET', '/plans?audience=provider')).body.plans;
    assert.deepEqual(provider.map((p: { price: number }) => p.price), [0, 1499, 4999]);
    assert.equal(provider[0].excluded[0], 'ABHA health record dispatch');
  });

  test('routing catalogue: cities, specialties, conditions, surgeries with the homepage ordering', async () => {
    const r = (await call('GET', '/catalogue/routing')).body;
    assert.equal(r.cities.length, 24);
    const blr = r.cities.find((c: { slug: string }) => c.slug === 'bangalore');
    assert.deepEqual(blr.aliases, ['bengaluru', 'blr']);
    assert.equal(blr.popularOrder, 1);
    assert.equal(r.specialties.length, 56);
    const home = r.specialties.filter((s: { homeOrder: number }) => s.homeOrder > 0).sort((a: { homeOrder: number }, b: { homeOrder: number }) => a.homeOrder - b.homeOrder);
    assert.equal(home.length, 12);
    assert.equal(home[0].slug, 'general-physician');
    const chips = r.conditions.filter((c: { popularOrder: number }) => c.popularOrder > 0).sort((a: { popularOrder: number }, b: { popularOrder: number }) => a.popularOrder - b.popularOrder);
    assert.deepEqual(chips.map((c: { popular: string }) => c.popular), ['Cough & Cold', 'Skin Acne', 'Depression & Anxiety', 'Stomach Ache', "Women's Health"]);
    assert.equal(r.surgeries.length, 31);
    assert.equal(r.surgeryCategories[0], 'General & Laparoscopic');
    assert.equal(r.facilityTypes.length, 19);
  });

  test('facilities: departments facet and nearest-first emergency search', async () => {
    const list = (await call('GET', '/facilities?city=bangalore&type=clinic&limit=1')).body;
    assert.ok(list.facets.departments.length > 0);
    assert.ok(list.facets.departments.every((d: { value: string; count: number }) => d.value && d.count > 0));
    // Hebbal, north Bengaluru.
    const near = (await call('GET', '/facilities?city=bangalore&emergency=true&sort=distance&lat=13.0358&lng=77.597&limit=3')).body;
    const byPin = (await call('GET', '/facilities?city=bangalore&emergency=true&sort=distance&pincode=560024&limit=3')).body;
    assert.deepEqual(byPin.items.map((f: { slug: string }) => f.slug), near.items.map((f: { slug: string }) => f.slug));
    assert.equal(near.items.length, 3);
    assert.ok(near.items.every((f: { emergency24x7: boolean }) => f.emergency24x7));
    const d = near.items.map((f: { distanceKm: number }) => f.distanceKm);
    assert.deepEqual(d, [...d].sort((a: number, b: number) => a - b));
    assert.equal((await call('GET', '/facilities?city=bangalore&lat=200&lng=0')).status, 400);
    // The emergency modal leaves out places a person in an emergency shouldn't be sent to.
    const human = (await call('GET', '/facilities?city=mumbai&emergency=true&excludeCategory=veterinary-hospital,maternity-home&limit=60')).body;
    assert.ok(human.items.length > 0);
    assert.ok(human.items.every((f: { category: string }) => f.category !== 'Veterinary Hospital' && f.category !== 'Maternity Home'));
  });
});

describe('editing website data in the admin panel', () => {
  test('a testimonial: create, publish, edit, unpublish, delete', async () => {
    const created = await call('POST', '/admin/testimonials', { token, body: { name: 'Test Patient', location: 'Pune, Maharashtra', text: 'Great service.', rating: 4, order: 99 } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.item.slug, 'test-patient');
    assert.equal(created.body.item.initials, 'TP');
    let names = (await call('GET', '/testimonials')).body.testimonials.map((t: { name: string }) => t.name);
    assert.equal(names.at(-1), 'Test Patient');
    await call('PATCH', '/admin/testimonials/test-patient', { token, body: { text: 'Edited.', published: false } });
    names = (await call('GET', '/testimonials')).body.testimonials.map((t: { name: string }) => t.name);
    assert.ok(!names.includes('Test Patient'));
    assert.equal((await call('DELETE', '/admin/testimonials/test-patient', { token })).status, 200);
  });

  test('a site setting and a content section: edits show at once and survive a sync', async () => {
    await call('PATCH', '/admin/site-settings/claim-patients', { token, body: { value: '2M+' } });
    assert.equal((await call('GET', '/site/settings')).body.settings['claim-patients'], '2M+');
    const faqs = [...HOME_FAQS, { question: 'Test question?', answer: 'Test answer.' }];
    assert.equal((await call('PATCH', '/admin/content/home-faqs', { token, body: { items: 'not a list' } })).status, 400);
    await call('PATCH', '/admin/content/home-faqs', { token, body: { items: faqs } });
    await syncCatalogue();
    assert.equal((await call('GET', '/site/settings')).body.settings['claim-patients'], '2M+');
    assert.equal((await call('GET', '/content/home')).body.sections['home/faqs'].items.length, HOME_FAQS.length + 1);
    // Clean up: deleting a seeded record brings it back, unedited, on the next sync.
    await call('DELETE', '/admin/site-settings/claim-patients', { token });
    await call('DELETE', '/admin/content/home-faqs', { token });
    await syncCatalogue();
    assert.equal((await call('GET', '/site/settings')).body.settings['claim-patients'], '1.2M+');
    assert.deepEqual((await call('GET', '/content/home')).body.sections['home/faqs'].items, HOME_FAQS);
  });

  test('a plan price change reaches the public plans', async () => {
    await call('PATCH', '/admin/plans/family', { token, body: { price: 1299 } });
    assert.equal((await call('GET', '/plans')).body.plans.find((p: { slug: string }) => p.slug === 'family').price, 1299);
    await call('DELETE', '/admin/plans/family', { token });
    await syncCatalogue();
    assert.equal((await call('GET', '/plans')).body.plans.find((p: { slug: string }) => p.slug === 'family').price, 1199);
  });

  test('a new surgery gets a working page straight away and survives a sync; slugs are fixed', async () => {
    const created = await call('POST', '/admin/surgeries', {
      token,
      body: { name: 'Test Bunion Surgery', category: 'Orthopaedics', specialty: 'orthopedist', description: 'Corrects a bunion.', cost: [40000, 90000], stay: '1 day', recovery: '6 weeks', anaesthesia: 'Regional', techniques: ['Osteotomy'], departments: ['Orthopaedics'] },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const page = await call('GET', '/surgeries/test-bunion-surgery?city=jaipur');
    assert.equal(page.status, 200);
    assert.equal(page.body.surgery.name, 'Test Bunion Surgery');
    assert.deepEqual(page.body.surgery.cost, [34000, 76500]); // Jaipur is tier 2: 15% lower
    assert.ok((await call('GET', '/surgeries?city=jaipur')).body.surgeries.some((s: { slug: string }) => s.slug === 'test-bunion-surgery'));
    assert.equal((await call('POST', '/admin/surgeries', { token, body: { name: 'Bad', category: 'X', specialty: 'no-such-specialty' } })).status, 400);

    // Editing a seeded surgery sticks through a sync; its slug can't be renamed.
    await call('PATCH', '/admin/surgeries/laser-piles-surgery', { token, body: { stay: 'Day care (edited)', slug: 'renamed' } });
    await syncCatalogue();
    assert.equal((await call('GET', '/surgeries/laser-piles-surgery?city=bangalore')).body.surgery.stay, 'Day care (edited)');
    assert.equal((await call('GET', '/surgeries/test-bunion-surgery?city=jaipur')).status, 200);

    await call('DELETE', '/admin/surgeries/test-bunion-surgery', { token });
    await call('DELETE', '/admin/surgeries/laser-piles-surgery', { token });
    assert.equal((await call('GET', '/surgeries/test-bunion-surgery?city=jaipur')).status, 404);
    await syncCatalogue();
    assert.equal((await call('GET', '/surgeries/laser-piles-surgery?city=bangalore')).body.surgery.stay, 'Day care');
  });

  test('a new condition gets a treatment page', async () => {
    const created = await call('POST', '/admin/conditions', { token, body: { name: 'Test Heel Pain', specialty: 'orthopedist', summary: 'Pain under the heel.', symptoms: ['Heel pain in the morning'], whenToSee: ['Pain for weeks'], treatments: ['Stretching'] } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const page = await call('GET', '/conditions/test-heel-pain?city=bangalore');
    assert.equal(page.status, 200);
    assert.equal(page.body.specialty.slug, 'orthopedist');
    assert.ok((await call('GET', '/catalogue/routing')).body.conditions.some((c: { slug: string }) => c.slug === 'test-heel-pain'));
    await call('DELETE', '/admin/conditions/test-heel-pain', { token });
    assert.equal((await call('GET', '/conditions/test-heel-pain?city=bangalore')).status, 404);
  });

  test('a new city with localities is served everywhere; reserved and taken slugs are refused', async () => {
    const created = await call('POST', '/admin/cities', {
      token,
      body: { name: 'Testpur', state: 'Test State', lat: 21.1, lng: 79.1, tier: 2, aliases: ['Test Pur'], pincodePrefixes: ['999'], localities: [{ name: 'Old Market', pincode: '999001' }] },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(created.body.item.aliases, ['test-pur']);
    assert.equal(created.body.item.localities[0].slug, 'old-market');
    const city = await call('GET', '/cities/test-pur');
    assert.equal(city.status, 200);
    assert.equal(city.body.city.slug, 'testpur');
    assert.equal((await call('GET', '/conditions/acne?city=testpur')).status, 200);
    assert.equal((await call('GET', '/labs?city=testpur')).status, 200);
    assert.equal((await call('POST', '/admin/cities', { token, body: { name: 'Blog', state: 'x', lat: 1, lng: 1 } })).status, 400);
    assert.equal((await call('POST', '/admin/cities', { token, body: { name: 'Other', state: 'x', lat: 1, lng: 1, aliases: ['bengaluru'] } })).status, 400);
    await call('DELETE', '/admin/cities/testpur', { token });
    assert.equal((await call('GET', '/cities/testpur')).status, 404);
  });

  test('admin meta lists the editable catalogue for form dropdowns', async () => {
    const meta = (await call('GET', '/admin/meta', { token })).body;
    assert.equal(meta.cities.length, 24);
    assert.ok(meta.contentPages.includes('home'));
    assert.ok(meta.surgeryCategories.includes('Proctology'));
  });
});
