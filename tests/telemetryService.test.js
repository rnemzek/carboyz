import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { TelemetryService, MarketPosition } from '../src/services/TelemetryService.js';

function makeVehicle(overrides = {}) {
  return new Vehicle({
    tenantId: 't1',
    vehicleId: overrides.vehicleId ?? 'v1',
    dealerId: overrides.dealerId ?? 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25000,
    ...overrides,
  });
}

test('registerDealer makes a dealer resolvable for vehicle location lookups after construction', () => {
  const service = new TelemetryService();
  const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
  service.registerDealer(dealerA);

  const vehicle = makeVehicle({ dealerId: 'dA' });
  assert.deepEqual(service.resolveVehicleLocation(vehicle), { lat: 0, lng: 0 });
});

test('filterByRadius includes vehicles within range and excludes vehicles outside range', () => {
  const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
  const dealerB = new Dealer({ tenantId: 't1', dealerId: 'dB', name: 'B', lat: 0, lng: 0.5 });
  const dealerC = new Dealer({ tenantId: 't1', dealerId: 'dC', name: 'C', lat: 0, lng: 10 });

  const service = new TelemetryService({ dealers: [dealerA, dealerB, dealerC] });

  const vehicles = [
    makeVehicle({ vehicleId: 'near', dealerId: 'dB' }),
    makeVehicle({ vehicleId: 'far', dealerId: 'dC' }),
  ];

  const result = service.filterByRadius(vehicles, dealerA, 50);
  assert.deepEqual(
    result.map((v) => v.vehicleId),
    ['near'],
  );
});

test('filterByRadius enforces tenant isolation, excluding vehicles from other tenants', () => {
  const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
  const service = new TelemetryService({ dealers: [dealerA] });

  const vehicles = [
    makeVehicle({ vehicleId: 'same-tenant', dealerId: 'dA', tenantId: 't1' }),
    makeVehicle({ vehicleId: 'other-tenant', dealerId: 'dA', tenantId: 't2' }),
  ];

  const result = service.filterByRadius(vehicles, dealerA, 50);
  assert.deepEqual(
    result.map((v) => v.vehicleId),
    ['same-tenant'],
  );
});

test('filterByRadius excludes vehicles whose dealer location cannot be resolved', () => {
  const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
  const service = new TelemetryService({ dealers: [dealerA] });

  const vehicles = [makeVehicle({ vehicleId: 'orphan', dealerId: 'unknown-dealer' })];
  const result = service.filterByRadius(vehicles, dealerA, 50);
  assert.deepEqual(result, []);
});

test('getMarketStats computes average, min, max, median, spread, and standard deviation', () => {
  const service = new TelemetryService();
  const prices = [20000, 22000, 24000, 26000, 28000];
  const vehicles = prices.map((price, i) => makeVehicle({ vehicleId: `v${i}`, price }));

  const stats = service.getMarketStats(vehicles, { make: 'Toyota', model: 'Camry', year: 2022 });

  assert.equal(stats.count, 5);
  assert.equal(stats.average, 24000);
  assert.equal(stats.min, 20000);
  assert.equal(stats.max, 28000);
  assert.equal(stats.median, 24000);
  assert.equal(stats.priceSpread, 8000);
  assert.ok(Math.abs(stats.standardDeviation - 2828.4271) < 0.01);
});

test('getMarketStats computes the median correctly for an even-sized data set', () => {
  const service = new TelemetryService();
  const prices = [10000, 20000, 30000, 40000];
  const vehicles = prices.map((price, i) => makeVehicle({ vehicleId: `v${i}`, price }));

  const stats = service.getMarketStats(vehicles);
  assert.equal(stats.median, 25000);
});

test('getMarketStats returns nulls when no vehicles match the filter', () => {
  const service = new TelemetryService();
  const stats = service.getMarketStats([], { make: 'Honda' });
  assert.deepEqual(stats, {
    count: 0,
    average: null,
    min: null,
    max: null,
    median: null,
    priceSpread: null,
    standardDeviation: null,
  });
});

test('evaluateMarketPosition classifies UNDERPRICED, FAIR, and OVERPRICED vehicles', () => {
  const service = new TelemetryService();
  const marketStats = { average: 24000, standardDeviation: 2828.4271 };

  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 20000 }), marketStats),
    MarketPosition.UNDERPRICED,
  );
  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 24000 }), marketStats),
    MarketPosition.FAIR,
  );
  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 23000 }), marketStats),
    MarketPosition.FAIR,
  );
  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 28000 }), marketStats),
    MarketPosition.OVERPRICED,
  );
});

test('evaluateMarketPosition handles zero standard deviation by comparing directly to average', () => {
  const service = new TelemetryService();
  const marketStats = { average: 25000, standardDeviation: 0 };

  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 25000 }), marketStats),
    MarketPosition.FAIR,
  );
  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 24000 }), marketStats),
    MarketPosition.UNDERPRICED,
  );
  assert.equal(
    service.evaluateMarketPosition(makeVehicle({ price: 26000 }), marketStats),
    MarketPosition.OVERPRICED,
  );
});

test('evaluateMarketPosition throws when market statistics have no average', () => {
  const service = new TelemetryService();
  assert.throws(
    () => service.evaluateMarketPosition(makeVehicle(), { average: null, standardDeviation: null }),
    /market statistics/,
  );
});
