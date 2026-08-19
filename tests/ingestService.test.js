import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryService, MarketPosition } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { Vehicle } from '../src/models/Vehicle.js';

test('IngestService requires a telemetryService and a tenantId', () => {
  const telemetryService = new TelemetryService();
  assert.throws(() => new IngestService({ tenantId: 't1' }), /telemetryService/);
  assert.throws(() => new IngestService({ telemetryService }), /tenantId/);
});

test('intake tags vehicles with the configured tenantId, overriding any payload value', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  const { vehicle } = ingest.intake({
    tenantId: 'malicious-tenant',
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
    mileage: 30000,
  });

  assert.equal(vehicle.tenantId, 't1');
});

test('intake auto-generates sequential vehicleIds when none is supplied', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  const first = ingest.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2022, price: 20000 });
  const second = ingest.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2022, price: 25000 });

  assert.equal(first.vehicle.vehicleId, 't1-veh-1');
  assert.equal(second.vehicle.vehicleId, 't1-veh-2');
});

test('intake respects an explicitly supplied vehicleId', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  const { vehicle } = ingest.intake({
    vehicleId: 'custom-id',
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
  });

  assert.equal(vehicle.vehicleId, 'custom-id');
});

test('intake evaluates market position instantly against prior inventory, and returns null when no comparables exist', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  const first = ingest.intake({
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
  });
  assert.equal(first.marketStats.count, 0);
  assert.equal(first.marketPosition, null);

  const second = ingest.intake({
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25000,
  });
  assert.equal(second.marketStats.count, 1);
  assert.equal(second.marketStats.average, 20000);
  assert.equal(second.marketPosition, MarketPosition.OVERPRICED);
});

test('intake ignores non-comparable vehicles already in inventory', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  ingest.intake({ dealerId: 'dA', make: 'Honda', model: 'CRV', year: 2021, price: 22000 });

  const { marketStats, marketPosition } = ingest.intake({
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
  });

  assert.equal(marketStats.count, 0);
  assert.equal(marketPosition, null);
});

test('getInventory returns a growing, defensive-copy snapshot of ingested vehicles', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({ telemetryService, tenantId: 't1' });

  ingest.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2022, price: 20000 });
  const snapshot = ingest.getInventory();
  assert.equal(snapshot.length, 1);

  snapshot.push('not-a-vehicle');
  assert.equal(ingest.getInventory().length, 1);
});

test('intake seeds from an initial marketVehicles inventory', () => {
  const telemetryService = new TelemetryService();
  const ingest = new IngestService({
    telemetryService,
    tenantId: 't1',
    marketVehicles: [
      new Vehicle({
        tenantId: 't1',
        vehicleId: 'seed-1',
        dealerId: 'dA',
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        price: 24000,
      }),
    ],
  });

  const { marketStats } = ingest.intake({
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
  });

  assert.equal(marketStats.count, 1);
  assert.equal(marketStats.average, 24000);
});
