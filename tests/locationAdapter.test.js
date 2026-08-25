import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocationQuery, searchLocationSuggestions, describeCoordinates } from '../src/adapters/locationAdapter.js';

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

function fakeNominatimResponse(overrides = null) {
  return {
    ok: true,
    json: async () =>
      overrides ?? [
        { lat: '30.4213', lon: '-87.2169', name: 'Pensacola', display_name: 'Pensacola, FL, USA' },
      ],
  };
}

test('resolveLocationQuery does not touch the OpenStreetMap tier when enableOsm is not set (no API key, no network call)', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeNominatimResponse();
  };
  const result = await resolveLocationQuery('123 Main St, Pensacola, FL', { fetchImpl });
  assert.equal(called, false);
  assert.equal(result, null);
});

test('resolveLocationQuery bridges through OpenStreetMap when enableOsm is true and Google has no key configured', async () => {
  const fetchImpl = async () => fakeNominatimResponse();
  const result = await resolveLocationQuery('123 Main St, Pensacola, FL', { enableOsm: true, fetchImpl });
  assert.deepEqual(result, { lat: 30.4213, lng: -87.2169, label: 'Pensacola' });
});

test('resolveLocationQuery bridges through OpenStreetMap when enableOsm is true and Google finds no match', async () => {
  let googleCalled = false;
  let osmCalled = false;
  const fetchImpl = async (url) => {
    if (typeof url === 'string' && url.includes('googleapis.com')) {
      googleCalled = true;
      return { ok: true, json: async () => ({ places: [] }) };
    }
    osmCalled = true;
    return fakeNominatimResponse();
  };
  const result = await resolveLocationQuery('123 Main St, Pensacola, FL', {
    apiKey: 'test-key',
    enableOsm: true,
    fetchImpl,
  });
  assert.equal(googleCalled, true);
  assert.equal(osmCalled, true);
  assert.deepEqual(result, { lat: 30.4213, lng: -87.2169, label: 'Pensacola' });
});

test('resolveLocationQuery falls back to the offline gazetteer when enableOsm is true but OpenStreetMap also finds no match', async () => {
  const fetchImpl = async () => fakeNominatimResponse([]);
  const result = await resolveLocationQuery('Leland', { enableOsm: true, fetchImpl });
  assert.equal(result.label, 'Leland, NC');
});

test('resolveLocationQuery returns null when enableOsm is true but neither geocoder nor the gazetteer finds a match', async () => {
  const fetchImpl = async () => fakeNominatimResponse([]);
  const result = await resolveLocationQuery('Nowhereville, ZZ', { enableOsm: true, fetchImpl });
  assert.equal(result, null);
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

function fakeMultiGooglePlacesResponse() {
  return {
    ok: true,
    json: async () => ({
      places: [
        { location: { latitude: 30.4213, longitude: -87.2169 }, displayName: { text: 'Pensacola, FL' } },
        { location: { latitude: 30.5, longitude: -87.3 }, displayName: { text: 'Pensacola Beach, FL' } },
      ],
    }),
  };
}

function fakeMultiNominatimResponse() {
  return {
    ok: true,
    json: async () => [
      { lat: '30.4213', lon: '-87.2169', name: 'Pensacola' },
      { lat: '30.5', lon: '-87.3', name: 'Pensacola Beach' },
    ],
  };
}

test('searchLocationSuggestions returns up to `limit` Google candidates when an API key is configured', async () => {
  const fetchImpl = async () => fakeMultiGooglePlacesResponse();
  const results = await searchLocationSuggestions('Pensacola', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(results, [
    { lat: 30.4213, lng: -87.2169, label: 'Pensacola, FL' },
    { lat: 30.5, lng: -87.3, label: 'Pensacola Beach, FL' },
  ]);
});

test('searchLocationSuggestions bridges to OpenStreetMap when enableOsm is true and no API key is configured', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeMultiNominatimResponse();
  };
  const results = await searchLocationSuggestions('Pensacola', { enableOsm: true, fetchImpl });
  assert.equal(called, true);
  assert.deepEqual(results, [
    { lat: 30.4213, lng: -87.2169, label: 'Pensacola' },
    { lat: 30.5, lng: -87.3, label: 'Pensacola Beach' },
  ]);
});

test('searchLocationSuggestions falls back to offline prefix matches with no key/flag configured (no network call)', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeMultiGooglePlacesResponse();
  };
  const results = await searchLocationSuggestions('wil', { fetchImpl });
  assert.equal(called, false);
  assert.deepEqual(results, [{ lat: 34.2257, lng: -77.9447, label: 'Wilmington, NC' }]);
});

test('searchLocationSuggestions offline prefix match also matches on ZIP prefix for numeric input, including multiple matches', async () => {
  // Both 28451 (Leland) and 28401 (Wilmington) start with "284".
  const results = await searchLocationSuggestions('284');
  assert.deepEqual(results, [
    { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' },
    { lat: 34.2257, lng: -77.9447, label: 'Wilmington, NC' },
  ]);
});

test('searchLocationSuggestions falls back to offline prefix matches when Google finds nothing', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ places: [] }) });
  const results = await searchLocationSuggestions('leland', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(results, [{ lat: 34.2388, lng: -78.0145, label: 'Leland, NC' }]);
});

test('searchLocationSuggestions returns [] for unrecognized input with nothing configured', async () => {
  assert.deepEqual(await searchLocationSuggestions('zzzzzz'), []);
});

test('searchLocationSuggestions returns [] for empty or non-string input (no network call)', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeMultiGooglePlacesResponse();
  };
  assert.deepEqual(await searchLocationSuggestions('', { apiKey: 'test-key', fetchImpl }), []);
  assert.deepEqual(await searchLocationSuggestions('   ', { apiKey: 'test-key', fetchImpl }), []);
  assert.deepEqual(await searchLocationSuggestions(undefined, { apiKey: 'test-key', fetchImpl }), []);
  assert.equal(called, false);
});

test('searchLocationSuggestions falls back to the raw query as the label when Google finds a coordinate with no display name', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ places: [{ location: { latitude: 1, longitude: 2 } }] }) });
  const results = await searchLocationSuggestions('Wilming', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(results, [{ lat: 1, lng: 2, label: 'Wilming' }]);
});

test('searchLocationSuggestions respects an explicit limit option', async () => {
  const fetchImpl = async () => fakeMultiGooglePlacesResponse();
  const results = await searchLocationSuggestions('Pensacola', { apiKey: 'test-key', fetchImpl, limit: 1 });
  assert.equal(results.length, 1);
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
