/**
 * The Doctar directory's cold-start copy (src/modules/doctar/cache.ts): an index the size of the real one
 * goes through gzip and back one record at a time (never as one big string, which ran the server out of
 * heap), is stored in parts, and a damaged or half-written copy is refused rather than half-loaded.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import {
  loadCache,
  readIndexCache,
  saveCache,
  writeIndexCache,
} from '../src/modules/doctar/cache.js';
import type { Index } from '../src/modules/doctar/directory.js';
import type { DoctorDoc, FacilityDoc } from '../src/modules/doctar/mapping.js';
import { DirectoryCacheModel } from '../src/modules/doctar/models.js';

/** Records shaped like the directory's own (see mapping.ts), with the kinds of text Doctar has. */
function directory(doctorCount: number, facilityCount: number): Index {
  // Photo URLs are random, as real ones are, so the copy doesn't compress to nothing.
  const noise = randomBytes((doctorCount + facilityCount) * 24).toString('base64url');
  const token = (i: number) => noise.slice(i * 32, i * 32 + 32);
  const cities = ['mumbai', 'kolkata', 'bangalore', 'chennai', 'ahmedabad'];
  const facilities: FacilityDoc[] = Array.from({ length: facilityCount }, (_, i) => {
    const id = i.toString(16).padStart(24, 'f');
    return {
      _id: id,
      doctarId: id,
      source: 'doctar',
      slug: `testcare-hospital-${i}`,
      name: `Testcare Hospital ${i} (Unit ${i % 7})`,
      shortName: `Testcare Hospital ${i}`,
      type: i % 4 ? 'hospital' : 'clinic',
      category: 'Multispecialty Hospital',
      city: cities[i % cities.length]!,
      area: 'Salt Lake',
      address: `${i} Test Road, Sector V, Salt Lake — “Near the Metro”, Kolkata`,
      pincode: '700091',
      geo: { lat: 22.57 + i / 1e6, lng: 88.43 },
      phone: '033 4000 0000',
      openHours: 'Open 24 hours',
      opdHours: '',
      emergency24x7: i % 3 === 0,
      beds: i % 400,
      nabh: i % 5 === 0,
      departments: ['Cardiology', 'Oral Surgeon', 'Ivf Specialist', 'Obstetrics & Gynaecology'],
      specialties: ['cardiologist', 'dentist'],
      photoUrl: `https://lh3.googleusercontent.com/p/AF1Qip${token(doctorCount + i)}`,
      tagline: '',
      rating: 0,
      reviewCount: 0,
      distanceKm: 0,
      rankScore: null,
      about: '',
      services: [],
      amenities: [],
      insurers: [],
      gallery: [],
    };
  });
  const doctors: DoctorDoc[] = Array.from({ length: doctorCount }, (_, i) => {
    const id = i.toString(16).padStart(24, 'a');
    return {
      _id: id,
      doctarId: id,
      source: 'doctar',
      doctarVerified: i % 3 === 0,
      slug: `dr-test-doctor-${i}-general-physician`,
      name: `Dr. Test Doctor ${i}`,
      qualification: 'MBBS, MD (General Medicine), DNB',
      title: 'General Physician',
      specialty: 'general-physician',
      city: cities[i % cities.length]!,
      area: 'Andheri West',
      // Curly quotes, Devanagari, an emoji and a newline: all must survive the round trip.
      clinicName: `Priyank’s “Care” Clinic ${i} — डॉ. क्लिनिक 🙂\nFirst floor`,
      facilitySlug: `testcare-hospital-${i % facilityCount}`,
      ...(i % 2 ? { gender: 'female' } : {}),
      education: [],
      registration: '',
      experienceYears: i % 40,
      fee: 300 + (i % 20) * 50,
      videoFee: 300 + (i % 20) * 50,
      feeVerified: i % 4 === 0,
      rating: 0,
      reviewCount: 0,
      recommendPercent: 0,
      languages: ['English', 'Hindi', 'मराठी'],
      focusAreas: [],
      photoUrl: `https://lh3.googleusercontent.com/p/AF1Qip${token(i)}`,
      about: '',
      verified: false,
      schedule: {
        days: [1, 3, 5],
        sessions: [{ start: '10:00', end: '13:00' }],
        perDay: [{ day: 5, sessions: [{ start: '17:00', end: '20:00' }] }],
        step: 20,
        video: 'none',
      },
      consultHours: 'Mon, Wed 10:00 AM – 1:00 PM · Fri 5:00 PM – 8:00 PM',
      freeVideo: false,
      instant: false,
      slotsThrough: null,
      phone: '',
      whatsapp: '',
      bookable: true,
      rankScore: null,
      managed: false,
    };
  });
  return {
    doctors,
    facilities,
    builtAt: new Date('2026-09-30T12:00:00.000Z'),
    from: 'doctar',
    report: {
      scanned: doctorCount + 1000,
      doctors: doctorCount,
      facilities: facilityCount,
      skippedDoctors: { 'no qualification': 1000 },
      skippedFacilities: {},
      seconds: 31.4,
      peakRssMb: 395,
      peakHeapMb: 215,
      capped: false,
    },
  };
}

