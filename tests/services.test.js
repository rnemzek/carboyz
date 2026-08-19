import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HapticsService } from '../src/services/HapticsService.js';
import { ShareService } from '../src/services/ShareService.js';

test('HapticsService reports unsupported and no-ops safely without navigator.vibrate', () => {
  const haptics = new HapticsService();
  assert.equal(haptics.isSupported, false);
  assert.equal(haptics.vibrate(), false);
});

test('ShareService reports unsupported and resolves safely without navigator.share', async () => {
  const share = new ShareService();
  assert.equal(share.isSupported, false);
  const result = await share.share({ title: 'test' });
  assert.deepEqual(result, { shared: false, reason: 'unsupported' });
});
