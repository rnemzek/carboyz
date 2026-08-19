import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';

test('core module exports all expected members', () => {
  assert.equal(typeof core.createTenantConfig, 'function');
  assert.equal(typeof core.DEFAULT_TENANT_CONFIG, 'object');
  assert.equal(typeof core.HapticsService, 'function');
  assert.equal(typeof core.ShareService, 'function');
  assert.equal(typeof core.TelemetryService, 'function');
  assert.equal(typeof core.MarketPosition, 'object');
  assert.equal(typeof core.SearchService, 'function');
  assert.equal(typeof core.IngestService, 'function');
  assert.equal(typeof core.Dealer, 'function');
  assert.equal(typeof core.Vehicle, 'function');
  assert.equal(typeof core.haversineDistanceMiles, 'function');
});
