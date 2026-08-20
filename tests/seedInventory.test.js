import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_ANCHOR,
  CARBOYZ_HQ_DEALER_ID,
  DIRECT_INVENTORY,
  VENDOR_FEEDS,
  seedDirectInventory,
  LELAND_DEALER_ID,
  WILMINGTON_DEALER_ID,
  LOCAL_DEALERS,
  LOCAL_DEALER_INVENTORY,
  seedLocalDealers,
} from '../src/utils/seedInventory.js';
import { haversineDistanceMiles } from '../src/utils/geo.js';
import { TelemetryService, MarketPosition } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { VendorAdapter } from '../src/adapters/VendorAdapter.js';

function vendorVehicleCount() {
  return VENDOR_FEEDS.reduce((total, feed) => total + feed.vehicles.length, 0);
}

test('the seed set totals 20 vehicles split 30% direct / 70% vendor', () => {
  const directCount = DIRECT_INVENTORY.length;
  const vendorCount = vendorVehicleCount();
  assert.equal(directCount + vendorCount, 20);
  assert.equal(directCount, 6);
  assert.equal(vendorCount, 14);
});

test('all direct inventory is assigned to the CarBoyZ HQ dealer', () => {
  assert.ok(DIRECT_INVENTORY.every((vehicle) => vehicle.dealerId === CARBOYZ_HQ_DEALER_ID));
});

test('direct inventory features a Trans Am, a Jeep Wrangler, and a C3 Corvette', () => {
  const models = DIRECT_INVENTORY.map((v) => `${v.make} ${v.model}`);
  assert.ok(models.includes('Pontiac Trans Am'));
  assert.ok(models.includes('Jeep Wrangler'));
  assert.ok(models.includes('Chevrolet Corvette C3'));
});

test('direct inventory produces a realistic +/-1 sigma UNDERPRICED/OVERPRICED spread per model pair', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 'carboyz' });
  seedDirectInventory(ingestService);

  const inventory = ingestService.getInventory();
  const groups = new Map();
  for (const vehicle of inventory) {
    const key = `${vehicle.make}|${vehicle.model}|${vehicle.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(vehicle);
  }

  assert.equal(groups.size, 3);
  for (const vehicles of groups.values()) {
    assert.equal(vehicles.length, 2);
    const stats = telemetryService.getMarketStats(inventory, {
      make: vehicles[0].make,
      model: vehicles[0].model,
      year: vehicles[0].year,
    });
    const positions = vehicles
      .map((v) => telemetryService.evaluateMarketPosition(v, stats))
      .sort();
    assert.deepEqual(positions, [MarketPosition.OVERPRICED, MarketPosition.UNDERPRICED]);
  }
});

test('seedDirectInventory tags every vehicle with the ingest service tenantId', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 'carboyz' });
  const results = seedDirectInventory(ingestService);

  assert.equal(results.length, 6);
  assert.ok(results.every((r) => r.vehicle.tenantId === 'carboyz'));
});

test('every simulated vendor lot is within a 50-mile radius of the ZIP 28451 seed anchor', () => {
  for (const feed of VENDOR_FEEDS) {
    const distance = haversineDistanceMiles(SEED_ANCHOR, { lat: feed.dealer.latitude, lng: feed.dealer.longitude });
    assert.ok(distance <= 50, `${feed.dealer.dealer_name} is ${distance.toFixed(1)}mi away`);
  }
});

test('LOCAL_DEALERS defines Leland and Wilmington NC default local dealer nodes', () => {
  assert.equal(LOCAL_DEALERS.length, 2);
  const ids = LOCAL_DEALERS.map((d) => d.dealerId);
  assert.ok(ids.includes(LELAND_DEALER_ID));
  assert.ok(ids.includes(WILMINGTON_DEALER_ID));
  for (const localDealer of LOCAL_DEALERS) {
    assert.equal(typeof localDealer.lat, 'number');
    assert.equal(typeof localDealer.lng, 'number');
  }
});

test('LOCAL_DEALER_INVENTORY only references LOCAL_DEALERS ids', () => {
  const localDealerIds = new Set(LOCAL_DEALERS.map((d) => d.dealerId));
  assert.ok(LOCAL_DEALER_INVENTORY.every((vehicle) => localDealerIds.has(vehicle.dealerId)));
});

test('seedLocalDealers ingests every LOCAL_DEALER_INVENTORY entry, tagged with the ingest service tenantId', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 'carboyz' });
  const results = seedLocalDealers(ingestService);

  assert.equal(results.length, LOCAL_DEALER_INVENTORY.length);
  assert.ok(results.every((r) => r.vehicle.tenantId === 'carboyz'));
});

test('vendor feed vehicles normalize cleanly through VendorAdapter', () => {
  const adapter = new VendorAdapter({ tenantId: 'carboyz' });
  for (const feed of VENDOR_FEEDS) {
    const dealer = adapter.normalizeDealer(feed.dealer);
    assert.equal(dealer.tenantId, 'carboyz');
    for (const rawVehicle of feed.vehicles) {
      const vehicle = adapter.normalizeVehicle(rawVehicle);
      assert.equal(vehicle.tenantId, 'carboyz');
      assert.equal(vehicle.dealerId, feed.dealer.dealer_id);
      assert.ok(vehicle.price > 0);
    }
  }
});
