import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChatQuery,
  filterVehiclesByQuery,
  rankTopMatches,
  parseChatQueryWithLLM,
  resolveChatQuery,
} from '../src/adapters/chatFilterAdapter.js';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';

test('parseChatQuery parses body style, budget (with k suffix), and low-miles', () => {
  const query = parseChatQuery('Looking for an SUV under $30k with low miles...');
  assert.deepEqual(query, { bodyStyle: 'suv', maxPrice: 30000, maxMileage: 30000 });
});

test('parseChatQuery parses an explicit mileage cap distinct from budget', () => {
  const query = parseChatQuery('Sedan under $20,000 with less than 40,000 miles');
  assert.deepEqual(query, { bodyStyle: 'sedan', maxPrice: 20000, maxMileage: 40000 });
});

test('parseChatQuery parses a plain numeric budget without a k suffix', () => {
  const query = parseChatQuery('truck under 25000');
  assert.deepEqual(query, { bodyStyle: 'truck', maxPrice: 25000 });
});

test('parseChatQuery parses a year range', () => {
  const query = parseChatQuery('coupe from 2015-2020');
  assert.deepEqual(query, { bodyStyle: 'coupe', minYear: 2015, maxYear: 2020 });
});

test('parseChatQuery parses "after YYYY" as a minimum year', () => {
  const query = parseChatQuery('van after 2018');
  assert.deepEqual(query, { bodyStyle: 'van', minYear: 2018 });
});

test('parseChatQuery parses "before YYYY" as a maximum year', () => {
  const query = parseChatQuery('hatchback before 2015');
  assert.deepEqual(query, { bodyStyle: 'hatchback', maxYear: 2015 });
});

test('parseChatQuery returns an empty object when nothing is recognized', () => {
  assert.deepEqual(parseChatQuery('something with wheels'), {});
  assert.deepEqual(parseChatQuery(), {});
});

function makeVehicle(overrides = {}) {
  return new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'd1',
    make: 'Honda',
    model: 'CR-V',
    year: 2021,
    price: 27000,
    mileage: 20000,
    bodyStyle: 'suv',
    ...overrides,
  });
}

test('filterVehiclesByQuery applies bodyStyle, maxPrice, maxMileage, and year-range filters', () => {
  const vehicles = [
    makeVehicle({ vehicleId: 'v1' }),
    makeVehicle({ vehicleId: 'v2', bodyStyle: 'sedan' }),
    makeVehicle({ vehicleId: 'v3', price: 45000 }),
    makeVehicle({ vehicleId: 'v4', mileage: 80000 }),
    makeVehicle({ vehicleId: 'v5', year: 2010 }),
  ];

  const results = filterVehiclesByQuery(vehicles, { bodyStyle: 'suv', maxPrice: 30000, maxMileage: 30000, minYear: 2015 });
  assert.deepEqual(results.map((vehicle) => vehicle.vehicleId), ['v1']);
});

test('filterVehiclesByQuery drops vehicles with unresolvable mileage/year when a bound is set', () => {
  const noMileage = makeVehicle({ vehicleId: 'no-mileage', mileage: null });
  const noYear = makeVehicle({ vehicleId: 'no-year', year: null });
  assert.deepEqual(filterVehiclesByQuery([noMileage], { maxMileage: 30000 }), []);
  assert.deepEqual(filterVehiclesByQuery([noYear], { minYear: 2015 }), []);
});

test('filterVehiclesByQuery returns the full pool when the query is empty', () => {
  const vehicles = [makeVehicle()];
  assert.deepEqual(filterVehiclesByQuery(vehicles, {}), vehicles);
});

test('filterVehiclesByQuery applies conditionPreference against the derived vehicle condition', () => {
  const certified = makeVehicle({ vehicleId: 'certified', mileage: 8000 });
  const excellent = makeVehicle({ vehicleId: 'excellent', mileage: 30000 });
  const good = makeVehicle({ vehicleId: 'good', mileage: 90000 });

  const results = filterVehiclesByQuery([certified, excellent, good], { conditionPreference: ['excellent'] });
  assert.deepEqual(results.map((vehicle) => vehicle.vehicleId), ['excellent']);
});

