import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryService, MarketPosition } from '../src/services/TelemetryService.js';
import { DiscoveryService, DiscoveryStage } from '../src/services/DiscoveryService.js';

const instantDelay = () => Promise.resolve();

const NEAR_FEED = {
  dealer: { dealer_id: 'vendor-westside', dealer_name: 'Westside AutoMart', latitude: 0, longitude: 0.5 },
  vehicles: [
    { id: 'w-1', dealer_id: 'vendor-westside', make: 'Toyota', model: 'Camry', year: 2022, asking_price: 20000 },
    { id: 'w-2', dealer_id: 'vendor-westside', make: 'Toyota', model: 'Camry', year: 2022, asking_price: 30000 },
  ],
};

const FAR_FEED = {
  dealer: { dealer_id: 'vendor-farflung', dealer_name: 'Farflung Motors', latitude: 0, longitude: 10 },
  vehicles: [{ id: 'f-1', dealer_id: 'vendor-farflung', make: 'Honda', model: 'Accord', year: 2021, asking_price: 19500 }],
};

test('DiscoveryService requires a telemetryService', () => {
  assert.throws(() => new DiscoveryService({}), /telemetryService/);
});

test('scanRadius requires an origin and a tenantId', () => {
  const service = new DiscoveryService({ telemetryService: new TelemetryService(), delayFn: instantDelay });
  assert.rejects(() => service.scanRadius({ tenantId: 't1' }), /origin/);
  assert.rejects(() => service.scanRadius({ origin: { lat: 0, lng: 0 } }), /tenantId/);
});

test('scanRadius filters vendor feeds to those within the radius', async () => {
  const service = new DiscoveryService({
    telemetryService: new TelemetryService(),
    vendorFeeds: [NEAR_FEED, FAR_FEED],
    delayFn: instantDelay,
  });

  const result = await service.scanRadius({
    origin: { lat: 0, lng: 0 },
    radiusMiles: 50,
    tenantId: 't1',
  });

  assert.equal(result.dealers.length, 1);
  assert.equal(result.dealers[0].dealerId, 'vendor-westside');
  assert.equal(result.vehicleResults.length, 2);
  assert.deepEqual(
    result.vehicleResults.map((r) => r.vehicle.vehicleId).sort(),
    ['w-1', 'w-2'],
  );
});

test('scanRadius tags discovered dealers/vehicles with the requested tenantId', async () => {
  const service = new DiscoveryService({
    telemetryService: new TelemetryService(),
    vendorFeeds: [NEAR_FEED],
    delayFn: instantDelay,
  });

  const result = await service.scanRadius({ origin: { lat: 0, lng: 0 }, tenantId: 'my-tenant' });
  assert.ok(result.dealers.every((d) => d.tenantId === 'my-tenant'));
  assert.ok(result.vehicleResults.every((r) => r.vehicle.tenantId === 'my-tenant'));
});

test('scanRadius computes a live market position for each discovered vehicle', async () => {
  const service = new DiscoveryService({
    telemetryService: new TelemetryService(),
    vendorFeeds: [NEAR_FEED],
    delayFn: instantDelay,
  });

  const result = await service.scanRadius({ origin: { lat: 0, lng: 0 }, tenantId: 't1' });
  const byId = Object.fromEntries(result.vehicleResults.map((r) => [r.vehicle.vehicleId, r.marketPosition]));
  assert.equal(byId['w-1'], MarketPosition.UNDERPRICED);
  assert.equal(byId['w-2'], MarketPosition.OVERPRICED);
});

test('scanRadius emits ordered progress events through SCANNING, PARSING, CALCULATING, and COMPLETE', async () => {
  const service = new DiscoveryService({
    telemetryService: new TelemetryService(),
    vendorFeeds: [NEAR_FEED, FAR_FEED],
    delayFn: instantDelay,
  });

  const events = [];
  const result = await service.scanRadius({
    origin: { lat: 0, lng: 0 },
    radiusMiles: 50,
    tenantId: 't1',
    onProgress: (event) => events.push(event),
  });

  assert.deepEqual(
    events.map((e) => e.stage),
    [
      DiscoveryStage.SCANNING,
      DiscoveryStage.SCANNING,
      DiscoveryStage.PARSING,
      DiscoveryStage.PARSING,
      DiscoveryStage.CALCULATING,
      DiscoveryStage.CALCULATING,
      DiscoveryStage.COMPLETE,
    ],
  );

  const scanFound = events.find((e) => e.stage === DiscoveryStage.SCANNING && 'dealersFound' in e);
  assert.equal(scanFound.dealersFound, 1);

  const parseFound = events.find((e) => e.stage === DiscoveryStage.PARSING && 'vehiclesFound' in e);
  assert.equal(parseFound.vehiclesFound, 2);

  const complete = events.at(-1);
  assert.deepEqual(complete.dealers, result.dealers);
  assert.deepEqual(complete.vehicleResults, result.vehicleResults);
});

test('scanRadius works without an onProgress callback', async () => {
  const service = new DiscoveryService({
    telemetryService: new TelemetryService(),
    vendorFeeds: [NEAR_FEED],
    delayFn: instantDelay,
  });
  await assert.doesNotReject(() => service.scanRadius({ origin: { lat: 0, lng: 0 }, tenantId: 't1' }));
});
