import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle } from '../src/models/Vehicle.js';
import { MarketPosition } from '../src/services/TelemetryService.js';
import { buildVehicleCardViewModel, deriveVehicleCondition } from '../src/ui/vehicleCard.js';

function makeVehicle(overrides = {}) {
  return new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25999,
    mileage: 12345,
    bodyStyle: 'sedan',
    ...overrides,
  });
}

test('buildVehicleCardViewModel formats title, price, and mileage', () => {
  const card = buildVehicleCardViewModel({ vehicle: makeVehicle() });
  assert.equal(card.vehicleId, 'v1');
  assert.equal(card.title, '2022 Toyota Camry');
  assert.equal(card.priceLabel, '$25,999');
  assert.equal(card.mileageLabel, '12,345 mi');
  assert.equal(card.bodyStyle, 'sedan');
});

test('buildVehicleCardViewModel reports missing mileage explicitly', () => {
  const card = buildVehicleCardViewModel({ vehicle: makeVehicle({ mileage: null }) });
  assert.equal(card.mileageLabel, 'Mileage unavailable');
});

test('buildVehicleCardViewModel includes a distance label only when distanceMiles is provided', () => {
  const withDistance = buildVehicleCardViewModel({ vehicle: makeVehicle(), distanceMiles: 12.34 });
  assert.equal(withDistance.distanceLabel, '12.3 mi away');

  const withoutDistance = buildVehicleCardViewModel({ vehicle: makeVehicle() });
  assert.equal(withoutDistance.distanceLabel, null);
});

test('buildVehicleCardViewModel includes a market badge only when marketPosition is provided', () => {
  const withBadge = buildVehicleCardViewModel({
    vehicle: makeVehicle(),
    marketPosition: MarketPosition.FAIR,
  });
  assert.deepEqual(withBadge.badge, { label: 'Fair Price', className: 'badge badge--fair' });

  const withoutBadge = buildVehicleCardViewModel({ vehicle: makeVehicle() });
  assert.equal(withoutBadge.badge, null);
});

test('buildVehicleCardViewModel builds share data suitable for ShareService', () => {
  const card = buildVehicleCardViewModel({ vehicle: makeVehicle() });
  assert.equal(card.shareData.title, '2022 Toyota Camry');
  assert.equal(card.shareData.text, '2022 Toyota Camry — $25,999 · 12,345 mi');
});

test('deriveVehicleCondition returns an explicit condition when the vehicle carries one', () => {
  assert.equal(deriveVehicleCondition(makeVehicle({ condition: 'Fair' })), 'Fair');
});

test('deriveVehicleCondition maps low mileage to Certified Pre-Owned', () => {
  assert.equal(deriveVehicleCondition(makeVehicle({ mileage: 8000 })), 'Certified Pre-Owned');
});

test('deriveVehicleCondition maps moderate mileage to Excellent', () => {
  assert.equal(deriveVehicleCondition(makeVehicle({ mileage: 30000 })), 'Excellent');
});

test('deriveVehicleCondition maps high mileage to Good', () => {
  assert.equal(deriveVehicleCondition(makeVehicle({ mileage: 90000 })), 'Good');
});

test('deriveVehicleCondition defaults to Good when mileage is unavailable', () => {
  assert.equal(deriveVehicleCondition(makeVehicle({ mileage: null })), 'Good');
});
