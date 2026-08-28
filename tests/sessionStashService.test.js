import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionStashService } from '../src/services/SessionStashService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

function makeFakeChannel() {
  const listeners = [];
  const posted = [];
  return {
    posted,
    addEventListener: (type, handler) => listeners.push(handler),
    removeEventListener: (type, handler) => {
      const index = listeners.indexOf(handler);
      if (index !== -1) listeners.splice(index, 1);
    },
    postMessage: (data) => {
      posted.push(data);
      listeners.forEach((handler) => handler({ data }));
    },
  };
}

test('SessionStashService requires a tenantId', () => {
  assert.throws(() => new SessionStashService({}), /tenantId/);
});

test('createPending stores a PENDING entry and returns a pendingSessionId', () => {
  const storage = makeMemoryStorage();
  const service = new SessionStashService({ tenantId: 't1', storage, channel: makeFakeChannel() });

  const pendingSessionId = service.createPending('sub-1');

  assert.ok(pendingSessionId);
  const status = service.getStatus(pendingSessionId);
  assert.equal(status.submissionId, 'sub-1');
  assert.equal(status.status, 'PENDING');
  assert.equal(status.finalCounterOffer, null);
});

test('getStatus returns null for an unknown pendingSessionId', () => {
  const service = new SessionStashService({ tenantId: 't1', storage: makeMemoryStorage(), channel: makeFakeChannel() });
  assert.equal(service.getStatus('nope'), null);
});

test('resolveBySubmissionId flips the matching pending entry to READY with the given amount', () => {
  const storage = makeMemoryStorage();
  const channel = makeFakeChannel();
  const service = new SessionStashService({ tenantId: 't1', storage, channel });
  const pendingSessionId = service.createPending('sub-1');

  const updated = service.resolveBySubmissionId('sub-1', { finalCounterOffer: 16500 });

  assert.equal(updated.status, 'READY');
  assert.equal(updated.finalCounterOffer, 16500);
  assert.equal(service.getStatus(pendingSessionId).status, 'READY');
});

test('resolveBySubmissionId returns null when no pending entry matches the submissionId', () => {
  const service = new SessionStashService({ tenantId: 't1', storage: makeMemoryStorage(), channel: makeFakeChannel() });
  assert.equal(service.resolveBySubmissionId('unknown-sub', { finalCounterOffer: 100 }), null);
});

test('resolveBySubmissionId posts a RESOLVED message on the channel', () => {
  const storage = makeMemoryStorage();
  const channel = makeFakeChannel();
  const service = new SessionStashService({ tenantId: 't1', storage, channel });
  const pendingSessionId = service.createPending('sub-1');

  service.resolveBySubmissionId('sub-1', { finalCounterOffer: 12000 });

  assert.equal(channel.posted.length, 1);
  assert.equal(channel.posted[0].type, 'RESOLVED');
  assert.equal(channel.posted[0].pendingSessionId, pendingSessionId);
  assert.equal(channel.posted[0].finalCounterOffer, 12000);
});

test('subscribe invokes the callback only for the matching pendingSessionId, and unsubscribe stops delivery', () => {
  const storage = makeMemoryStorage();
  const channel = makeFakeChannel();
  const service = new SessionStashService({ tenantId: 't1', storage, channel });
  const targetId = service.createPending('sub-target');
  const otherId = service.createPending('sub-other');

  const received = [];
  const unsubscribe = service.subscribe(targetId, (event) => received.push(event));

  service.resolveBySubmissionId('sub-other', { finalCounterOffer: 1 });
  assert.equal(received.length, 0);

  service.resolveBySubmissionId('sub-target', { finalCounterOffer: 9000 });
  assert.equal(received.length, 1);
  assert.equal(received[0].finalCounterOffer, 9000);

  unsubscribe();
  // Re-stash and resolve again for the same submission; nothing should be delivered post-unsubscribe.
  const secondPendingId = service.createPending('sub-target');
  service.resolveBySubmissionId('sub-target', { finalCounterOffer: 5000 });
  assert.equal(received.length, 1);
  assert.notEqual(secondPendingId, targetId);
  assert.equal(otherId !== targetId, true);
});

test('subscribe is a safe no-op when no channel is available', () => {
  // `false` (rather than the default null/undefined) explicitly opts out of the constructor's
  // BroadcastChannel auto-detection, so this exercises the "no channel" branch deterministically
  // regardless of whether the test runtime happens to provide a global BroadcastChannel.
  const service = new SessionStashService({ tenantId: 't1', storage: makeMemoryStorage(), channel: false });
  const unsubscribe = service.subscribe('anything', () => {
    throw new Error('should never be called');
  });
  assert.doesNotThrow(() => unsubscribe());
});

test('storage read/write failures degrade gracefully without throwing', () => {
  const throwingStorage = {
    getItem: () => {
      throw new Error('storage unavailable');
    },
    setItem: () => {
      throw new Error('storage unavailable');
    },
  };
  const service = new SessionStashService({ tenantId: 't1', storage: throwingStorage, channel: makeFakeChannel() });

  assert.doesNotThrow(() => service.createPending('sub-1'));
  assert.equal(service.getStatus('anything'), null);
});
