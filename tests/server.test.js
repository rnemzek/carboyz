import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createApp, resolveTenantId, startServer } from '../src/server/index.js';
import { createWsRelay } from '../src/server/wsRelay.js';

function fakeContext({ param = {}, query = {}, header = {} } = {}) {
  return {
    req: {
      param: (key) => param[key],
      query: (key) => query[key],
      header: (key) => header[key],
    },
  };
}

test('resolveTenantId prefers the route param over query, header, and host', () => {
  const tenantId = resolveTenantId(
    fakeContext({
      param: { tenantId: 'from-param' },
      query: { tenantId: 'from-query' },
      header: { 'x-tenant-id': 'from-header', host: 'from-host.carboyz.example' },
    }),
  );
  assert.equal(tenantId, 'from-param');
});

test('resolveTenantId falls back to the query param when no route param is present', () => {
  const tenantId = resolveTenantId(
    fakeContext({ query: { tenantId: 'from-query' }, header: { 'x-tenant-id': 'from-header' } }),
  );
  assert.equal(tenantId, 'from-query');
});

test('resolveTenantId falls back to the x-tenant-id header when no param or query is present', () => {
  const tenantId = resolveTenantId(fakeContext({ header: { 'x-tenant-id': 'from-header', host: 'sub.carboyz.example' } }));
  assert.equal(tenantId, 'from-header');
});

test('resolveTenantId falls back to the host subdomain as a last resort', () => {
  const tenantId = resolveTenantId(fakeContext({ header: { host: 'acme.carboyz.example' } }));
  assert.equal(tenantId, 'acme');
});

test('resolveTenantId returns null for a bare two-label host with no subdomain', () => {
  assert.equal(resolveTenantId(fakeContext({ header: { host: 'carboyz.example' } })), null);
});

test('resolveTenantId returns null for localhost and IP-like hosts', () => {
  assert.equal(resolveTenantId(fakeContext({ header: { host: 'localhost:8080' } })), null);
  assert.equal(resolveTenantId(fakeContext({ header: { host: '127.0.0.1:8080' } })), null);
});

test('resolveTenantId returns null when no host header is present at all', () => {
  assert.equal(resolveTenantId(fakeContext({})), null);
});

test('GET /api/v1/health returns ok status and a numeric uptime', async () => {
  const app = createApp({ startedAt: Date.now() - 5000 });
  const res = await app.request('/api/v1/health');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
  assert.ok(body.uptime >= 5);
});

test('GET /api/v1/tenants/:tenantId resolves the tenant cell from the route', async () => {
  const app = createApp();
  const res = await app.request('/api/v1/tenants/acme');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.tenantId, 'acme');
});

test('wsRelay: broadcast to an unknown tenant room delivers to nobody and getRoomSize is 0', () => {
  const relay = createWsRelay({ server: null });
  assert.equal(relay.broadcast('nobody-here', { type: 'SUBMISSION_CREATED' }), 0);
  assert.equal(relay.getRoomSize('nobody-here'), 0);
});

test('wsRelay: an upgrade request without a resolvable tenantId is destroyed, not upgraded', () => {
  const relay = createWsRelay({ server: null });
  let destroyed = false;
  const fakeSocket = { destroy: () => (destroyed = true) };

  relay.handleUpgrade({ url: '/ws' }, fakeSocket, Buffer.alloc(0));

  assert.equal(destroyed, true);
});

test('wsRelay: an upgrade request for a different path is destroyed', () => {
  const relay = createWsRelay({ server: null });
  let destroyed = false;
  const fakeSocket = { destroy: () => (destroyed = true) };

  relay.handleUpgrade({ url: '/not-ws?tenantId=acme' }, fakeSocket, Buffer.alloc(0));

  assert.equal(destroyed, true);
});

test('ephemeral server: health + tenant routing + cross-client WS broadcast scoped to a tenant room', async () => {
  const { server } = startServer({ port: 0 });
  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;
  let clientA;
  let clientB;
  let otherTenantClient;

  try {
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal((await healthRes.json()).status, 'ok');

    const tenantRes = await fetch(`${baseUrl}/api/v1/tenants/acme`);
    assert.equal((await tenantRes.json()).tenantId, 'acme');

    clientA = new WebSocket(`ws://localhost:${port}/ws?tenantId=acme`);
    clientB = new WebSocket(`ws://localhost:${port}/ws?tenantId=acme`);
    otherTenantClient = new WebSocket(`ws://localhost:${port}/ws?tenantId=other`);

    await Promise.all([once(clientA, 'open'), once(clientB, 'open'), once(otherTenantClient, 'open')]);

    let clientAReceivedOwnBroadcast = false;
    clientA.on('message', () => {
      clientAReceivedOwnBroadcast = true;
    });
    const otherTenantMessages = [];
    otherTenantClient.on('message', (data) => otherTenantMessages.push(data));

    const clientBMessage = once(clientB, 'message');
    clientA.send(
      JSON.stringify({ type: 'SUBMISSION_CREATED', tenantId: 'acme', payload: { id: 'sub-1' }, timestamp: Date.now() }),
    );
    const [rawReceived] = await clientBMessage;
    const received = JSON.parse(rawReceived.toString());

    assert.equal(received.type, 'SUBMISSION_CREATED');
    assert.equal(received.tenantId, 'acme');
    assert.equal(received.payload.id, 'sub-1');
    assert.equal(clientAReceivedOwnBroadcast, false);
    assert.equal(otherTenantMessages.length, 0);
  } finally {
    clientA?.close();
    clientB?.close();
    otherTenantClient?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ephemeral server: a WS message with a mismatched or missing tenantId is not relayed', async () => {
  const { server } = startServer({ port: 0 });
  await once(server, 'listening');
  const { port } = server.address();
  let clientA;
  let clientB;

  try {
    clientA = new WebSocket(`ws://localhost:${port}/ws?tenantId=acme`);
    clientB = new WebSocket(`ws://localhost:${port}/ws?tenantId=acme`);
    await Promise.all([once(clientA, 'open'), once(clientB, 'open')]);

    const messages = [];
    clientB.on('message', (data) => messages.push(JSON.parse(data.toString())));

    clientA.send(JSON.stringify({ type: 'SUBMISSION_CREATED', tenantId: 'wrong-tenant', payload: {} }));
    clientA.send(JSON.stringify({ type: 'SUBMISSION_CREATED', payload: {} }));
    clientA.send(JSON.stringify({ type: 'NOT_A_RELAYED_TYPE', tenantId: 'acme', payload: {} }));
    clientA.send('not json');
    // A well-formed, valid message afterward proves the relay is still alive and those four were
    // dropped rather than queued: exactly one message (this one) should ever reach clientB.
    const clientBMessage = once(clientB, 'message');
    clientA.send(JSON.stringify({ type: 'POLICY_UPDATED', tenantId: 'acme', payload: { tier: 'gold' } }));
    await clientBMessage;

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'POLICY_UPDATED');
  } finally {
    clientA?.close();
    clientB?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