test('rankTopMatches filters, evaluates against market comps, and returns the best-value top N', () => {
  const dealer = new Dealer({ tenantId: 't1', dealerId: 'd1', name: 'CarBoyZ Motors HQ', lat: 35.2271, lng: -80.8431 });

  function nearbySuv(vehicleId, price, latOffset, lngOffset) {
    return new Vehicle({
      tenantId: 't1',
      vehicleId,
      dealerId: 'd1',
      make: 'Honda',
      model: 'CR-V',
      year: 2021,
      price,
      mileage: 20000,
      bodyStyle: 'suv',
      lat: dealer.lat + latOffset,
      lng: dealer.lng + lngOffset,
    });
  }

  const underpriced = nearbySuv('cheap', 15000, 0, 0);
  const vehicles = [
    underpriced,
    nearbySuv('c1', 20000, 0.01, 0.01),
    nearbySuv('c2', 20500, -0.01, 0.01),
    nearbySuv('c3', 19800, 0.01, -0.01),
    new Vehicle({ tenantId: 't1', vehicleId: 'wrong-style', dealerId: 'd1', price: 15000, bodyStyle: 'sedan', lat: dealer.lat, lng: dealer.lng }),
  ];

  const matches = rankTopMatches(vehicles, [dealer], { bodyStyle: 'suv', maxPrice: 21000 }, { topN: 2 });

  assert.equal(matches.length, 2);
  assert.equal(matches[0].vehicle.vehicleId, 'cheap');
  assert.equal(matches[0].evaluation.verdict, 'Underpriced');
  assert.equal(matches[0].dealer.dealerId, 'd1');
});

function withoutAnthropicEnvKey(fn) {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    });
}

function llmResponse(text) {
  return { ok: true, json: async () => ({ content: [{ text }] }) };
}

test('parseChatQueryWithLLM returns null when no API key is configured (fetch is never called)', () =>
  withoutAnthropicEnvKey(async () => {
    const fetchImpl = () => {
      throw new Error('fetchImpl should not be called without an API key');
    };
    const result = await parseChatQueryWithLLM('SUV under $30k', { fetchImpl });
    assert.equal(result, null);
  }));

test('parseChatQueryWithLLM returns null when the request fails (offline)', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  const result = await parseChatQueryWithLLM('SUV under $30k', { apiKey: 'test-key', fetchImpl });
  assert.equal(result, null);
});

test('parseChatQueryWithLLM returns null on a non-ok HTTP response', async () => {
  const fetchImpl = async () => ({ ok: false });
  const result = await parseChatQueryWithLLM('SUV under $30k', { apiKey: 'test-key', fetchImpl });
  assert.equal(result, null);
});

test('parseChatQueryWithLLM returns null when the response has no parseable JSON', async () => {
  const fetchImpl = async () => llmResponse("Sorry, I can't help with that.");
  const result = await parseChatQueryWithLLM('gibberish query', { apiKey: 'test-key', fetchImpl });
  assert.equal(result, null);
});

test('parseChatQueryWithLLM parses and normalizes a valid structured response', async () => {
  const fetchImpl = async () =>
    llmResponse(
      JSON.stringify({
        maxPrice: 25000,
        maxMileage: 40000,
        minYear: 2018,
        bodyStyle: 'SUV',
        conditionPreference: ['Excellent'],
        intentSummary: 'Buyer wants a newer, low-mileage SUV under $25k.',
      }),
    );

  const result = await parseChatQueryWithLLM('Looking for a newer SUV under 25k', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(result, {
    maxPrice: 25000,
    maxMileage: 40000,
    minYear: 2018,
    bodyStyle: 'suv',
    conditionPreference: ['Excellent'],
    intentSummary: 'Buyer wants a newer, low-mileage SUV under $25k.',
  });
});

test('parseChatQueryWithLLM drops an invalid bodyStyle but keeps the rest of the response', async () => {
  const fetchImpl = async () =>
    llmResponse(JSON.stringify({ bodyStyle: 'Wagon', maxPrice: 15000, intentSummary: 'Buyer wants a cheap wagon.' }));

  const result = await parseChatQueryWithLLM('cheap wagon', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(result, { maxPrice: 15000, intentSummary: 'Buyer wants a cheap wagon.' });
});

test('resolveChatQuery prefers a successful LLM parse over the regex parser', async () => {
  const fetchImpl = async () =>
    llmResponse(JSON.stringify({ bodyStyle: 'Truck', maxPrice: 40000, intentSummary: 'Buyer wants a truck under $40k.' }));

  const query = await resolveChatQuery('gimme a work truck, forty grand tops', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(query, { bodyStyle: 'truck', maxPrice: 40000, intentSummary: 'Buyer wants a truck under $40k.' });
});

test('resolveChatQuery falls back to the regex parser and synthesizes an intentSummary when the LLM is unavailable', () =>
  withoutAnthropicEnvKey(async () => {
    const query = await resolveChatQuery('Looking for an SUV under $30k with low miles...');
    assert.deepEqual(query, {
      bodyStyle: 'suv',
      maxPrice: 30000,
      maxMileage: 30000,
      intentSummary: 'Looking for a suv, under $30,000, under 30,000 miles.',
    });
  }));

test('resolveChatQuery falls back to the raw text as intentSummary when nothing else parses', () =>
  withoutAnthropicEnvKey(async () => {
    const query = await resolveChatQuery('something with wheels');
    assert.deepEqual(query, { intentSummary: 'something with wheels' });
  }));
