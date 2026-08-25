import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService } from '../src/services/SubmissionService.js';

function makeFakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function baseData(overrides = {}) {
  return {
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    mileage: 30000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 18000,
    ...overrides,
  };
}

test('SubmissionService requires a tenantId', () => {
  assert.throws(() => new SubmissionService({}), /tenantId/);
});

test('submit assigns sequential ids, a timestamp, and status NEW', () => {
  const service = new SubmissionService({ tenantId: 't1' });

  const first = service.submit(baseData());
  const second = service.submit(baseData());

  assert.equal(first.id, 't1-sub-1');
  assert.equal(second.id, 't1-sub-2');
  assert.ok(first.timestamp);
  assert.equal(first.status, 'NEW');
});

test('getSubmissions returns a growing, defensive-copy snapshot', () => {
  const service = new SubmissionService({ tenantId: 't1' });
  service.submit(baseData());

  const snapshot = service.getSubmissions();
  assert.equal(snapshot.length, 1);

  snapshot.push('not-a-submission');
  assert.equal(service.getSubmissions().length, 1);
});

test('submit persists to storage and a new instance rehydrates the array and id sequence', () => {
  const storage = makeFakeStorage();
  const service = new SubmissionService({ tenantId: 't1', storage });

  service.submit(baseData({ vin: 'VIN1' }));
  service.submit(baseData({ vin: 'VIN2' }));

  const rehydrated = new SubmissionService({ tenantId: 't1', storage });
  assert.equal(rehydrated.getSubmissions().length, 2);
  assert.equal(rehydrated.getSubmissions()[1].vin, 'VIN2');

  const third = rehydrated.submit(baseData({ vin: 'VIN3' }));
  assert.equal(third.id, 't1-sub-3');
});

test('works without storage configured, and updateStatus updates and persists', () => {
  const storage = makeFakeStorage();
  const service = new SubmissionService({ tenantId: 't1', storage });
  const created = service.submit(baseData());

  const updated = service.updateStatus(created.id, 'IN_REVIEW');
  assert.equal(updated.status, 'IN_REVIEW');
  assert.equal(service.getSubmissions()[0].status, 'IN_REVIEW');

  const rehydrated = new SubmissionService({ tenantId: 't1', storage });
  assert.equal(rehydrated.getSubmissions()[0].status, 'IN_REVIEW');

  assert.throws(() => service.updateStatus('missing-id', 'DECLINED'), /not found/);
});

test('is a safe no-op without storage — submissions still work for the current session', () => {
  const service = new SubmissionService({ tenantId: 't1' });
  assert.doesNotThrow(() => service.submit(baseData()));
  assert.equal(service.getSubmissions().length, 1);
});
