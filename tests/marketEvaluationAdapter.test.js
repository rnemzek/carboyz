import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompPool, evaluateVehicleMarketPosition } from '../src/adapters/marketEvaluationAdapter.js';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';

const dealer = new Dealer({ tenantId: 't1', dealerId: 'd1', name: 'CarBoyZ Motors HQ', lat: 35.2271, lng: -80.8431 });

function nearbyVehicle(vehicleId, price, latOffset, lngOffset) {
  return new Vehicle({
    tenantId: 't1',
    vehicleId,
    dealerId: 'd1',
    make: 'Honda',
    model: 'Civic',
    year: 2022,
    price,
    lat: dealer.lat + latOffset,
    lng: dealer.lng + lngOffset,
  });
}

test('buildCompPool maps vehicles with their own coordinates into CompTarget points', () => {
  const vehicle = nearbyVehicle('v1', 21000, 0, 0);
  const pool = buildCompPool([vehicle], [dealer]);

  assert.deepEqual(pool, [
    { id: 'v1', price: 21000, mileage: undefined, year: 2022, lat: dealer.lat, lng: dealer.lng },
  ]);
});

test('buildCompPool falls back to the dealer location when a vehicle has no lat/lng', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v2', dealerId: 'd1', price: 15000 });
  const [comp] = buildCompPool([vehicle], [dealer]);
  assert.equal(comp.lat, dealer.lat);
  assert.equal(comp.lng, dealer.lng);
});

test('buildCompPool drops vehicles with no resolvable coordinates', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v3', dealerId: 'unknown-dealer', price: 9000 });
  assert.deepEqual(buildCompPool([vehicle], [dealer]), []);
});

test('evaluateVehicleMarketPosition returns an Underpriced verdict for a below-median vehicle', () => {
  const target = nearbyVehicle('target', 15000, 0, 0);
  const vehicles = [
    target,
    nearbyVehicle('c1', 20000, 0.01, 0.01),
    nearbyVehicle('c2', 20500, -0.01, 0.01),
    nearbyVehicle('c3', 19800, 0.01, -0.01),
  ];

  const result = evaluateVehicleMarketPosition(target, { vehicles, dealers: [dealer] });

  assert.equal(result.verdict, 'Underpriced');
  assert.equal(result.compCount, 3);
  assert.match(result.summary, /below/);
});

test('evaluateVehicleMarketPosition returns null when the vehicle has no resolvable coordinates', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v4', dealerId: 'unknown-dealer', price: 9000 });
  const result = evaluateVehicleMarketPosition(vehicle, { vehicles: [vehicle], dealers: [dealer] });
  assert.equal(result, null);
});
