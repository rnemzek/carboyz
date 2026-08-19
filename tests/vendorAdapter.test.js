import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VendorAdapter } from '../src/adapters/VendorAdapter.js';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';

test('VendorAdapter requires a tenantId', () => {
  assert.throws(() => new VendorAdapter({}), /tenantId/);
});

test('normalizeDealer maps a raw vendor dealer record into a Dealer, tagged with the adapter tenantId', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  const dealer = adapter.normalizeDealer({
    dealer_id: 'vendor-westside',
    dealer_name: 'Westside AutoMart',
    latitude: 39.78,
    longitude: -86.2,
  });

  assert.ok(dealer instanceof Dealer);
  assert.equal(dealer.tenantId, 't1');
  assert.equal(dealer.dealerId, 'vendor-westside');
  assert.equal(dealer.name, 'Westside AutoMart');
  assert.equal(dealer.lat, 39.78);
  assert.equal(dealer.lng, -86.2);
});

test('normalizeDealer also accepts the alternate id/lat/lng field names', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  const dealer = adapter.normalizeDealer({ id: 'alt-id', name: 'Alt Motors', lat: 1.5, lng: -2.5 });
  assert.equal(dealer.dealerId, 'alt-id');
  assert.equal(dealer.name, 'Alt Motors');
  assert.equal(dealer.lat, 1.5);
  assert.equal(dealer.lng, -2.5);
});

test('normalizeVehicle maps a raw vendor vehicle record into a Vehicle, tagged with the adapter tenantId', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  const vehicle = adapter.normalizeVehicle({
    id: 'w-1001',
    dealer_id: 'vendor-westside',
    make: 'Ford',
    model: 'Escape',
    year: 2023,
    asking_price: 27500,
    odometer: 8000,
    body_type: 'suv',
  });

  assert.ok(vehicle instanceof Vehicle);
  assert.equal(vehicle.tenantId, 't1');
  assert.equal(vehicle.vehicleId, 'w-1001');
  assert.equal(vehicle.dealerId, 'vendor-westside');
  assert.equal(vehicle.make, 'Ford');
  assert.equal(vehicle.model, 'Escape');
  assert.equal(vehicle.year, 2023);
  assert.equal(vehicle.price, 27500);
  assert.equal(vehicle.mileage, 8000);
  assert.equal(vehicle.bodyStyle, 'suv');
});

test('normalizeVehicle also accepts the alternate vin/price/mileage/bodyStyle field names', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  const vehicle = adapter.normalizeVehicle({
    vin: '1FA-VIN',
    dealerId: 'dA',
    price: 19999,
    mileage: 45000,
    bodyStyle: 'sedan',
  });
  assert.equal(vehicle.vehicleId, '1FA-VIN');
  assert.equal(vehicle.dealerId, 'dA');
  assert.equal(vehicle.price, 19999);
  assert.equal(vehicle.mileage, 45000);
  assert.equal(vehicle.bodyStyle, 'sedan');
});

test('normalizeFeed normalizes an entire raw feed of dealers and vehicles', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  const { dealers, vehicles } = adapter.normalizeFeed({
    dealers: [{ dealer_id: 'dA', dealer_name: 'A', latitude: 0, longitude: 0 }],
    vehicles: [
      { id: 'v1', dealer_id: 'dA', make: 'Toyota', model: 'Camry', year: 2022, asking_price: 20000 },
    ],
  });

  assert.equal(dealers.length, 1);
  assert.equal(vehicles.length, 1);
  assert.equal(dealers[0].dealerId, 'dA');
  assert.equal(vehicles[0].vehicleId, 'v1');
});

test('normalizeFeed defaults to empty arrays when dealers/vehicles are missing', () => {
  const adapter = new VendorAdapter({ tenantId: 't1' });
  assert.deepEqual(adapter.normalizeFeed(), { dealers: [], vehicles: [] });
});
