import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { SearchService } from '../src/services/SearchService.js';

const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
const dealerB = new Dealer({ tenantId: 't1', dealerId: 'dB', name: 'B', lat: 0, lng: 0.5 });
const dealerC = new Dealer({ tenantId: 't1', dealerId: 'dC', name: 'C', lat: 0, lng: 10 });

function buildVehicles() {
  return [
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v1',
      dealerId: 'dA',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 20000,
      mileage: 30000,
      bodyStyle: 'sedan',
    }),
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v2',
      dealerId: 'dB',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 25000,
      mileage: 10000,
      bodyStyle: 'sedan',
    }),
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v3',
      dealerId: 'dC',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 18000,
      mileage: 60000,
      bodyStyle: 'sedan',
    }),
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v4',
      dealerId: 'dA',
      make: 'Honda',
      model: 'CRV',
      year: 2021,
      price: 22000,
      mileage: 40000,
      bodyStyle: 'suv',
    }),
    new Vehicle({
      tenantId: 't2',
      vehicleId: 'v5',
      dealerId: 'dA',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 30000,
      mileage: 5000,
      bodyStyle: 'sedan',
    }),
  ];
}

function ids(entries) {
  return entries.map((entry) => entry.vehicle.vehicleId);
}

test('registerDealer makes a newly discovered dealer resolvable for distance-based filtering', () => {
  const service = new SearchService({ dealers: [dealerA] });
  const dealerNew = new Dealer({ tenantId: 't1', dealerId: 'dNew', name: 'New', lat: 0, lng: 0.5 });
  service.registerDealer(dealerNew);

  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v-new',
    dealerId: 'dNew',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 21000,
  });

  const result = service.search([vehicle], { tenantId: 't1', originDealerId: 'dA', radiusMiles: 50 });
  assert.deepEqual(
    result.map((entry) => entry.vehicle.vehicleId),
    ['v-new'],
  );
});

test('search filters by tenantId, isolating other tenants', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), { tenantId: 't1' });
  assert.deepEqual(ids(result).sort(), ['v1', 'v2', 'v3', 'v4']);
});

test('search filters by maxPrice', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), { tenantId: 't1', maxPrice: 22000 });
  assert.deepEqual(ids(result).sort(), ['v1', 'v3', 'v4']);
});

test('search filters by maxMileage', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), { tenantId: 't1', maxMileage: 35000 });
  assert.deepEqual(ids(result).sort(), ['v1', 'v2']);
});

test('search filters by bodyStyle/category', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), { tenantId: 't1', bodyStyle: 'suv' });
  assert.deepEqual(ids(result), ['v4']);
});

test('search filters by make/model/year', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
  });
  assert.deepEqual(ids(result).sort(), ['v1', 'v2', 'v3']);
});

test('search filters by radius from an originDealerId', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    originDealerId: 'dA',
    radiusMiles: 50,
  });
  assert.deepEqual(ids(result).sort(), ['v1', 'v2', 'v4']);
});

test('search filters by radius from a raw origin point', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    origin: { lat: 0, lng: 0 },
    radiusMiles: 50,
  });
  assert.deepEqual(ids(result).sort(), ['v1', 'v2', 'v4']);
});

test('search throws when radiusMiles is given without an origin', () => {
  const service = new SearchService({ dealers: [dealerA] });
  assert.throws(
    () => service.search(buildVehicles(), { radiusMiles: 50 }),
    /requires an origin/,
  );
});

test('search throws when originDealerId is unknown', () => {
  const service = new SearchService({ dealers: [dealerA] });
  assert.throws(
    () => service.search(buildVehicles(), { originDealerId: 'missing', radiusMiles: 50 }),
    /unknown originDealerId/,
  );
});

test('sortBy price_asc orders ascending by price', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    sortBy: 'price_asc',
  });
  assert.deepEqual(ids(result), ['v3', 'v1', 'v2']);
});

test('sortBy mileage_asc orders ascending by mileage', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    sortBy: 'mileage_asc',
  });
  assert.deepEqual(ids(result), ['v2', 'v1', 'v3']);
});

test('sortBy distance_asc orders ascending by distance from the origin', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    originDealerId: 'dA',
    sortBy: 'distance_asc',
  });
  assert.deepEqual(ids(result), ['v1', 'v2', 'v3']);
});

test('search throws when sortBy distance_asc is given without an origin', () => {
  const service = new SearchService({ dealers: [dealerA] });
  assert.throws(
    () => service.search(buildVehicles(), { sortBy: 'distance_asc' }),
    /distance_asc sort requires an origin/,
  );
});

test('sortBy best_value balances price against mileage', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    sortBy: 'best_value',
  });
  assert.deepEqual(ids(result), ['v3', 'v1', 'v2']);
});

test('an unrecognized sortBy leaves filtered results in their original order', () => {
  const service = new SearchService({ dealers: [dealerA, dealerB, dealerC] });
  const result = service.search(buildVehicles(), {
    tenantId: 't1',
    make: 'Toyota',
    sortBy: 'unknown_sort',
  });
  assert.deepEqual(ids(result), ['v1', 'v2', 'v3']);
});
