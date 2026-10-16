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
import { normalizePhoneToE164, dispatchSms, createNotificationsRouter } from '../src/server/routes/notifications.js';

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

const DEALER_AUTH_HEADER = { Authorization: `Basic ${Buffer.from('admin:carboyz2026').toString('base64')}` };

test('GET /dealer serves the same index.html shell as the root, for client-side dealer-view routing', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
    const app = createApp({ staticRoot });
    const res = await app.request('/dealer', { headers: DEALER_AUTH_HEADER });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(await res.text(), '<!doctype html><title>shell</title>');
  });
});

test('GET /dealer without credentials gets a 401 basic-auth challenge', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
    const app = createApp({ staticRoot });
    const res = await app.request('/dealer');

    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /Basic/);
  });
});

test('GET /dealer with the wrong credentials gets a 401', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
    const app = createApp({ staticRoot });
    const res = await app.request('/dealer', {
      headers: { Authorization: `Basic ${Buffer.from('admin:wrong-password').toString('base64')}` },
    });

    assert.equal(res.status, 401);
  });
});

test('GET /dealer/anything (a dealer sub-path) also requires credentials', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
    const app = createApp({ staticRoot });

    const unauthed = await app.request('/dealer/sub-view');
    assert.equal(unauthed.status, 401);

    const authed = await app.request('/dealer/sub-view', { headers: DEALER_AUTH_HEADER });
    // No file/route matches this sub-path, but auth passed, so it falls through to a plain 404
    // rather than a 401 challenge.
    assert.equal(authed.status, 404);
  });
});

test('GET / (and static assets, and /api/offers/*) stays public with no basic-auth challenge', async () => {
  await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
    const app = createApp({ staticRoot });

    const rootRes = await app.request('/');
    assert.equal(rootRes.status, 200);

    const parseRes = await app.request('/api/offers/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentBase64: 'data:text/plain;base64,aGk=' }),
    });
    assert.equal(parseRes.status, 200);
  });
});

test('basicAuth credentials honor DEALER_USER/DEALER_PASSWORD env overrides', async () => {
  const previousUser = process.env.DEALER_USER;
  const previousPassword = process.env.DEALER_PASSWORD;
  process.env.DEALER_USER = 'custom-user';
  process.env.DEALER_PASSWORD = 'custom-pass';
  try {
    await withTempStaticRoot({ 'index.html': '<!doctype html><title>shell</title>' }, async (staticRoot) => {
      const app = createApp({ staticRoot });

      const defaultCreds = await app.request('/dealer', { headers: DEALER_AUTH_HEADER });
      assert.equal(defaultCreds.status, 401);

      const customCreds = await app.request('/dealer', {
        headers: { Authorization: `Basic ${Buffer.from('custom-user:custom-pass').toString('base64')}` },
      });
      assert.equal(customCreds.status, 200);
    });
  } finally {
    if (previousUser === undefined) delete process.env.DEALER_USER;
    else process.env.DEALER_USER = previousUser;
    if (previousPassword === undefined) delete process.env.DEALER_PASSWORD;
    else process.env.DEALER_PASSWORD = previousPassword;
  }
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

test('normalizePhoneToE164 formats a bare 10-digit US number as +1XXXXXXXXXX', () => {
  assert.equal(normalizePhoneToE164('9105550128'), '+19105550128');
  assert.equal(normalizePhoneToE164('(910) 555-0128'), '+19105550128');
});

test('normalizePhoneToE164 preserves a valid E.164 number', () => {
  assert.equal(normalizePhoneToE164('+19105550128'), '+19105550128');
});

test('normalizePhoneToE164 rejects an invalid phone', () => {
  assert.throws(() => normalizePhoneToE164('555-0128'), /10-digit/);
  assert.throws(() => normalizePhoneToE164('+1'), /E\.164/);
  assert.throws(() => normalizePhoneToE164(''), /required/);
});

test('dispatchSms sends via Telnyx when Telnyx credentials are present', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ data: { id: 'telnyx-1' } }) };
  };

  const result = await dispatchSms({
    to: '+19105550128',
    message: 'hi',
    env: { TELNYX_API_KEY: 'key', TELNYX_FROM_NUMBER: '+15550100100' },
    fetchImpl,
  });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 'telnyx-1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.telnyx.com/v2/messages');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer key');
  assert.deepEqual(JSON.parse(requests[0].init.body), { from: '+15550100100', to: '+19105550128', text: 'hi' });
});

test('dispatchSms falls back to Twilio when Telnyx credentials are absent', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ sid: 'SM1' }) };
  };

  const result = await dispatchSms({
    to: '+19105550128',
    message: 'hi',
    env: { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM_NUMBER: '+15550100100' },
    fetchImpl,
  });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 'SM1');
  assert.equal(requests[0].url, 'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
});

test('dispatchSms returns a failure when no provider credentials are configured', async () => {
  const result = await dispatchSms({ to: '+19105550128', message: 'hi', env: {} });
  assert.equal(result.success, false);
  assert.match(result.error, /credentials/);
});

test('dispatchSms surfaces a Telnyx HTTP failure as success: false', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ errors: [{ detail: 'bad request' }] }),
  });

  const result = await dispatchSms({
    to: '+19105550128',
    message: 'hi',
    env: { TELNYX_API_KEY: 'key', TELNYX_FROM_NUMBER: '+15550100100' },
    fetchImpl,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /bad request/);
});

test('POST /sms dispatches successfully for a valid payload', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: { id: 'telnyx-1' } }) });
  const router = createNotificationsRouter({
    env: { TELNYX_API_KEY: 'key', TELNYX_FROM_NUMBER: '+15550100100' },
    fetchImpl,
  });

  const res = await router.request('/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: '9105550128', message: 'hi' }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.messageId, 'telnyx-1');
});

test('POST /sms returns success: false with 500 when required fields are missing', async () => {
  const router = createNotificationsRouter({ env: {} });
  const res = await router.request('/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: '9105550128' }),
  });
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.success, false);
});

test('POST /sms returns success: false with 500 for an invalid phone number', async () => {
  const router = createNotificationsRouter({
    env: { TELNYX_API_KEY: 'key', TELNYX_FROM_NUMBER: '+15550100100' },
  });
  const res = await router.request('/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: '555', message: 'hi' }),
  });
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.success, false);
});

test('POST /sms returns success: false with 500 when no provider credentials are configured', async () => {
  const router = createNotificationsRouter({ env: {} });
  const res = await router.request('/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: '9105550128', message: 'hi' }),
  });
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.success, false);
  assert.match(body.error, /credentials/);
});

test('POST /api/v1/notifications/sms requires dealer auth', async () => {
  const app = createApp();
  const res = await app.request('/api/v1/notifications/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: '9105550128', message: 'hi' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/v1/notifications/sms with dealer auth hits the relay route and reports missing credentials', async () => {
  const PROVIDER_ENV_KEYS = ['TELNYX_API_KEY', 'TELNYX_FROM_NUMBER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
  const savedEnv = {};
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  try {
    const app = createApp();
    const res = await app.request('/api/v1/notifications/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...DEALER_AUTH_HEADER },
      body: JSON.stringify({ to: '9105550128', message: 'hi' }),
    });
    const body = await res.json();

    assert.equal(res.status, 500);
    assert.equal(body.success, false);
    assert.match(body.error, /credentials/);
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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
