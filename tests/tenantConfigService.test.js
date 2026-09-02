import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TenantConfigService, buildManifestObject } from '../src/services/TenantConfigService.js';
import { createTenantConfig } from '../src/config/tenantConfig.js';

function createFakeElement(tagName) {
  return {
    tagName,
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
  };
}

function createFakeDocument() {
  const created = [];
  const head = {
    children: [],
    querySelector(selector) {
      const relMatch = selector.match(/rel="([^"]+)"/);
      const sizesMatch = selector.match(/sizes="([^"]+)"/);
      const nameMatch = selector.match(/name="([^"]+)"/);
      return (
        this.children.find((el) => {
          if (relMatch && el.getAttribute('rel') !== relMatch[1]) return false;
          if (sizesMatch && el.getAttribute('sizes') !== sizesMatch[1]) return false;
          if (nameMatch && el.getAttribute('name') !== nameMatch[1]) return false;
          return relMatch || nameMatch;
        }) ?? null
      );
    },
    appendChild(el) {
      this.children.push(el);
    },
  };

  return {
    title: '',
    documentElement: { style: { setProperty() {} } },
    head,
    createElement(tag) {
      const el = createFakeElement(tag);
      created.push(el);
      return el;
    },
  };
}

test('buildManifestObject includes icons only when present in iconSet', () => {
  const noIcons = buildManifestObject(createTenantConfig({ name: 'Acme' }));
  assert.deepEqual(noIcons.icons, []);
  assert.equal(noIcons.name, 'Acme');
  assert.equal(noIcons.short_name, 'Acme');
  assert.equal(noIcons.display, 'standalone');

  const withIcons = buildManifestObject(
    createTenantConfig({
      name: 'Acme',
      iconSet: { appleTouchIcon: 'data:apple', manifestIcon192: 'data:192', manifestIcon512: 'data:512' },
    }),
  );
  assert.deepEqual(withIcons.icons, [
    { src: 'data:192', sizes: '192x192', type: 'image/png' },
    { src: 'data:512', sizes: '512x512', type: 'image/png' },
  ]);
});

test('buildManifestObject falls back to default colors when themeColors is missing entirely', () => {
  const manifest = buildManifestObject({ name: 'Acme', themeColors: {} });
  assert.equal(manifest.theme_color, '#0057d9');
  assert.equal(manifest.background_color, '#ffffff');
});

test('TenantConfigService.applyTenant sets title and creates a theme-color meta tag', () => {
  const document = createFakeDocument();
  const service = new TenantConfigService({ document, createManifestUrl: () => 'blob:fake-1' });
  const tenantConfig = createTenantConfig({ name: 'Acme', themeColors: { primary: '#ff0000' } });

  service.applyTenant(tenantConfig);

  assert.equal(document.title, 'Acme');
  const meta = document.head.querySelector('meta[name="theme-color"]');
  assert.ok(meta);
  assert.equal(meta.getAttribute('content'), '#ff0000');
});

test('TenantConfigService.applyTenant reuses an existing theme-color meta tag instead of duplicating it', () => {
  const document = createFakeDocument();
  const service = new TenantConfigService({ document, createManifestUrl: () => 'blob:fake' });

  service.applyTenant(createTenantConfig({ themeColors: { primary: '#111111' } }));
  service.applyTenant(createTenantConfig({ themeColors: { primary: '#222222' } }));

  const metas = document.head.children.filter((el) => el.getAttribute('name') === 'theme-color');
  assert.equal(metas.length, 1);
  assert.equal(metas[0].getAttribute('content'), '#222222');
});

test('TenantConfigService.applyTenant only creates icon links when iconSet is present', () => {
  const document = createFakeDocument();
  const service = new TenantConfigService({ document, createManifestUrl: () => 'blob:fake' });

  service.applyTenant(createTenantConfig({ name: 'NoIcons' }));
  assert.equal(document.head.querySelector('link[rel="apple-touch-icon"]'), null);

  service.applyTenant(
    createTenantConfig({
      name: 'WithIcons',
      iconSet: { appleTouchIcon: 'data:apple', manifestIcon192: 'data:192', manifestIcon512: 'data:512' },
    }),
  );
  assert.equal(document.head.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'), 'data:apple');
  assert.equal(document.head.querySelector('link[rel="icon"][sizes="192x192"]').getAttribute('href'), 'data:192');
  assert.equal(document.head.querySelector('link[rel="icon"][sizes="512x512"]').getAttribute('href'), 'data:512');
});

test('TenantConfigService.applyTenant swaps the manifest link href and revokes the prior URL', () => {
  const document = createFakeDocument();
  const revoked = [];
  let callCount = 0;
  const service = new TenantConfigService({
    document,
    createManifestUrl: () => `blob:fake-${++callCount}`,
    revokeManifestUrl: (url) => revoked.push(url),
  });

  service.applyTenant(createTenantConfig({ name: 'First' }));
  const link = document.head.querySelector('link[rel="manifest"]');
  assert.equal(link.getAttribute('href'), 'blob:fake-1');
  assert.deepEqual(revoked, []);

  service.applyTenant(createTenantConfig({ name: 'Second' }));
  assert.equal(link.getAttribute('href'), 'blob:fake-2');
  assert.deepEqual(revoked, ['blob:fake-1']);
});

test('TenantConfigService.applyTenant is a safe no-op when no document is available', () => {
  const service = new TenantConfigService({ document: null });
  assert.doesNotThrow(() => service.applyTenant(createTenantConfig()));
});

test('registerServiceWorker() registers sw.js at root scope as a module', async () => {
  const calls = [];
  const navigator = {
    serviceWorker: {
      register: (url, options) => {
        calls.push({ url, options });
        return Promise.resolve({ scope: '/' });
      },
    },
  };
  const service = new TenantConfigService({ document: null, navigator });

  const registration = await service.registerServiceWorker();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/src/sw.js');
  assert.deepEqual(calls[0].options, { type: 'module', scope: '/' });
  assert.deepEqual(registration, { scope: '/' });
});

test('registerServiceWorker() accepts a custom sw url', async () => {
  const calls = [];
  const navigator = { serviceWorker: { register: (url) => { calls.push(url); return Promise.resolve(); } } };
  const service = new TenantConfigService({ document: null, navigator });

  await service.registerServiceWorker('/custom-sw.js');

  assert.deepEqual(calls, ['/custom-sw.js']);
});

test('registerServiceWorker() resolves to null instead of throwing when registration is rejected', async () => {
  const navigator = { serviceWorker: { register: () => Promise.reject(new Error('disallowed scope')) } };
  const service = new TenantConfigService({ document: null, navigator });

  const registration = await service.registerServiceWorker();

  assert.equal(registration, null);
});

test('registerServiceWorker() is a safe no-op returning null when serviceWorker is unsupported', () => {
  const service = new TenantConfigService({ document: null, navigator: {} });
  assert.equal(service.registerServiceWorker(), null);

  const noNavigatorService = new TenantConfigService({ document: null, navigator: null });
  assert.equal(noNavigatorService.registerServiceWorker(), null);
});
