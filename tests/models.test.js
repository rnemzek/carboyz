import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';

test('Dealer requires tenantId, dealerId, and numeric coordinates', () => {
  assert.throws(() => new Dealer({ dealerId: 'd1', lat: 1, lng: 1 }), /tenantId/);
  assert.throws(() => new Dealer({ tenantId: 't1', lat: 1, lng: 1 }), /dealerId/);
  assert.throws(() => new Dealer({ tenantId: 't1', dealerId: 'd1', lat: 'x', lng: 1 }), /lat\/lng/);
});

test('Dealer.belongsToTenant checks tenant isolation', () => {
  const dealer = new Dealer({ tenantId: 't1', dealerId: 'd1', name: 'Acme Autos', lat: 1, lng: 1 });
  assert.equal(dealer.belongsToTenant('t1'), true);
  assert.equal(dealer.belongsToTenant('t2'), false);
});

test('Vehicle requires tenantId, vehicleId, dealerId, and a non-negative price', () => {
  assert.throws(() => new Vehicle({ vehicleId: 'v1', dealerId: 'd1', price: 100 }), /tenantId/);
  assert.throws(() => new Vehicle({ tenantId: 't1', dealerId: 'd1', price: 100 }), /vehicleId/);
  assert.throws(() => new Vehicle({ tenantId: 't1', vehicleId: 'v1', price: 100 }), /dealerId/);
  assert.throws(
    () => new Vehicle({ tenantId: 't1', vehicleId: 'v1', dealerId: 'd1', price: -5 }),
    /price/,
  );
});

test('Vehicle.belongsToTenant checks tenant isolation', () => {
  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'd1',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25000,
  });
  assert.equal(vehicle.belongsToTenant('t1'), true);
  assert.equal(vehicle.belongsToTenant('t2'), false);
});

test('Vehicle.matches filters by make/model/year, treating omitted fields as wildcards', () => {
  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'd1',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25000,
  });
  assert.equal(vehicle.matches({ make: 'Toyota' }), true);
  assert.equal(vehicle.matches({ make: 'Toyota', model: 'Camry', year: 2022 }), true);
  assert.equal(vehicle.matches({ make: 'Honda' }), false);
  assert.equal(vehicle.matches(), true);
});

test('Vehicle defaults optional fields, including bodyStyle, to null', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v1', dealerId: 'd1', price: 100 });
  assert.equal(vehicle.bodyStyle, null);
  assert.equal(vehicle.mileage, null);
  assert.equal(vehicle.lat, null);
  assert.equal(vehicle.lng, null);
});

test('Vehicle stores an assigned bodyStyle', () => {
  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'd1',
    price: 100,
    bodyStyle: 'suv',
  });
  assert.equal(vehicle.bodyStyle, 'suv');
});
