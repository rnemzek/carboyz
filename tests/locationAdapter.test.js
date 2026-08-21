import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocationQuery, describeCoordinates } from '../src/adapters/locationAdapter.js';

function fakeGooglePlacesResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      places: [
        {
          location: { latitude: 30.4213, longitude: -87.2169 },
          displayName: { text: 'Pensacola, FL' },
          formattedAddress: 'Pensacola, FL, USA',
        },
      ],
      ...overrides,
    }),
  };
}

test('resolveLocationQuery routes through spatial-core Google Places geocoder when an API key is configured', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeGooglePlacesResponse();
  };
  const result = await resolveLocationQuery('123 Main St, Pensacola, FL', { apiKey: 'test-key', fetchImpl });
  assert.equal(called, true);
  assert.deepEqual(result, { lat: 30.4213, lng: -87.2169, label: 'Pensacola, FL' });
});

test('resolveLocationQuery falls back to the offline gazetteer with no API key configured (no network call)', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeGooglePlacesResponse();
  };
  const result = await resolveLocationQuery('28451', { fetchImpl });
  assert.equal(called, false);
  assert.deepEqual(result, { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' });
});

test('resolveLocationQuery falls back to the offline gazetteer when the Google request fails', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  const result = await resolveLocationQuery('Denver, CO', { apiKey: 'test-key', fetchImpl });
  assert.equal(result.label, 'Denver, CO');
});

test('resolveLocationQuery falls back to the offline gazetteer when Google finds no match', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ places: [] }) });
  const result = await resolveLocationQuery('Leland', { apiKey: 'test-key', fetchImpl });
  assert.equal(result.label, 'Leland, NC');
});

test('resolveLocationQuery resolves a known 5-digit ZIP via the offline gazetteer with no API key', async () => {
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

test('resolveLocationQuery returns null for unrecognized input with no API key configured', async () => {
  assert.equal(await resolveLocationQuery('Nowhereville, ZZ'), null);
  assert.equal(await resolveLocationQuery('00000'), null);
});

test('resolveLocationQuery returns null for empty or non-string input (no network call)', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeGooglePlacesResponse();
  };
  assert.equal(await resolveLocationQuery('', { apiKey: 'test-key', fetchImpl }), null);
  assert.equal(await resolveLocationQuery('   ', { apiKey: 'test-key', fetchImpl }), null);
  assert.equal(await resolveLocationQuery(undefined, { apiKey: 'test-key', fetchImpl }), null);
  assert.equal(called, false);
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
