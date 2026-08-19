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

test('createTenantConfig merges contact info instead of replacing it wholesale', () => {
  const config = createTenantConfig({ contact: { phone: '555-0100' } });
  assert.equal(config.contact.phone, '555-0100');
  assert.equal(config.contact.email, DEFAULT_TENANT_CONFIG.contact.email);
});

test('createTenantConfig accepts a tagline override', () => {
  const config = createTenantConfig({ tagline: 'Deals you can trust.' });
  assert.equal(config.tagline, 'Deals you can trust.');
});
