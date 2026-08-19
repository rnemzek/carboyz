import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TENANT_CONFIG, createTenantConfig } from '../src/config/tenantConfig.js';

test('createTenantConfig falls back to defaults when called with no overrides', () => {
  const config = createTenantConfig();
  assert.deepEqual(config, DEFAULT_TENANT_CONFIG);
});

test('createTenantConfig merges partial overrides on top of defaults', () => {
  const config = createTenantConfig({ tenantId: 'acme', name: 'Acme Co.' });
  assert.equal(config.tenantId, 'acme');
  assert.equal(config.name, 'Acme Co.');
  assert.deepEqual(config.themeColors, DEFAULT_TENANT_CONFIG.themeColors);
});

test('createTenantConfig merges themeColors instead of replacing them wholesale', () => {
  const config = createTenantConfig({ themeColors: { primary: '#FF0000' } });
  assert.equal(config.themeColors.primary, '#FF0000');
  assert.equal(config.themeColors.secondary, DEFAULT_TENANT_CONFIG.themeColors.secondary);
});
