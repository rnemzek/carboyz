import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createWsRelay } from './wsRelay.js';

const DEFAULT_PORT = 8787;

function isIpLikeHost(host) {
  return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) || host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

/**
 * Resolves the tenant cell for a request: explicit route param, then `?tenantId=`/header, then
 * the subdomain of `tenant.domain.com` (skipped for bare localhost/IP hosts, which have no
 * meaningful subdomain segment).
 */
export function resolveTenantId(c) {
  const routeTenantId = c.req.param('tenantId');
  if (routeTenantId) {
    return routeTenantId;
  }

  const queryTenantId = c.req.query('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  const headerTenantId = c.req.header('x-tenant-id');
  if (headerTenantId) {
    return headerTenantId;
  }

  const host = c.req.header('host') ?? '';
  if (!host || isIpLikeHost(host)) {
    return null;
  }
  const labels = host.split('.');
  return labels.length > 2 ? labels[0] : null;
}

export function createApp({ startedAt = Date.now() } = {}) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    c.set('tenantId', resolveTenantId(c));
    await next();
  });

  app.get('/api/v1/health', (c) => c.json({ status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000) }));

  app.get('/api/v1/tenants/:tenantId', (c) => {
    const tenantId = c.req.param('tenantId');
    return c.json({ tenantId });
  });

  return app;
}

export function startServer({ port = Number(process.env.PORT) || DEFAULT_PORT } = {}) {
  const app = createApp();
  const server = serve({ fetch: app.fetch, port });
  const relay = createWsRelay({ server });
  return { app, server, relay };
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const { server } = startServer();
  server.on('listening', () => {
    const address = server.address();
    console.log(`carboyz sync server listening on port ${typeof address === 'object' ? address.port : address}`);
  });
}