/** Runs `work` while recording the longest text JSON.stringify returns and JSON.parse is given. */
async function longestJson<T>(work: () => Promise<T>) {
  const { stringify, parse } = JSON;
  const seen = { stringified: 0, parsed: 0, total: 0 };
  JSON.stringify = ((...args: Parameters<typeof stringify>) => {
    const out = stringify(...args);
    if (typeof out === 'string') {
      seen.stringified = Math.max(seen.stringified, out.length);
      seen.total += out.length;
    }
    return out;
  }) as typeof JSON.stringify;
  JSON.parse = ((text: string, reviver?: Parameters<typeof parse>[1]) => {
    seen.parsed = Math.max(seen.parsed, text.length);
    return parse(text, reviver);
  }) as typeof JSON.parse;
  try {
    return { result: await work(), seen };
  } finally {
    JSON.stringify = stringify;
    JSON.parse = parse;
  }
}

describe('Doctar directory cold-start copy', () => {
  // The size of the real directory (Doctar staging, 30 Sep 2026: 62,037 doctors, 13,122 hospitals).
  const big = directory(62_000, 13_000);
  const parts: Buffer[] = [];

  test('a directory the size of the real one is written one record at a time, never as one big string', async () => {
    const { result: written, seen } = await longestJson(() =>
      writeIndexCache(big, async (data, part) => {
        assert.equal(part, parts.length, 'parts arrive in order');
        parts.push(data);
      }),
    );
    assert.ok(seen.total > 60e6, `a large index: ${Math.round(seen.total / 1e6)} MB of JSON`);
    assert.ok(
      seen.stringified < 3_000,
      `the longest text built at once is one record (${seen.stringified} characters), not the index`,
    );
    assert.equal(written.parts, parts.length);
    assert.equal(
      written.bytes,
      parts.reduce((n, p) => n + p.length, 0),
    );
    assert.ok(parts.every((p) => p.length <= 8 * 1024 * 1024));
  });

  test('it reads back one record at a time, exactly as it was', async () => {
    const { result: back, seen } = await longestJson(() => readIndexCache(parts));
    assert.ok(
      seen.parsed < 3_000,
      `the longest text parsed at once is one record (${seen.parsed})`,
    );
    assert.equal(back.from, 'cache');
    assert.equal(back.builtAt.toISOString(), big.builtAt.toISOString());
    assert.deepEqual(back.report, big.report);
    assert.equal(back.doctors.length, 62_000);
    assert.equal(back.facilities.length, 13_000);
    assert.deepEqual(back.doctors, big.doctors);
    assert.deepEqual(back.facilities, big.facilities);
  });

  test('small parts split the same bytes, and any size of part reads back', async () => {
    const small = directory(3_000, 600);
    const pieces: Buffer[] = [];
    const written = await writeIndexCache(small, async (data) => void pieces.push(data), 64 * 1024);
    assert.ok(written.parts > 3, `${written.parts} parts`);
    assert.ok(pieces.slice(0, -1).every((p) => p.length === 64 * 1024));
    assert.ok(pieces.at(-1)!.length <= 64 * 1024);
    const back = await readIndexCache(pieces);
    assert.deepEqual(back.doctors, small.doctors);
    assert.deepEqual(back.facilities, small.facilities);
  });

  test('a damaged or incomplete copy is refused, never half-loaded', async () => {
    // Cut short.
    await assert.rejects(readIndexCache(parts.slice(0, -1).concat(parts.at(-1)!.subarray(0, 100))));
    // One byte changed.
    const flipped = Buffer.from(parts[0]!);
    const middle = flipped.length >> 1;
    flipped.writeUInt8(flipped.readUInt8(middle) ^ 0xff, middle);
    await assert.rejects(readIndexCache([flipped, ...parts.slice(1)]));
    // The old format (the whole index as one JSON document) is refused before it's held whole.
    const old = gzipSync(`{"doctors":[${'{"name":"Dr. Old Format"},'.repeat(200_000)}{}]}`);
    await assert.rejects(readIndexCache([old]), /not in lines/);
    // A header that promises more records than there are.
    const header = gzipSync(
      Buffer.from(
        `${JSON.stringify({ format: 2, builtAt: new Date(), report: null, doctors: 5, facilities: 0 })}\n{}\n`,
      ),
    );
    await assert.rejects(readIndexCache([header]), /incomplete/);
  });
});

