const CACHE_VERSION = 'v1';

export const PRECACHE_NAME = `carboyz-precache-${CACHE_VERSION}`;
export const RUNTIME_CACHE_NAME = `carboyz-runtime-${CACHE_VERSION}`;

export const PRECACHE_URLS = Object.freeze([
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/src/ui/styles.css',
  '/src/ui/App.js',
]);

const KNOWN_CACHE_NAMES = new Set([PRECACHE_NAME, RUNTIME_CACHE_NAME]);

/** GET-only, same-origin runtime caching — excludes the WS relay's HTTP upgrade path. */
export function isCacheableRequest({ method = 'GET', url } = {}) {
  if (!url || method.toUpperCase() !== 'GET') {
    return false;
  }
  try {
    const parsed = new URL(url, 'http://localhost');
    return !parsed.pathname.startsWith('/ws');
  } catch {
    return false;
  }
}

/** Cache names from a prior app version that `activate` should evict. */
export function staleCacheNames(existingNames = []) {
  return existingNames.filter((name) => name.startsWith('carboyz-') && !KNOWN_CACHE_NAMES.has(name));
}
