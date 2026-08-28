import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectA2hsPlatform,
  buildA2hsCopy,
  shouldShowA2hsPrompt,
  readA2hsDismissed,
  writeA2hsDismissed,
} from '../src/ui/PwaInstallPromptView.js';
import { createTenantConfig } from '../src/config/tenantConfig.js';

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1';
const IOS_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

test('detectA2hsPlatform recognizes iOS Safari', () => {
  assert.equal(detectA2hsPlatform({ userAgent: IOS_SAFARI_UA }), 'ios-safari');
});

test('detectA2hsPlatform treats iOS Chrome as unsupported (no native A2HS flow)', () => {
  assert.equal(detectA2hsPlatform({ userAgent: IOS_CHROME_UA }), 'unsupported');
});

test('detectA2hsPlatform recognizes Android Chrome', () => {
  assert.equal(detectA2hsPlatform({ userAgent: ANDROID_CHROME_UA }), 'android-chrome');
});

test('detectA2hsPlatform treats desktop browsers as unsupported', () => {
  assert.equal(detectA2hsPlatform({ userAgent: DESKTOP_UA }), 'unsupported');
});

test('detectA2hsPlatform treats an already-standalone session as unsupported', () => {
  assert.equal(detectA2hsPlatform({ userAgent: IOS_SAFARI_UA, standalone: true }), 'unsupported');
});

test('buildA2hsCopy interpolates the tenant name and gives 3 steps per platform', () => {
  const tenantConfig = createTenantConfig({ name: 'Acme Motors' });

  const ios = buildA2hsCopy('ios-safari', tenantConfig);
  assert.equal(ios.title, 'Add Acme Motors to your Home Screen');
  assert.equal(ios.steps.length, 3);

  const android = buildA2hsCopy('android-chrome', tenantConfig);
  assert.equal(android.title, 'Add Acme Motors to your Home Screen');
  assert.equal(android.steps.length, 3);

  assert.equal(buildA2hsCopy('unsupported', tenantConfig), null);
});

test('shouldShowA2hsPrompt is true only for a supported platform that has not been dismissed', () => {
  assert.equal(shouldShowA2hsPrompt({ platform: 'ios-safari', dismissed: false }), true);
  assert.equal(shouldShowA2hsPrompt({ platform: 'ios-safari', dismissed: true }), false);
  assert.equal(shouldShowA2hsPrompt({ platform: 'unsupported', dismissed: false }), false);
});

test('readA2hsDismissed/writeA2hsDismissed round-trip through storage', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };

  assert.equal(readA2hsDismissed(storage), false);
  writeA2hsDismissed(storage);
  assert.equal(readA2hsDismissed(storage), true);
});

test('readA2hsDismissed/writeA2hsDismissed are safe no-ops when storage is unavailable', () => {
  assert.equal(readA2hsDismissed(null), false);
  assert.doesNotThrow(() => writeA2hsDismissed(null));

  const throwingStorage = {
    getItem() {
      throw new Error('unavailable');
    },
    setItem() {
      throw new Error('unavailable');
    },
  };
  assert.equal(readA2hsDismissed(throwingStorage), false);
  assert.doesNotThrow(() => writeA2hsDismissed(throwingStorage));
});