describe('Doctar directory cold-start copy in the Curxx DB', () => {
  before(async () => {
    await connectDatabase();
    await DirectoryCacheModel.deleteMany({});
  });
  after(async () => {
    await DirectoryCacheModel.deleteMany({});
    await disconnectDatabase();
  });

  test('saved in parts and loaded back; a half-written newer copy and the old format are ignored', async () => {
    // A copy in the old format, and one that stopped half-way (parts: 0), both newer than the good one.
    await DirectoryCacheModel.create([
      {
        name: 'doctar-directory',
        generation: 1,
        part: 0,
        parts: 1,
        data: Buffer.from('old'),
        builtAt: new Date(),
      },
      {
        name: 'doctar-directory-v2',
        generation: Date.parse('2030-01-01'),
        part: 0,
        parts: 0,
        data: Buffer.from('half'),
        builtAt: new Date(),
      },
    ]);
    const ix = directory(5_000, 1_000);
    const saved = await saveCache(ix, 64 * 1024);
    assert.ok(saved.parts > 3, `${saved.parts} parts`);
    const rows = await DirectoryCacheModel.find({}, { name: 1, parts: 1, part: 1 }).lean();
    assert.equal(rows.length, saved.parts, 'the old and the half-written copies are removed');
    assert.ok(rows.every((r) => r.name === 'doctar-directory-v2' && r.parts === saved.parts));

    const back = await loadCache();
    assert.ok(back);
    assert.equal(back.from, 'cache');
    assert.deepEqual(back.doctors, ix.doctors);
    assert.deepEqual(back.facilities, ix.facilities);

    // A newer save that stops half-way: the complete copy is still the one loaded.
    await DirectoryCacheModel.create({
      name: 'doctar-directory-v2',
      generation: Date.parse('2031-01-01'),
      part: 0,
      parts: 0,
      data: Buffer.from('half'),
      builtAt: new Date(),
    });
    assert.equal((await loadCache())?.builtAt.toISOString(), ix.builtAt.toISOString());
    // A complete copy with a part missing is not loaded at all.
    await DirectoryCacheModel.deleteOne({ name: 'doctar-directory-v2', part: 1 });
    assert.equal(await loadCache(), null);
  });
});
