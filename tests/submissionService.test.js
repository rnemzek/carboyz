import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService, SYNC_STATES } from '../src/services/SubmissionService.js';

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

test('receiveExternalSubmission adds a synced submission arriving with an id already assigned', () => {
  const storage = makeFakeStorage();
  const service = new SubmissionService({ tenantId: 't1', storage });

  const result = service.receiveExternalSubmission({
    ...baseData(),
    id: 't1-sub-99',
    timestamp: '2026-08-28T00:00:00.000Z',
    status: 'NEW',
  });

  assert.equal(result.id, 't1-sub-99');
  assert.equal(service.getSubmissions().length, 1);
  const rehydrated = new SubmissionService({ tenantId: 't1', storage });
  assert.equal(rehydrated.getSubmissions()[0].id, 't1-sub-99');
});

test('receiveExternalSubmission ignores a duplicate id already present locally', () => {
  const service = new SubmissionService({ tenantId: 't1' });
  const created = service.submit(baseData());

  const result = service.receiveExternalSubmission({ ...created, id: created.id });

  assert.equal(result, null);
  assert.equal(service.getSubmissions().length, 1);
});

test('submit() while offline queues the submission for sync and marks it PENDING_SYNC', () => {
  const service = new SubmissionService({ tenantId: 't1', isOnline: () => false });

  const submission = service.submit(baseData());

  assert.equal(service.getSyncState(submission.id), SYNC_STATES.PENDING_SYNC);
  assert.deepEqual(
    service.getPendingSyncSubmissions().map((s) => s.id),
    [submission.id],
  );
});

test('submit() while online does not queue the submission', () => {
  const service = new SubmissionService({ tenantId: 't1', isOnline: () => true });

  const submission = service.submit(baseData());

  assert.equal(service.getSyncState(submission.id), SYNC_STATES.SYNCED);
  assert.equal(service.getPendingSyncSubmissions().length, 0);
});

test('the offline queue persists across reload and rehydrates filtered to submissions that still exist', () => {
  const storage = makeFakeStorage();
  const service = new SubmissionService({ tenantId: 't1', storage, isOnline: () => false });
  const submission = service.submit(baseData());

  const rehydrated = new SubmissionService({ tenantId: 't1', storage, isOnline: () => true });
  assert.deepEqual(
    rehydrated.getPendingSyncSubmissions().map((s) => s.id),
    [submission.id],
  );
});

test('flushPendingSync() replays every queued submission through syncFn and clears the queue', () => {
  const storage = makeFakeStorage();
  const service = new SubmissionService({ tenantId: 't1', storage, isOnline: () => false });
  const first = service.submit(baseData({ vin: 'VIN1' }));
  const second = service.submit(baseData({ vin: 'VIN2' }));

  const calls = [];
  const { flushed, remaining } = service.flushPendingSync((submission) => calls.push(submission.id));

  assert.deepEqual(calls, [first.id, second.id]);
  assert.deepEqual(flushed.map((s) => s.id), [first.id, second.id]);
  assert.deepEqual(remaining, []);
  assert.equal(service.getPendingSyncSubmissions().length, 0);
  assert.equal(service.getSyncState(first.id), SYNC_STATES.SYNCED);

  const rehydrated = new SubmissionService({ tenantId: 't1', storage });
  assert.equal(rehydrated.getPendingSyncSubmissions().length, 0);
});

test('flushPendingSync() keeps a submission queued when syncFn throws, so a flaky reconnect can retry it', () => {
  const service = new SubmissionService({ tenantId: 't1', isOnline: () => false });
  const ok = service.submit(baseData({ vin: 'VIN1' }));
  const flaky = service.submit(baseData({ vin: 'VIN2' }));

  const { flushed, remaining } = service.flushPendingSync((submission) => {
    if (submission.id === flaky.id) {
      throw new Error('relay unreachable');
    }
  });

  assert.deepEqual(flushed.map((s) => s.id), [ok.id]);
  assert.deepEqual(remaining.map((s) => s.id), [flaky.id]);
  assert.equal(service.getSyncState(flaky.id), SYNC_STATES.PENDING_SYNC);
});

test('flushPendingSync() is a safe no-op with an empty queue or without a syncFn', () => {
  const service = new SubmissionService({ tenantId: 't1', isOnline: () => true });
  service.submit(baseData());

  assert.deepEqual(service.flushPendingSync(() => {}), { flushed: [], remaining: [] });
  assert.deepEqual(service.flushPendingSync(), { flushed: [], remaining: [] });
});

test('enqueueForSync() does not duplicate an id already queued', () => {
  const service = new SubmissionService({ tenantId: 't1', isOnline: () => false });
  const submission = service.submit(baseData());

  service.enqueueForSync(submission.id);

  assert.equal(service.getPendingSyncSubmissions().length, 1);
});

test('receiveExternalSubmission ignores payloads without an id or that fail Submission validation', () => {
  const service = new SubmissionService({ tenantId: 't1' });

  assert.equal(service.receiveExternalSubmission(null), null);
  assert.equal(service.receiveExternalSubmission({}), null);
  assert.equal(
    service.receiveExternalSubmission({ ...baseData(), id: 't1-sub-1', timestamp: '2026-08-28T00:00:00.000Z', competitor: 'NotReal' }),
    null,
  );
  assert.equal(service.getSubmissions().length, 0);
});
