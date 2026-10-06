import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanAreaCounts } from '../src/lib/areas.js';

const known = ['Andheri West', 'Chembur', 'Mira Road'];

describe('clean areas', () => {
  it('keeps known localities, drops the city name, floors, wings and one-off streets', () => {
    const names = [
      ...Array(4).fill('Andheri West'),
      ...Array(2).fill('Chembur'),
      'Mira Road',
      ...Array(9).fill('Mumbai'),
      ...Array(5).fill('B Wing'),
      ...Array(5).fill('First Floor'),
      ...Array(5).fill('Sunrise Building'),
      'jogeshwari station road',
      'Tulsi',
      'Tulsi',
      undefined,
    ];
    const out = cleanAreaCounts(names, 'Mumbai', known);
    assert.deepEqual(out, [
      { name: 'Andheri West', count: 4 },
      { name: 'Chembur', count: 2 },
      { name: 'Mira Road', count: 1 },
    ]);
  });

  it('accepts an unknown locality that appears often enough and reads like a place', () => {
    const out = cleanAreaCounts(Array(3).fill('Vile Parle East'), 'Mumbai', []);
    assert.deepEqual(out, [{ name: 'Vile Parle East', count: 3 }]);
  });
});
