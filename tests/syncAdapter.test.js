import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncAdapter, SYNC_EVENTS } from '../src/services/SyncAdapter.js';

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

function makeFakeWebSocketClass() {
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.closed = false;
      FakeWebSocket.instances.push(this);
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.closed = true;
    }
  }
  FakeWebSocket.instances = [];
  return FakeWebSocket;
}

test('SyncAdapter requires a tenantId', () => {
  assert.throws(() => new SyncAdapter({}), /tenantId/);
});

test('connect() falls back to the channel immediately when no wsUrl is configured', () => {
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', channel });

  adapter.connect();

  assert.equal(adapter.mode, 'broadcast');
  adapter.submitSubmissionCreated({ id: 'sub-1' });
  assert.equal(channel.posted.length, 1);
  assert.equal(channel.posted[0].type, 'SUBMISSION_CREATED');
  assert.equal(channel.posted[0].tenantId, 't1');
});

test('connect() falls back to the channel when no WebSocket implementation is injected', () => {
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', wsUrl: 'ws://relay.example', WebSocketClass: null, channel });

  adapter.connect();

  assert.equal(adapter.mode, 'broadcast');
});

test('connect() opens a socket, appends tenantId to the URL, and switches to socket mode onopen', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const adapter = new SyncAdapter({
    tenantId: 't1',
    wsUrl: 'ws://relay.example/ws',
    WebSocketClass: FakeWebSocket,
    channel: makeFakeChannel(),
  });

  adapter.connect();
  assert.equal(adapter.mode, 'connecting');
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(FakeWebSocket.instances[0].url, 'ws://relay.example/ws?tenantId=t1');

  FakeWebSocket.instances[0].onopen();
  assert.equal(adapter.mode, 'socket');
});

test('a second connect() call while already connecting/connected is a no-op', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const adapter = new SyncAdapter({
    tenantId: 't1',
    wsUrl: 'ws://relay.example',
    WebSocketClass: FakeWebSocket,
    channel: makeFakeChannel(),
  });

  adapter.connect();
  adapter.connect();

  assert.equal(FakeWebSocket.instances.length, 1);
});

test('socket error before open gracefully falls back to the channel', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', wsUrl: 'ws://relay.example', WebSocketClass: FakeWebSocket, channel });

  adapter.connect();
  FakeWebSocket.instances[0].onerror(new Error('connection refused'));

  assert.equal(adapter.mode, 'broadcast');
  assert.equal(adapter.socket, null);

  adapter.submitPolicyUpdated({ tier: 'gold' });
  assert.equal(channel.posted.length, 1);
  assert.equal(channel.posted[0].type, 'POLICY_UPDATED');
});

test('socket close after a successful open falls back to the channel', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', wsUrl: 'ws://relay.example', WebSocketClass: FakeWebSocket, channel });

  adapter.connect();
  FakeWebSocket.instances[0].onopen();
  assert.equal(adapter.mode, 'socket');

  FakeWebSocket.instances[0].onclose();
  assert.equal(adapter.mode, 'broadcast');
});

test('send() uses the live socket while connected, not the fallback channel', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', wsUrl: 'ws://relay.example', WebSocketClass: FakeWebSocket, channel });

  adapter.connect();
  FakeWebSocket.instances[0].onopen();
  adapter.submitSubmissionCreated({ id: 'sub-9' });

  assert.equal(FakeWebSocket.instances[0].sent.length, 1);
  assert.equal(channel.posted.length, 0);
  const sentMessage = JSON.parse(FakeWebSocket.instances[0].sent[0]);
  assert.equal(sentMessage.type, 'SUBMISSION_CREATED');
  assert.equal(sentMessage.tenantId, 't1');
  assert.equal(sentMessage.payload.id, 'sub-9');
  assert.ok(sentMessage.timestamp);
});

test('incoming SUBMISSION_CREATED over the socket emits SUBMISSION_SYNCED with the payload', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const adapter = new SyncAdapter({
    tenantId: 't1',
    wsUrl: 'ws://relay.example',
    WebSocketClass: FakeWebSocket,
    channel: makeFakeChannel(),
  });
  const received = [];
  adapter.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => received.push(payload));

  adapter.connect();
  FakeWebSocket.instances[0].onopen();
  FakeWebSocket.instances[0].onmessage({
    data: JSON.stringify({ type: 'SUBMISSION_CREATED', tenantId: 't1', payload: { id: 'sub-1' } }),
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].id, 'sub-1');
});

