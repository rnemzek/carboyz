import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PolicySnapshot } from '../src/models/PolicySnapshot.js';

function baseData(overrides = {}) {
  return {
    policyVersionId: 'v1.1.0',
    tenantId: 't1',
    tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02 }] },
    configHash: 'a'.repeat(64),
    ...overrides,
  };
}

test('PolicySnapshot requires policyVersionId, tenantId, tiersByCompetitor, and configHash', () => {
  assert.throws(() => new PolicySnapshot(baseData({ policyVersionId: undefined })), /policyVersionId/);
  assert.throws(() => new PolicySnapshot(baseData({ tenantId: undefined })), /tenantId/);
  assert.throws(() => new PolicySnapshot(baseData({ tiersByCompetitor: undefined })), /tiersByCompetitor/);
  assert.throws(() => new PolicySnapshot(baseData({ configHash: undefined })), /configHash/);
});

test('capturedAt defaults to the current time when omitted', () => {
  const snapshot = new PolicySnapshot(baseData());
  assert.equal(typeof snapshot.capturedAt, 'string');
  assert.doesNotThrow(() => new Date(snapshot.capturedAt).toISOString());
});

test('capturedAt is preserved when provided explicitly', () => {
  const snapshot = new PolicySnapshot(baseData({ capturedAt: '2026-09-02T00:00:00.000Z' }));
  assert.equal(snapshot.capturedAt, '2026-09-02T00:00:00.000Z');
});

test('getTiersForCompetitor returns a defensive clone', () => {
  const snapshot = new PolicySnapshot(baseData());
  const tiers = snapshot.getTiersForCompetitor('CarMax');
  tiers[0].flatAmount = 999;
  assert.equal(snapshot.getTiersForCompetitor('CarMax')[0].flatAmount, 300);
});

test('getTiersForCompetitor returns an empty array for an unknown competitor', () => {
  const snapshot = new PolicySnapshot(baseData());
  assert.deepEqual(snapshot.getTiersForCompetitor('NotACompetitor'), []);
});

test('mutating the constructor input after construction does not affect the snapshot', () => {
  const tiersByCompetitor = { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02 }] };
  const snapshot = new PolicySnapshot(baseData({ tiersByCompetitor }));
  tiersByCompetitor.CarMax[0].flatAmount = 1;
  assert.equal(snapshot.getTiersForCompetitor('CarMax')[0].flatAmount, 300);
});
