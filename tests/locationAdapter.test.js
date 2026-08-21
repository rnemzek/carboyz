import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocationQuery, describeCoordinates, createDynamicGeocoder } from '../src/adapters/locationAdapter.js';

function fakeGeocoder(result) {
  return { resolve: async () => result };
}

test('resolveLocationQuery resolves a known 5-digit ZIP from the offline gazetteer', async () => {
  const result = await resolveLocationQuery('28451');
  assert.deepEqual(result, { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' });
});

test('resolveLocationQuery resolves a known city name, case-insensitively', async () => {
  const result = await resolveLocationQuery('  Leland  ');
  assert.equal(result.label, 'Leland, NC');
});

test('resolveLocationQuery resolves "City, ST" formatted input', async () => {
  const result = await resolveLocationQuery('Denver, CO');
  assert.equal(result.label, 'Denver, CO');
});

test('resolveLocationQuery never invokes the geocoder for a gazetteer hit', async () => {
  let called = false;
  const geocoder = { resolve: async () => { called = true; return null; } };
  await resolveLocationQuery('28451', { geocoder });
  assert.equal(called, false);
});

test('resolveLocationQuery falls through to the geocoder for input the gazetteer does not recognize', async () => {
  const geocoder = fakeGeocoder({
    lat: 30.4213,
    lng: -87.2169,
    displayName: 'Pensacola, FL',
    formattedAddress: 'Pensacola, FL, USA',
    boundingBox: { south: 30.35, west: -87.32, north: 30.52, east: -87.14 },
  });

  const result = await resolveLocationQuery('Pensacola, FL', { geocoder });

  assert.deepEqual(result, {
    lat: 30.4213,
    lng: -87.2169,
    label: 'Pensacola, FL',
    formattedAddress: 'Pensacola, FL, USA',
    boundingBox: { south: 30.35, west: -87.32, north: 30.52, east: -87.14 },
  });
});

test('resolveLocationQuery falls through to the geocoder for a bare ZIP the gazetteer does not recognize', async () => {
  const geocoder = fakeGeocoder({ lat: 30.4213, lng: -87.2169, displayName: 'Pensacola, FL 32501', formattedAddress: 'Pensacola, FL 32501, USA' });
  const result = await resolveLocationQuery('32501', { geocoder });
  assert.equal(result.lat, 30.4213);
  assert.equal(result.label, 'Pensacola, FL 32501');
});

test('resolveLocationQuery labels a geocoder result using formattedAddress when displayName is missing', async () => {
  const geocoder = fakeGeocoder({ lat: 1, lng: 2, formattedAddress: '1 Main St, Anytown, ST' });
  const result = await resolveLocationQuery('1 Main St', { geocoder });
  assert.equal(result.label, '1 Main St, Anytown, ST');
});

test('resolveLocationQuery returns null when neither the gazetteer nor the geocoder resolve the input', async () => {
  const geocoder = fakeGeocoder(null);
  assert.equal(await resolveLocationQuery('Nowhereville, ZZ', { geocoder }), null);
});

test('resolveLocationQuery returns null for empty or non-string input without invoking the geocoder', async () => {
  let called = false;
  const geocoder = { resolve: async () => { called = true; return null; } };
  assert.equal(await resolveLocationQuery('', { geocoder }), null);
  assert.equal(await resolveLocationQuery('   ', { geocoder }), null);
  assert.equal(await resolveLocationQuery(undefined, { geocoder }), null);
  assert.equal(called, false);
});

test('createDynamicGeocoder builds a resolver that no-ops with no apiKey configured', async () => {
  const geocoder = createDynamicGeocoder({ fetchImpl: async () => { throw new Error('should not be called'); } });
  assert.equal(await geocoder.resolve('Pensacola, FL'), null);
});

test('describeCoordinates returns the exact label for a known location', () => {
  assert.equal(describeCoordinates(34.2388, -78.0145), 'Leland, NC');
});

test('describeCoordinates returns a "Near" caption for an approximate fix', () => {
  const label = describeCoordinates(34.3, -78.05);
  assert.equal(label, 'Near Leland, NC');
});

test('describeCoordinates falls back gracefully for non-numeric input', () => {
  assert.equal(describeCoordinates(undefined, undefined), 'Current Location');
});