test('incoming POLICY_UPDATED over the fallback channel emits TENANT_POLICY_SYNCED', () => {
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', channel });
  const received = [];
  adapter.on(SYNC_EVENTS.TENANT_POLICY_SYNCED, (payload) => received.push(payload));

  adapter.connect();
  channel.postMessage({ type: 'POLICY_UPDATED', tenantId: 't1', payload: { tier: 'silver' } });

  assert.equal(received.length, 1);
  assert.equal(received[0].tier, 'silver');
});

test('incoming messages for another tenant are ignored', () => {
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', channel });
  const received = [];
  adapter.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => received.push(payload));

  adapter.connect();
  channel.postMessage({ type: 'SUBMISSION_CREATED', tenantId: 't2', payload: { id: 'cross-tenant' } });

  assert.equal(received.length, 0);
});

test('malformed JSON and unknown message types are ignored without throwing', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const adapter = new SyncAdapter({
    tenantId: 't1',
    wsUrl: 'ws://relay.example',
    WebSocketClass: FakeWebSocket,
    channel: makeFakeChannel(),
  });
  adapter.connect();
  FakeWebSocket.instances[0].onopen();

  assert.doesNotThrow(() => FakeWebSocket.instances[0].onmessage({ data: 'not json' }));
  assert.doesNotThrow(() =>
    FakeWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: 'SOMETHING_ELSE', tenantId: 't1', payload: {} }),
    }),
  );
});

test('off() unsubscribes a handler and the returned unsubscribe function from on() also works', () => {
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', channel });
  const received = [];
  const handler = (payload) => received.push(payload);

  const unsubscribe = adapter.on(SYNC_EVENTS.SUBMISSION_SYNCED, handler);
  adapter.connect();
  channel.postMessage({ type: 'SUBMISSION_CREATED', tenantId: 't1', payload: { id: 'a' } });
  assert.equal(received.length, 1);

  unsubscribe();
  channel.postMessage({ type: 'SUBMISSION_CREATED', tenantId: 't1', payload: { id: 'b' } });
  assert.equal(received.length, 1);

  adapter.on(SYNC_EVENTS.SUBMISSION_SYNCED, handler);
  adapter.off(SYNC_EVENTS.SUBMISSION_SYNCED, handler);
  channel.postMessage({ type: 'SUBMISSION_CREATED', tenantId: 't1', payload: { id: 'c' } });
  assert.equal(received.length, 1);
});

test('disconnect() tears down the socket and removes the channel listener', () => {
  const FakeWebSocket = makeFakeWebSocketClass();
  const channel = makeFakeChannel();
  const adapter = new SyncAdapter({ tenantId: 't1', wsUrl: 'ws://relay.example', WebSocketClass: FakeWebSocket, channel });

  adapter.connect();
  FakeWebSocket.instances[0].onopen();
  adapter.disconnect();

  assert.equal(adapter.mode, 'disconnected');
  assert.equal(adapter.socket, null);
  assert.equal(FakeWebSocket.instances[0].closed, true);

  const received = [];
  adapter.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => received.push(payload));
  channel.postMessage({ type: 'SUBMISSION_CREATED', tenantId: 't1', payload: { id: 'after-disconnect' } });
  assert.equal(received.length, 0);
});

test('send() without any channel or socket is a safe no-op', () => {
  const adapter = new SyncAdapter({ tenantId: 't1', channel: false });
  adapter.connect();
  assert.equal(adapter.mode, 'broadcast');
  assert.doesNotThrow(() => adapter.submitSubmissionCreated({ id: 'x' }));
});

test('explicit channel: false opts out of BroadcastChannel auto-detection', () => {
  const adapter = new SyncAdapter({ tenantId: 't1', channel: false });
  assert.equal(adapter.channel, false);
  adapter.connect();
  assert.equal(adapter.mode, 'broadcast');
});
