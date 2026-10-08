import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp, resolveTenantId, startServer } from '../src/server/index.js';
import { createWsRelay } from '../src/server/wsRelay.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fixtures', 'offers');

async function withTempStaticRoot(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'carboyz-static-'));
  try {
    for (const [path, contents] of Object.entries(files)) {
      writeFileSync(join(root, path), contents);
    }
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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

test('createApp serves static files from staticRoot, with index.html as the directory fallback', async () => {
  await withTempStaticRoot(
    { 'index.html': '<!doctype html><title>shell</title>', 'manifest.webmanifest': '{"name":"carboyz"}' },
    async (staticRoot) => {
      const app = createApp({ staticRoot });

      const rootRes = await app.request('/');
      assert.equal(rootRes.status, 200);
      assert.match(rootRes.headers.get('content-type'), /text\/html/);
      assert.equal(await rootRes.text(), '<!doctype html><title>shell</title>');

      const manifestRes = await app.request('/manifest.webmanifest');
      assert.equal(manifestRes.status, 200);
      assert.match(manifestRes.headers.get('content-type'), /application\/manifest\+json/);
    },
  );
});

test('createApp serves nested static assets (src/, public/, vendor/ style paths)', async () => {
  await withTempStaticRoot({}, async (staticRoot) => {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(staticRoot, 'src', 'ui'), { recursive: true });
    writeFileSync(join(staticRoot, 'src', 'ui', 'App.js'), 'export const app = true;');

    const app = createApp({ staticRoot });
    const res = await app.request('/src/ui/App.js');

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.equal(await res.text(), 'export const app = true;');
  });
});

test('createApp returns a plain 404 for a static path that matches no API route and no file', async () => {
  await withTempStaticRoot({}, async (staticRoot) => {
    const app = createApp({ staticRoot });
    const res = await app.request('/no-such-file.txt');
    assert.equal(res.status, 404);
  });
});

test('createApp gives explicit API routes precedence over the static fallback even when a same-path file does not exist', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html>' }, async (staticRoot) => {
    const app = createApp({ staticRoot, startedAt: Date.now() - 1000 });

    const healthRes = await app.request('/api/v1/health');
    assert.equal(healthRes.status, 200);
    assert.equal((await healthRes.json()).status, 'ok');

    const parseRes = await app.request('/api/offers/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentBase64: 'data:text/plain;base64,aGk=' }),
    });
    assert.equal(parseRes.status, 200);
    assert.equal((await parseRes.json()).success, true);
  });
});

test('createApp defaults staticRoot to the repo root, serving the real index.html', async () => {
  const app = createApp();
  const res = await app.request('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<div id="app-root">/);
});

test('POST /api/offers/parse extracts fields from a well-formed offer document', async () => {
  const app = createApp();
  const text = 'CARMAX WRITTEN OFFER\nVIN: 1HGCM82633A004352\n7-Day Offer Amount: $15,250\nMileage: 32,450';
  const documentBase64 = `data:text/plain;base64,${Buffer.from(text, 'utf8').toString('base64')}`;

  const res = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentBase64, mimeType: 'text/plain' }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.extracted.vin, '1HGCM82633A004352');
  assert.equal(body.extracted.competitorOffer, 15250);
  assert.equal(body.extracted.competitorName, 'CarMax');
});

test('POST /api/offers/parse falls back gracefully for a malformed document without failing the request', async () => {
  const app = createApp();

  const res = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentBase64: '%%%not-base64%%%', mimeType: 'application/pdf' }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.extracted, {});
});

test('POST /api/offers/parse extracts a partial, VIN-less estimate from a competitor "Estimate" screenshot image', async () => {
  const app = createApp();
  const documentBase64 = readFileSync(join(FIXTURES_DIR, 'carvana-estimated-offer-screenshot.jpeg')).toString('base64');

  const res = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentBase64, mimeType: 'image/jpeg' }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.extracted.vin, undefined);
  assert.equal(body.extracted.isEstimate, true);
  assert.equal(body.extracted.competitorName, 'Carvana');
  assert.equal(body.extracted.competitorOffer, 13100);
  assert.equal(body.extracted.year, 2020);
  assert.equal(body.extracted.make, 'Jeep');
  assert.equal(body.extracted.model, 'Wrangler Unlimited');
});

test('POST /api/offers/parse rejects a request missing documentBase64 without crashing the server', async () => {
  const app = createApp();

  const res = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType: 'application/pdf' }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('POST /api/offers/parse rejects a non-JSON body without crashing the server', async () => {
  const app = createApp();

  const res = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
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
