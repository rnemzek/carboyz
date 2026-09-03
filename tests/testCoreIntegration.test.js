import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateVin, isValidVin, decodeVIN, VEHICLE_SEEDS, generateMockOffer, SUPPORTED_COMPETITORS } from '@nemzilla/test-core';

test('@nemzilla/test-core resolves and exports the expected surface', () => {
  assert.equal(typeof generateVin, 'function');
  assert.equal(typeof isValidVin, 'function');
  assert.equal(typeof decodeVIN, 'function');
  assert.ok(Array.isArray(VEHICLE_SEEDS));
  assert.equal(typeof generateMockOffer, 'function');
  assert.ok(Array.isArray(SUPPORTED_COMPETITORS));
});

test('generateVin/isValidVin round-trip through the file: dependency', () => {
  const vin = generateVin({ seed: 55 });
  assert.equal(vin.length, 17);
  assert.equal(isValidVin(vin), true);
});

test('decodeVIN normalizes a stubbed NHTSA response through the file: dependency', async () => {
  const decoded = await decodeVIN('1HGCM82633A004352', {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        Results: [{ ModelYear: '2019', Make: 'Toyota', Model: 'Camry', Trim: 'SE', BodyClass: 'Sedan', EngineCylinders: '4', DriveType: 'FWD' }],
      }),
    }),
  });
  assert.deepEqual(decoded, { year: 2019, make: 'Toyota', model: 'Camry', trim: 'SE', bodyClass: 'Sedan', engineCylinders: 4, driveType: 'FWD' });
});

test('VEHICLE_SEEDS presets each carry a checksum-valid VIN and a mileage', () => {
  assert.equal(VEHICLE_SEEDS.length, 4);
  for (const seed of VEHICLE_SEEDS) {
    assert.equal(isValidVin(seed.vin), true);
    assert.ok(seed.mileage > 0);
  }
  assert.deepEqual(VEHICLE_SEEDS.map((seed) => seed.key).sort(), ['ev', 'sedan', 'suv', 'truck']);
});

test('generateMockOffer covers CarMax, Carvana, and KBB', () => {
  const appraisal = { vin: VEHICLE_SEEDS[0].vin, year: 2021, make: 'Toyota', model: 'Camry', mileage: 32000, offerAmount: 16000 };
  for (const competitor of SUPPORTED_COMPETITORS) {
    const offer = generateMockOffer(competitor, appraisal);
    assert.equal(offer.competitor, competitor);
    assert.match(offer.text, /\$16,000/);
  }
});
