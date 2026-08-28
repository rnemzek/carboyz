import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeToCssVariables, applyTenantTheme } from '../src/ui/theme.js';
import { createTenantConfig } from '../src/config/tenantConfig.js';

test('themeToCssVariables maps known theme color keys to CSS custom property names', () => {
  const variables = themeToCssVariables({
    primary: '#111111',
    secondary: '#222222',
    background: '#ffffff',
    text: '#000000',
  });

  assert.deepEqual(variables, {
    '--color-primary': '#111111',
    '--color-secondary': '#222222',
    '--color-background': '#ffffff',
    '--color-text': '#000000',
  });
});

test('themeToCssVariables maps the accent key to --color-accent', () => {
  const variables = themeToCssVariables({ accent: '#ff8800' });
  assert.deepEqual(variables, { '--color-accent': '#ff8800' });
});

test('themeToCssVariables omits keys that are not present in the input', () => {
  const variables = themeToCssVariables({ primary: '#111111' });
  assert.deepEqual(variables, { '--color-primary': '#111111' });
});

test('themeToCssVariables defaults to an empty object when called with no colors', () => {
  assert.deepEqual(themeToCssVariables(), {});
});

test('applyTenantTheme sets each CSS variable on the provided target element', () => {
  const calls = [];
  const target = { style: { setProperty: (name, value) => calls.push([name, value]) } };

  const tenantConfig = createTenantConfig({ themeColors: { primary: '#abcabc' } });
  applyTenantTheme(tenantConfig, target);

  assert.ok(calls.some(([name, value]) => name === '--color-primary' && value === '#abcabc'));
});

test('applyTenantTheme is a safe no-op when no target is available (e.g. non-browser environments)', () => {
  const tenantConfig = createTenantConfig();
  assert.doesNotThrow(() => applyTenantTheme(tenantConfig, null));
});
