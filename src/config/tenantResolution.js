const TENANT_QUERY_PARAM = 'brand';
export const TENANT_STORAGE_KEY = 'carboyz:activeTenantId';

export function readTenantIdFromUrl(search = '') {
  return new URLSearchParams(search).get(TENANT_QUERY_PARAM) || null;
}

export function readTenantIdFromStorage(storage) {
  try {
    return storage?.getItem?.(TENANT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeTenantIdToStorage(storage, tenantId) {
  try {
    storage?.setItem?.(TENANT_STORAGE_KEY, tenantId);
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — branding
    // still works for this session, it just won't persist across reloads.
  }
}

export function resolveActiveTenantId({ search = '', storage = null, defaultTenantId = null } = {}) {
  const fromUrl = readTenantIdFromUrl(search);
  if (fromUrl) {
    writeTenantIdToStorage(storage, fromUrl);
    return fromUrl;
  }

  const fromStorage = readTenantIdFromStorage(storage);
  if (fromStorage) {
    return fromStorage;
  }

  return defaultTenantId;
}
