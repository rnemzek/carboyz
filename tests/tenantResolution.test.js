import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANT_STORAGE_KEY,
  readTenantIdFromUrl,
  readTenantIdFromStorage,
  writeTenantIdToStorage,
  resolveActiveTenantId,
} from '../src/config/tenantResolution.js';

function makeMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    _store: store,
  };
}

function makeThrowingStorage() {
  return {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
  };
}

test('readTenantIdFromUrl extracts the ?brand= query parameter', () => {
  assert.equal(readTenantIdFromUrl('?brand=summit-auto'), 'summit-auto');
  assert.equal(readTenantIdFromUrl('?other=1&brand=harbor-motors'), 'harbor-motors');
});

test('readTenantIdFromUrl returns null when the parameter is absent or empty', () => {
  assert.equal(readTenantIdFromUrl('?other=1'), null);
  assert.equal(readTenantIdFromUrl(''), null);
  assert.equal(readTenantIdFromUrl('?brand='), null);
});

test('readTenantIdFromStorage reads the stored tenantId, returning null when absent', () => {
  const storage = makeMemoryStorage({ [TENANT_STORAGE_KEY]: 'summit-auto' });
  assert.equal(readTenantIdFromStorage(storage), 'summit-auto');
  assert.equal(readTenantIdFromStorage(makeMemoryStorage()), null);
});

test('readTenantIdFromStorage safely returns null when storage is unavailable or throws', () => {
  assert.equal(readTenantIdFromStorage(null), null);
  assert.equal(readTenantIdFromStorage(makeThrowingStorage()), null);
});

test('writeTenantIdToStorage persists the tenantId and is a safe no-op when storage throws', () => {
  const storage = makeMemoryStorage();
  writeTenantIdToStorage(storage, 'harbor-motors');
  assert.equal(storage.getItem(TENANT_STORAGE_KEY), 'harbor-motors');

  assert.doesNotThrow(() => writeTenantIdToStorage(makeThrowingStorage(), 'harbor-motors'));
  assert.doesNotThrow(() => writeTenantIdToStorage(null, 'harbor-motors'));
});

test('resolveActiveTenantId prioritizes the URL parameter over storage and the default', () => {
  const storage = makeMemoryStorage({ [TENANT_STORAGE_KEY]: 'summit-auto' });
  const tenantId = resolveActiveTenantId({
    search: '?brand=harbor-motors',
    storage,
    defaultTenantId: 'demo-tenant',
  });
  assert.equal(tenantId, 'harbor-motors');
});

test('resolveActiveTenantId persists a URL-resolved tenantId back to storage', () => {
  const storage = makeMemoryStorage();
  resolveActiveTenantId({ search: '?brand=harbor-motors', storage, defaultTenantId: 'demo-tenant' });
  assert.equal(storage.getItem(TENANT_STORAGE_KEY), 'harbor-motors');
});

test('resolveActiveTenantId falls back to storage when no URL parameter is present', () => {
  const storage = makeMemoryStorage({ [TENANT_STORAGE_KEY]: 'summit-auto' });
  const tenantId = resolveActiveTenantId({ search: '', storage, defaultTenantId: 'demo-tenant' });
  assert.equal(tenantId, 'summit-auto');
});

test('resolveActiveTenantId falls back to the default when neither URL nor storage has a value', () => {
  const tenantId = resolveActiveTenantId({ search: '', storage: makeMemoryStorage(), defaultTenantId: 'demo-tenant' });
  assert.equal(tenantId, 'demo-tenant');
});
