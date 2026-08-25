import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRegionalDealers } from '../src/utils/generateRegionalDealers.js';
import { haversineDistanceMiles } from '../src/utils/geo.js';

/** Deterministic PRNG (mulberry32) so tests get reproducible-but-varied values instead of a constant. */
function seededRandom(seed) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('generateRegionalDealers returns `count` dealers by default (10)', () => {
  const { dealers } = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', undefined, { random: seededRandom(1) });
  assert.equal(dealers.length, 10);
});

test('generateRegionalDealers respects an explicit count', () => {
  const { dealers } = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 4, { random: seededRandom(2) });
  assert.equal(dealers.length, 4);
});

test('generateRegionalDealers scatters every dealer within ~0.15 degrees (roughly 10mi) of the center', () => {
  const centerLat = 25.7617;
  const centerLng = -80.1918;
  const { dealers } = generateRegionalDealers(centerLat, centerLng, 'Miami, FL', 25, { random: seededRandom(3) });

  for (const dealer of dealers) {
    assert.ok(Math.abs(dealer.lat - centerLat) <= 0.15, `lat drifted too far: ${dealer.lat}`);
    assert.ok(Math.abs(dealer.lng - centerLng) <= 0.15, `lng drifted too far: ${dealer.lng}`);
  }
});

test('generateRegionalDealers assigns every dealer a unique id and numeric coordinates', () => {
  const { dealers } = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 10, { random: seededRandom(4) });
  const ids = dealers.map((d) => d.dealerId);
  assert.equal(new Set(ids).size, ids.length);
  for (const dealer of dealers) {
    assert.equal(typeof dealer.lat, 'number');
    assert.equal(typeof dealer.lng, 'number');
  }
});

test('generateRegionalDealers derives dealer names from a short place name, cycling through varied templates', () => {
  const { dealers } = generateRegionalDealers(25.7617, -80.1918, 'Miami, Miami-Dade County, Florida', 7, {
    random: seededRandom(5),
  });
  const names = dealers.map((d) => d.name);
  assert.deepEqual(names, [
    'Miami Motors',
    'Miami Truck Hub',
    'Coastal Miami Auto',
    'Miami Auto Exchange',
    'Miami Motor Works',
    'Downtown Miami Autos',
    'Miami Auto Gallery',
  ]);
});

test('generateRegionalDealers falls back to a generic name when the location label is blank', () => {
  const { dealers } = generateRegionalDealers(0, 0, '', 1, { random: seededRandom(6) });
  assert.equal(dealers[0].name, 'Local Motors');
});

test('generateRegionalDealers seeds 2-5 vehicles per dealer, each referencing a real dealerId', () => {
  const { dealers, vehicles } = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 10, { random: seededRandom(7) });
  const dealerIds = new Set(dealers.map((d) => d.dealerId));
  const countByDealer = new Map();
  for (const vehicle of vehicles) {
    assert.ok(dealerIds.has(vehicle.dealerId));
    countByDealer.set(vehicle.dealerId, (countByDealer.get(vehicle.dealerId) ?? 0) + 1);
  }
  assert.equal(countByDealer.size, dealers.length);
  for (const count of countByDealer.values()) {
    assert.ok(count >= 2 && count <= 5, `expected 2-5 vehicles, got ${count}`);
  }
});

test('generateRegionalDealers seeds every vehicle with realistic price/mileage/year attributes and a unique vehicleId', () => {
  const { vehicles } = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 10, { random: seededRandom(8) });
  const ids = vehicles.map((v) => v.vehicleId);
  assert.equal(new Set(ids).size, ids.length);

  for (const vehicle of vehicles) {
    assert.equal(typeof vehicle.make, 'string');
    assert.ok(vehicle.make.length > 0);
    assert.equal(typeof vehicle.model, 'string');
    assert.ok(vehicle.model.length > 0);
    assert.ok(typeof vehicle.bodyStyle === 'string' && vehicle.bodyStyle.length > 0);
    assert.ok(vehicle.year >= 2018 && vehicle.year <= 2023);
    assert.ok(vehicle.price >= 15000 && vehicle.price <= 45000);
    assert.ok(vehicle.mileage >= 5000 && vehicle.mileage <= 90000);
  }
});

test('generateRegionalDealers is deterministic given the same injected random sequence', () => {
  const a = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 5, { random: seededRandom(42) });
  const b = generateRegionalDealers(25.7617, -80.1918, 'Miami, FL', 5, { random: seededRandom(42) });
  assert.deepEqual(a, b);
});

test('generateRegionalDealers defaults random to Math.random and still produces valid, in-range output', () => {
  const { dealers, vehicles } = generateRegionalDealers(39.74, -104.99, 'Denver, CO');
  assert.equal(dealers.length, 10);
  for (const dealer of dealers) {
    assert.ok(haversineDistanceMiles({ lat: 39.74, lng: -104.99 }, dealer) < 15);
  }
  assert.ok(vehicles.length >= 20 && vehicles.length <= 50);
});
