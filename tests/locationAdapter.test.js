import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocationQuery,
  describeCoordinates,
  geocodeLocationQuery,
  resolveGooglePlacesApiKey,
} from '../src/adapters/locationAdapter.js';

function fakePensacolaResponse() {
  return {
    ok: true,
    json: async () => ({
      places: [
        {
          id: 'place-pensacola',
          displayName: { text: 'Pensacola, Florida' },
          formattedAddress: 'Pensacola, FL, USA',
          location: { latitude: 30.4213, longitude: -87.2169 },
          viewport: {
            low: { latitude: 30.3, longitude: -87.35 },
            high: { latitude: 30.55, longitude: -87.1 },
          },
        },
      ],
    }),
  };
}

test('resolveLocationQuery resolves a known 5-digit ZIP', () => {
  const result = resolveLocationQuery('28451');
  assert.deepEqual(result, { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' });
});

test('resolveLocationQuery resolves a known city name, case-insensitively', () => {
  const result = resolveLocationQuery('  Leland  ');
  assert.equal(result.label, 'Leland, NC');
});

test('resolveLocationQuery resolves "City, ST" formatted input', () => {
  const result = resolveLocationQuery('Denver, CO');
  assert.equal(result.label, 'Denver, CO');
});

test('resolveLocationQuery returns null for unrecognized input', () => {
  assert.equal(resolveLocationQuery('Nowhereville, ZZ'), null);
  assert.equal(resolveLocationQuery('00000'), null);
});

test('resolveLocationQuery returns null for empty or non-string input', () => {
  assert.equal(resolveLocationQuery(''), null);
  assert.equal(resolveLocationQuery('   '), null);
  assert.equal(resolveLocationQuery(undefined), null);
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

test('resolveGooglePlacesApiKey prefers an explicit apiKey option', () => {
  assert.equal(resolveGooglePlacesApiKey({ apiKey: 'explicit-key' }), 'explicit-key');
});

test('resolveGooglePlacesApiKey falls back to GOOGLE_PLACES_API_KEY, then window global, then null', () => {
  const original = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    assert.equal(resolveGooglePlacesApiKey(), null);
    process.env.GOOGLE_PLACES_API_KEY = 'env-key';
    assert.equal(resolveGooglePlacesApiKey(), 'env-key');
  } finally {
    if (original !== undefined) process.env.GOOGLE_PLACES_API_KEY = original;
    else delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test('geocodeLocationQuery resolves via the offline gazetteer first, without a network call', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakePensacolaResponse();
  };
  const result = await geocodeLocationQuery('28451', { apiKey: 'test-key', fetchImpl });

  assert.equal(called, false);
  assert.deepEqual(result, { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' });
});

test('geocodeLocationQuery falls back to live Google Places geocoding for a query the offline gazetteer misses', async () => {
  const fetchImpl = async () => fakePensacolaResponse();
  const result = await geocodeLocationQuery('Pensacola, FL', { apiKey: 'test-key', fetchImpl });

  assert.equal(result.lat, 30.4213);
  assert.equal(result.lng, -87.2169);
  assert.equal(result.label, 'Pensacola, Florida');
  assert.equal(result.formattedAddress, 'Pensacola, FL, USA');
  assert.deepEqual(result.boundingBox, { north: 30.55, south: 30.3, east: -87.1, west: -87.35 });
});

test('geocodeLocationQuery resolves a ZIP code the offline gazetteer misses via live geocoding too', async () => {
  const fetchImpl = async () => fakePensacolaResponse();
  const result = await geocodeLocationQuery('32501', { apiKey: 'test-key', fetchImpl });

  assert.equal(result.lat, 30.4213);
  assert.equal(result.lng, -87.2169);
});

test('geocodeLocationQuery returns null with no network call when no API key is configured', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakePensacolaResponse();
  };
  const result = await geocodeLocationQuery('Pensacola, FL', { fetchImpl });

  assert.equal(called, false);
  assert.equal(result, null);
});

test('geocodeLocationQuery returns null for empty input without a network call', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakePensacolaResponse();
  };
  assert.equal(await geocodeLocationQuery('', { apiKey: 'test-key', fetchImpl }), null);
  assert.equal(await geocodeLocationQuery('   ', { apiKey: 'test-key', fetchImpl }), null);
  assert.equal(called, false);
});

test('geocodeLocationQuery returns null when the live geocoder finds nothing', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ places: [] }) });
  const result = await geocodeLocationQuery('Nowhereville, ZZ', { apiKey: 'test-key', fetchImpl });
  assert.equal(result, null);
});

test('geocodeLocationQuery returns null (not throw) when the live geocoder request fails', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  const result = await geocodeLocationQuery('Pensacola, FL', { apiKey: 'test-key', fetchImpl });
  assert.equal(result, null);
});
