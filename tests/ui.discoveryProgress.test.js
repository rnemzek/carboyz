import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoveryStageLabel } from '../src/ui/discoveryProgress.js';
import { DiscoveryStage } from '../src/services/DiscoveryService.js';

test('discoveryStageLabel maps each DiscoveryStage to a friendly label', () => {
  assert.equal(discoveryStageLabel(DiscoveryStage.SCANNING), 'Finding Local Lots');
  assert.equal(discoveryStageLabel(DiscoveryStage.PARSING), 'Parsing Inventory');
  assert.equal(discoveryStageLabel(DiscoveryStage.CALCULATING), 'Calculating Telemetry');
  assert.equal(discoveryStageLabel(DiscoveryStage.COMPLETE), 'Complete');
});

test('discoveryStageLabel falls back to a generic label for an unknown stage', () => {
  assert.equal(discoveryStageLabel('SOMETHING_ELSE'), 'Working...');
  assert.equal(discoveryStageLabel(undefined), 'Working...');
});
