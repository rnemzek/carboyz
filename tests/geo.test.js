import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceMiles } from '../src/utils/geo.js';

test('haversineDistanceMiles returns 0 for identical coordinates', () => {
  const point = { lat: 40.7128, lng: -74.006 };
  assert.equal(haversineDistanceMiles(point, point), 0);
});

test('haversineDistanceMiles returns the known distance between NYC and LA (~2445 miles)', () => {
  const nyc = { lat: 40.7128, lng: -74.006 };
  const la = { lat: 34.0522, lng: -118.2437 };
  const distance = haversineDistanceMiles(nyc, la);
  assert.ok(Math.abs(distance - 2445) < 15, `expected ~2445 miles, got ${distance}`);
});

test('haversineDistanceMiles is symmetric between two points', () => {
  const a = { lat: 41.8781, lng: -87.6298 };
  const b = { lat: 29.7604, lng: -95.3698 };
  assert.equal(haversineDistanceMiles(a, b), haversineDistanceMiles(b, a));
});
