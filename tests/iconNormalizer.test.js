import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_SPECS, resolveIconSpec, computeContainLayout } from '../src/utils/iconNormalizer.js';

test('ICON_SPECS covers apple-touch-icon and both manifest icon sizes', () => {
  assert.deepEqual(
    ICON_SPECS.map((spec) => spec.key),
    ['appleTouchIcon', 'manifestIcon192', 'manifestIcon512'],
  );
  assert.deepEqual(
    ICON_SPECS.map((spec) => spec.size),
    [180, 192, 512],
  );
});

test('resolveIconSpec returns the matching spec by key', () => {
  assert.deepEqual(resolveIconSpec('manifestIcon192'), { key: 'manifestIcon192', size: 192 });
});

test('resolveIconSpec throws on an unknown key', () => {
  assert.throws(() => resolveIconSpec('nope'), /Unknown icon spec: nope/);
});

test('computeContainLayout centers a square source with no scaling beyond the safe area', () => {
  const layout = computeContainLayout(100, 100, 200, 0.1);
  assert.equal(layout.drawWidth, layout.drawHeight);
  assert.equal(layout.dx, layout.dy);
  assert.ok(layout.drawWidth <= 200 * 0.8 + 1e-9);
});

test('computeContainLayout letterboxes a wide source (no cropping)', () => {
  const layout = computeContainLayout(400, 100, 200, 0.1);
  assert.ok(layout.drawWidth > layout.drawHeight);
  assert.ok(layout.dy > 0);
  assert.equal(layout.dx, (200 - layout.drawWidth) / 2);
});

test('computeContainLayout letterboxes a tall source (no cropping)', () => {
  const layout = computeContainLayout(100, 400, 200, 0.1);
  assert.ok(layout.drawHeight > layout.drawWidth);
  assert.ok(layout.dx > 0);
  assert.equal(layout.dy, (200 - layout.drawHeight) / 2);
});

test('computeContainLayout respects a larger paddingRatio by shrinking the safe area', () => {
  const tight = computeContainLayout(100, 100, 200, 0.05);
  const loose = computeContainLayout(100, 100, 200, 0.25);
  assert.ok(loose.drawWidth < tight.drawWidth);
});

test('computeContainLayout defaults paddingRatio to 0.12 when not provided', () => {
  const withDefault = computeContainLayout(100, 100, 200);
  const explicit = computeContainLayout(100, 100, 200, 0.12);
  assert.equal(withDefault.drawWidth, explicit.drawWidth);
});
