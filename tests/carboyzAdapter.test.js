import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventoryFeatures,
  buildCarboyzLayerConfig,
  buildDealerFeatures,
  buildDealerLayerConfig,
  CARBOYZ_MAP_LAYER_ID,
  CARBOYZ_MAP_TOPIC,
  CARBOYZ_MAP_STYLE,
  CARBOYZ_DEALER_LAYER_ID,
} from '../src/adapters/carboyzAdapter.js';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';

const dealer = new Dealer({ tenantId: 't1', dealerId: 'd1', name: 'CarBoyZ Motors HQ', lat: 35.2, lng: -80.8 });

test('buildInventoryFeatures positions a feature at its dealer coordinates', () => {
  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v1',
    dealerId: 'd1',
    make: 'Honda',
    model: 'Civic',
    year: 2022,
    price: 21000,
    mileage: 12000,
    bodyStyle: 'sedan',
  });

  const features = buildInventoryFeatures({ dealers: [dealer], vehicles: [vehicle] });

  assert.equal(features.length, 1);
  const [feature] = features;
  assert.equal(feature.id, 'v1');
  assert.equal(feature.title, '2022 Honda Civic');
  assert.equal(feature.topic, CARBOYZ_MAP_TOPIC);
  assert.deepEqual(feature.coordinates, { lat: 35.2, lng: -80.8 });
  assert.match(feature.synopsisCardHtml, /Civic/);
  assert.match(feature.synopsisCardHtml, /\$21,000/);
  assert.match(feature.synopsisCardHtml, /12,000 mi/);
  assert.match(feature.synopsisCardHtml, /sedan/);
  assert.match(feature.synopsisCardHtml, /CarBoyZ Motors HQ/);
  assert.deepEqual(feature.metadata, {
    dealerId: 'd1',
    dealerName: 'CarBoyZ Motors HQ',
    price: 21000,
    mileage: 12000,
    bodyStyle: 'sedan',
  });
});

test('buildInventoryFeatures prefers a vehicle-specific lat/lng over its dealer location', () => {
  const vehicle = new Vehicle({
    tenantId: 't1',
    vehicleId: 'v2',
    dealerId: 'd1',
    make: 'Toyota',
    model: 'RAV4',
    price: 26000,
    lat: 40.1,
    lng: -74.5,
  });

  const [feature] = buildInventoryFeatures({ dealers: [dealer], vehicles: [vehicle] });
  assert.deepEqual(feature.coordinates, { lat: 40.1, lng: -74.5 });
});

test('buildInventoryFeatures drops vehicles with no resolvable coordinates', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v3', dealerId: 'unknown-dealer', price: 15000 });
  const features = buildInventoryFeatures({ dealers: [dealer], vehicles: [vehicle] });
  assert.equal(features.length, 0);
});

test('buildInventoryFeatures reports missing mileage explicitly and falls back to a generic title', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v4', dealerId: 'd1', price: 9000 });
  const [feature] = buildInventoryFeatures({ dealers: [dealer], vehicles: [vehicle] });
  assert.equal(feature.title, 'Vehicle');
  assert.match(feature.synopsisCardHtml, /Mileage unavailable/);
});

test('buildInventoryFeatures defaults to empty arrays when dealers/vehicles are missing', () => {
  assert.deepEqual(buildInventoryFeatures(), []);
});

test('buildCarboyzLayerConfig sets the auto topic and CarBoyZ pin style', () => {
  const vehicle = new Vehicle({ tenantId: 't1', vehicleId: 'v1', dealerId: 'd1', make: 'Honda', model: 'Civic', price: 21000 });
  const layerConfig = buildCarboyzLayerConfig({ dealers: [dealer], vehicles: [vehicle] });

  assert.equal(layerConfig.layerId, CARBOYZ_MAP_LAYER_ID);
  assert.equal(layerConfig.topic, 'auto');
  assert.deepEqual(layerConfig.style, CARBOYZ_MAP_STYLE);
  assert.deepEqual(layerConfig.style, { pinColor: '#3B82F6', icon: 'car' });
  assert.equal(layerConfig.features.length, 1);
});

test('buildCarboyzLayerConfig accepts a custom layerId', () => {
  const layerConfig = buildCarboyzLayerConfig({ layerId: 'custom-layer' });
  assert.equal(layerConfig.layerId, 'custom-layer');
  assert.deepEqual(layerConfig.features, []);
});

test('buildDealerFeatures builds one pin per dealership, positioned at the dealer coordinates', () => {
  const vehicle1 = new Vehicle({ tenantId: 't1', vehicleId: 'v1', dealerId: 'd1', make: 'Honda', model: 'Civic', price: 21000 });
  const vehicle2 = new Vehicle({ tenantId: 't1', vehicleId: 'v2', dealerId: 'd1', make: 'Toyota', model: 'RAV4', price: 26000 });

  const features = buildDealerFeatures({ dealers: [dealer], vehicles: [vehicle1, vehicle2] });

  assert.equal(features.length, 1);
  const [feature] = features;
  assert.equal(feature.id, 'd1');
  assert.equal(feature.title, 'CarBoyZ Motors HQ');
  assert.equal(feature.topic, CARBOYZ_MAP_TOPIC);
  assert.deepEqual(feature.coordinates, { lat: 35.2, lng: -80.8 });
  assert.match(feature.synopsisCardHtml, /CarBoyZ Motors HQ/);
  assert.match(feature.synopsisCardHtml, /2 vehicles in stock/);
  assert.deepEqual(feature.metadata, { dealerId: 'd1', vehicleCount: 2 });
});

test('buildDealerFeatures reports a dealer with no inventory', () => {
  const [feature] = buildDealerFeatures({ dealers: [dealer], vehicles: [] });
  assert.equal(feature.metadata.vehicleCount, 0);
  assert.match(feature.synopsisCardHtml, /0 vehicles in stock/);
});

test('buildDealerFeatures drops dealers with no resolvable coordinates', () => {
  const badDealer = { tenantId: 't1', dealerId: 'd2', name: 'No Coords Motors' };
  const features = buildDealerFeatures({ dealers: [badDealer], vehicles: [] });
  assert.equal(features.length, 0);
});

test('buildDealerLayerConfig sets the auto topic, CarBoyZ pin style, and default dealer layerId', () => {
  const layerConfig = buildDealerLayerConfig({ dealers: [dealer], vehicles: [] });
  assert.equal(layerConfig.layerId, CARBOYZ_DEALER_LAYER_ID);
  assert.equal(layerConfig.topic, 'auto');
  assert.deepEqual(layerConfig.style, CARBOYZ_MAP_STYLE);
  assert.equal(layerConfig.features.length, 1);
});
