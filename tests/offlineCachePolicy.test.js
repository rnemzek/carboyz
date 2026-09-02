import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRECACHE_NAME,
  RUNTIME_CACHE_NAME,
  PRECACHE_URLS,
  isCacheableRequest,
  staleCacheNames,
} from '../src/services/OfflineCachePolicy.js';

test('PRECACHE_URLS includes the app shell entry points', () => {
  assert.ok(PRECACHE_URLS.includes('/'));
  assert.ok(PRECACHE_URLS.includes('/index.html'));
  assert.ok(PRECACHE_URLS.includes('/src/ui/App.js'));
});

test('isCacheableRequest accepts GET requests for regular assets', () => {
  assert.equal(isCacheableRequest({ method: 'GET', url: 'http://localhost/src/ui/styles.css' }), true);
  assert.equal(isCacheableRequest({ url: 'http://localhost/index.html' }), true);
});

test('isCacheableRequest rejects non-GET methods', () => {
  assert.equal(isCacheableRequest({ method: 'POST', url: 'http://localhost/api' }), false);
});

test('isCacheableRequest rejects the WS relay upgrade path', () => {
  assert.equal(isCacheableRequest({ method: 'GET', url: 'http://localhost/ws?tenantId=t1' }), false);
});

test('isCacheableRequest rejects requests with no url or an unparsable url', () => {
  assert.equal(isCacheableRequest({ method: 'GET' }), false);
  assert.equal(isCacheableRequest({}), false);
  assert.equal(isCacheableRequest({ method: 'GET', url: 'http://[::1' }), false);
});

test('staleCacheNames keeps the current versioned caches and evicts older carboyz- caches', () => {
  const names = [PRECACHE_NAME, RUNTIME_CACHE_NAME, 'carboyz-precache-v0', 'some-other-app-cache'];
  assert.deepEqual(staleCacheNames(names), ['carboyz-precache-v0']);
});

test('staleCacheNames returns an empty array when given no existing caches', () => {
  assert.deepEqual(staleCacheNames(), []);
  assert.deepEqual(staleCacheNames([]), []);
});
