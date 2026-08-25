import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TenantRegistry, CARBOYZ_TENANT_ID, CARBOYZ_FLAGSHIP_PRESET } from '../src/config/TenantRegistry.js';
import { TENANT_STORAGE_KEY } from '../src/config/tenantResolution.js';
import { getBrandInitials } from '../src/ui/branding.js';

function makeMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

const PRESETS = [
  {
    tenantId: 'demo-tenant',
    name: 'Carboyz Motors',
    tagline: 'Your trusted local dealer network.',
    themeColors: { primary: '#0057d9' },
    contact: { phone: '555-0100', email: 'hello@carboyzmotors.example' },
  },
  {
    tenantId: 'summit-auto',
    name: 'Summit Auto Group',
    tagline: 'Mountain-tested deals.',
    themeColors: { primary: '#b3541e' },
    contact: { phone: '555-0200', email: 'sales@summitauto.example' },
  },
];

test('TenantRegistry registers presets at construction and normalizes them through createTenantConfig', () => {
  const registry = new TenantRegistry(PRESETS);
  const summit = registry.get('summit-auto');
  assert.equal(summit.name, 'Summit Auto Group');
  assert.equal(summit.tagline, 'Mountain-tested deals.');
  assert.equal(summit.contact.phone, '555-0200');
  assert.equal(summit.themeColors.secondary, '#1B1F27');
});

test('TenantRegistry.get returns null for an unknown tenantId', () => {
  const registry = new TenantRegistry(PRESETS);
  assert.equal(registry.get('unknown-tenant'), null);
});

test('TenantRegistry.has reports whether a tenantId is registered', () => {
  const registry = new TenantRegistry(PRESETS);
  assert.equal(registry.has('summit-auto'), true);
  assert.equal(registry.has('unknown-tenant'), false);
});

test('TenantRegistry.list returns all registered presets', () => {
  const registry = new TenantRegistry(PRESETS);
  assert.deepEqual(
    registry.list().map((preset) => preset.tenantId),
    ['demo-tenant', 'summit-auto'],
  );
});

test('TenantRegistry.register throws when a preset has no tenantId', () => {
  const registry = new TenantRegistry();
  assert.throws(() => registry.register({ name: 'No Id Motors' }), /tenantId/);
});

test('TenantRegistry.resolveTenant honors the URL parameter over storage and the default', () => {
  const registry = new TenantRegistry(PRESETS);
  const storage = makeMemoryStorage({ [TENANT_STORAGE_KEY]: 'summit-auto' });
  const resolved = registry.resolveTenant({
    search: '?brand=demo-tenant',
    storage,
    defaultTenantId: 'summit-auto',
  });
  assert.equal(resolved.tenantId, 'demo-tenant');
});

test('TenantRegistry.resolveTenant falls back to storage, then to the default tenantId', () => {
  const registry = new TenantRegistry(PRESETS);

  const fromStorage = registry.resolveTenant({
    search: '',
    storage: makeMemoryStorage({ [TENANT_STORAGE_KEY]: 'summit-auto' }),
    defaultTenantId: 'demo-tenant',
  });
  assert.equal(fromStorage.tenantId, 'summit-auto');

  const fromDefault = registry.resolveTenant({
    search: '',
    storage: makeMemoryStorage(),
    defaultTenantId: 'demo-tenant',
  });
  assert.equal(fromDefault.tenantId, 'demo-tenant');
});

test('TenantRegistry.resolveTenant falls back to a bare default TenantConfig when nothing resolves to a known preset', () => {
  const registry = new TenantRegistry(PRESETS);
  const resolved = registry.resolveTenant({
    search: '?brand=totally-unknown',
    storage: makeMemoryStorage(),
    defaultTenantId: 'also-unknown',
  });
  assert.equal(resolved.tenantId, 'default');
});

test('CARBOYZ_FLAGSHIP_PRESET carries the flagship name, tagline, dark amber/gold theme, and CB fallback initials', () => {
  assert.equal(CARBOYZ_FLAGSHIP_PRESET.tenantId, CARBOYZ_TENANT_ID);
  assert.equal(CARBOYZ_FLAGSHIP_PRESET.name, 'CarBoyZ Motors');
  assert.equal(CARBOYZ_FLAGSHIP_PRESET.tagline, 'Raw Muscle, Badass Trucks, Boss Jeeps & whatever chicks want');
  assert.equal(CARBOYZ_FLAGSHIP_PRESET.logoUrl, '');
  assert.equal(getBrandInitials(CARBOYZ_FLAGSHIP_PRESET.name), 'CB');
});

test('registering CARBOYZ_FLAGSHIP_PRESET resolves it via ?brand=carboyz', () => {
  const registry = new TenantRegistry([CARBOYZ_FLAGSHIP_PRESET, ...PRESETS]);
  const resolved = registry.resolveTenant({
    search: `?brand=${CARBOYZ_TENANT_ID}`,
    storage: makeMemoryStorage(),
    defaultTenantId: 'demo-tenant',
  });
  assert.equal(resolved.tenantId, CARBOYZ_TENANT_ID);
  assert.equal(resolved.name, 'CarBoyZ Motors');
  assert.equal(resolved.themeColors.primary, '#FBBF24');
  assert.equal(resolved.themeColors.secondary, '#334155');
  assert.equal(resolved.themeColors.background, '#020617');
  assert.equal(resolved.themeColors.text, '#F1F5F9');
  assert.equal(resolved.themeColors.surface, '#0F172A');
  assert.equal(resolved.themeColors.border, '#334155');
  assert.equal(resolved.themeColors.onPrimary, '#0F172A');
});
