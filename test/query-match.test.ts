/**
 * lib/query-match.ts: MongoDB filters and sorts on records in memory must behave like MongoDB, because the
 * same filter runs on Curxx's records (MongoDB) and the Doctar directory (memory) and the results are merged.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Types } from 'mongoose';
import { matches, project, sortBy } from '../src/lib/query-match.js';

const doc = {
  _id: new Types.ObjectId('64b000000000000000000001'),
  slug: 'dr-a',
  city: 'mumbai',
  fee: 500,
  languages: ['English', 'Hindi'],
  schedule: { video: 'none', days: [1, 3] },
  gender: undefined,
  source: 'doctar',
};

describe('query-match', () => {
  test('equality, arrays, regex and dotted paths', () => {
    assert.ok(matches(doc, { city: 'mumbai', languages: 'Hindi', 'schedule.video': 'none' }));
    assert.ok(matches(doc, { slug: /^dr-/ }));
    assert.ok(matches(doc, { 'schedule.days.0': { $exists: true } }));
    assert.ok(!matches(doc, { 'schedule.days.5': { $exists: true } }));
    assert.ok(matches(doc, { _id: new Types.ObjectId('64b000000000000000000001') }));
  });

  test('operators', () => {
    assert.ok(matches(doc, { fee: { $gte: 500, $lt: 600 } }));
    assert.ok(!matches(doc, { fee: { $gt: 500 } }));
    assert.ok(matches(doc, { source: { $nin: [null, ''] } }));
    assert.ok(matches(doc, { gender: { $in: [null] } }), 'missing matches null, as in MongoDB');
    assert.ok(matches(doc, { gender: { $exists: false } }));
    assert.ok(matches(doc, { 'schedule.video': { $ne: 'all' } }));
    assert.ok(matches(doc, { $or: [{ city: 'delhi' }, { fee: 500 }], $and: [{ slug: 'dr-a' }] }));
    assert.ok(!matches(doc, { $nor: [{ city: 'mumbai' }] }));
    assert.ok(matches(doc, { languages: { $elemMatch: { $regex: '^hin', $options: 'i' } } }));
    assert.ok(matches(doc, { languages: { $size: 2 } }));
    assert.ok(matches(doc, { city: { $not: /delhi/ } }));
    assert.throws(() => matches(doc, { fee: { $where: 'x' } }), /unsupported/);
  });

  test('a regex matches an array field when any element matches, as in MongoDB', () => {
    assert.ok(matches(doc, { languages: /^hin/i }));
    assert.ok(!matches(doc, { languages: /^tam/i }));
    assert.ok(matches(doc, { languages: { $in: [/^tam/i, /^eng/i] } }));
    assert.ok(matches(doc, { $or: [{ slug: /^x/ }, { languages: /hindi/i }] }));
  });

  test('long $in lists use a set and still match array fields', () => {
    const many = Array.from({ length: 500 }, (_, i) => `slug-${i}`);
    assert.ok(!matches(doc, { slug: { $in: many } }));
    assert.ok(matches(doc, { slug: { $in: [...many, 'dr-a'] } }));
    assert.ok(matches(doc, { languages: { $in: [...many, 'Hindi'] } }));
    assert.ok(matches(doc, { slug: { $nin: many } }));
  });

  test('sort order follows MongoDB (missing first ascending, numbers before strings)', () => {
    const rows = [{ k: 'b' }, { k: 2 }, {}, { k: 1 }, { k: 'a' }, { k: null }];
    assert.deepEqual(
      sortBy([...rows], { k: 1 }).map((r) => (r as { k?: unknown }).k ?? null),
      [null, null, 1, 2, 'a', 'b'],
    );
    assert.deepEqual(
      sortBy(
        [
          { r: 1, s: 'b' },
          { r: 2, s: 'a' },
          { r: 2, s: 'b' },
        ],
        { r: -1, s: 1 },
      ),
      [
        { r: 2, s: 'a' },
        { r: 2, s: 'b' },
        { r: 1, s: 'b' },
      ],
    );
  });

  test('projection', () => {
    assert.deepEqual(Object.keys(project(doc, { slug: 1, fee: 1 })).sort(), ['_id', 'fee', 'slug']);
    assert.ok(!('languages' in project(doc, { languages: 0 })));
    assert.deepEqual(Object.keys(project(doc, 'slug city')).sort(), ['_id', 'city', 'slug']);
  });
});
