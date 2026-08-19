import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPositionBadge } from '../src/ui/marketBadge.js';
import { MarketPosition } from '../src/services/TelemetryService.js';

test('marketPositionBadge maps each MarketPosition to a label and CSS class', () => {
  assert.deepEqual(marketPositionBadge(MarketPosition.UNDERPRICED), {
    label: 'Underpriced',
    className: 'badge badge--underpriced',
  });
  assert.deepEqual(marketPositionBadge(MarketPosition.FAIR), {
    label: 'Fair Price',
    className: 'badge badge--fair',
  });
  assert.deepEqual(marketPositionBadge(MarketPosition.OVERPRICED), {
    label: 'Overpriced',
    className: 'badge badge--overpriced',
  });
});

test('marketPositionBadge falls back to an unrated badge for unknown/null positions', () => {
  assert.deepEqual(marketPositionBadge(null), { label: 'Unrated', className: 'badge badge--unrated' });
  assert.deepEqual(marketPositionBadge('SOMETHING_ELSE'), {
    label: 'Unrated',
    className: 'badge badge--unrated',
  });
});
