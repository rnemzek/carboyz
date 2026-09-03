import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpreadConfigService } from '../src/services/SpreadConfigService.js';
import { estimateCarMaxOffer, buildCounterOfferPreview, resolveVehicleFromVin } from '../src/components/dev/TestBedDrawer.js';

test('estimateCarMaxOffer is deterministic and varies by body class', () => {
  const sedan = estimateCarMaxOffer({ year: 2021, bodyClass: 'Sedan', mileage: 30000 });
  const suv = estimateCarMaxOffer({ year: 2021, bodyClass: 'SUV', mileage: 30000 });
  assert.equal(sedan, estimateCarMaxOffer({ year: 2021, bodyClass: 'Sedan', mileage: 30000 }));
  assert.notEqual(sedan, suv);
});

test('estimateCarMaxOffer depreciates older/higher-mileage vehicles below newer/lower-mileage ones', () => {
  const newer = estimateCarMaxOffer({ year: new Date().getFullYear(), bodyClass: 'Sedan', mileage: 5000 });
  const older = estimateCarMaxOffer({ year: new Date().getFullYear() - 10, bodyClass: 'Sedan', mileage: 120000 });
  assert.ok(older < newer);
});

test('estimateCarMaxOffer falls back to a default base value for an unknown body class', () => {
  const known = estimateCarMaxOffer({ year: 2021, bodyClass: 'Sedan', mileage: 30000 });
  const unknown = estimateCarMaxOffer({ year: 2021, bodyClass: 'Spaceship', mileage: 30000 });
  assert.equal(unknown, known); // Sedan's base value equals DEFAULT_BASE_VALUE by design
});

test('buildCounterOfferPreview wires the estimate into SpreadConfigService/calculateSpread', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1', storage: null });
  const preview = buildCounterOfferPreview({ estimatedOffer: 10000, spreadConfigService });

  // Default tiers: [0,15000) -> flatAmount 300 / percent 2%, MAX strategy, autoApprove true.
  assert.equal(preview.recommendedCounterOffer, 10000 + Math.max(300, 10000 * 0.02));
  assert.equal(preview.matchedTier.autoApprove, true);
});

test('buildCounterOfferPreview reflects a custom tier configuration', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't2', storage: null });
  const config = spreadConfigService.getConfig();
  config.tiersByCompetitor.CarMax = [{ minPrice: 0, maxPrice: null, flatAmount: 1000, percent: 0, strategy: 'FLAT_ONLY', autoApprove: false }];
  spreadConfigService.saveConfig(config, { authorId: 'test' });

  const preview = buildCounterOfferPreview({ estimatedOffer: 10000, spreadConfigService });
  assert.equal(preview.recommendedCounterOffer, 11000);
  assert.equal(preview.matchedTier.autoApprove, false);
});

test('resolveVehicleFromVin falls back to manual entry for an invalid checksum without calling decodeVIN', async () => {
  let called = false;
  const vehicle = await resolveVehicleFromVin('A'.repeat(17), { decodeVIN: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(vehicle.source, 'manual-fallback');
  assert.equal(vehicle.reason, 'invalid-checksum');
  assert.equal(vehicle.make, null);
});

test('resolveVehicleFromVin returns decoded specs for a valid VIN + successful decode', async () => {
  const validVin = '1HGCM82633A004352';
  const vehicle = await resolveVehicleFromVin(validVin, {
    decodeVIN: async (vin) => {
      assert.equal(vin, validVin);
      return { year: 2003, make: 'Honda', model: 'Accord', trim: 'EX', bodyClass: 'Sedan', engineCylinders: 6, driveType: 'FWD' };
    },
  });
  assert.equal(vehicle.source, 'nhtsa');
  assert.equal(vehicle.make, 'Honda');
  assert.equal(vehicle.model, 'Accord');
});

test('resolveVehicleFromVin falls back to manual entry when decodeVIN throws', async () => {
  const validVin = '1HGCM82633A004352';
  const vehicle = await resolveVehicleFromVin(validVin, {
    decodeVIN: async () => { throw new Error('NHTSA decode failed with status 500'); },
  });
  assert.equal(vehicle.source, 'manual-fallback');
  assert.equal(vehicle.reason, 'NHTSA decode failed with status 500');
  assert.equal(vehicle.make, null);
});

test('resolveVehicleFromVin normalizes lowercase/whitespace input before validating', async () => {
  let capturedVin = null;
  const vehicle = await resolveVehicleFromVin('  1hgcm82633a004352  ', {
    decodeVIN: async (vin) => {
      capturedVin = vin;
      return { year: 2003, make: 'Honda', model: 'Accord', trim: null, bodyClass: null, engineCylinders: null, driveType: null };
    },
  });
  assert.equal(capturedVin, '1HGCM82633A004352');
  assert.equal(vehicle.vin, '1HGCM82633A004352');
});
