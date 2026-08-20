import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPositionBadge, marketVerdictBadge } from '../src/ui/marketBadge.js';
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

test('marketVerdictBadge maps each evaluateMarketComps verdict to a label and CSS class', () => {
  assert.deepEqual(marketVerdictBadge('Underpriced'), {
    label: 'Underpriced',
    className: 'badge badge--underpriced',
  });
  assert.deepEqual(marketVerdictBadge('Fair Market'), {
    label: 'Fair Market',
    className: 'badge badge--fair',
  });
  assert.deepEqual(marketVerdictBadge('Overpriced'), {
    label: 'Overpriced',
    className: 'badge badge--overpriced',
  });
});

test('marketVerdictBadge falls back to an unrated badge for unknown/null verdicts', () => {
  assert.deepEqual(marketVerdictBadge(null), { label: 'Unrated', className: 'badge badge--unrated' });
  assert.deepEqual(marketVerdictBadge('SOMETHING_ELSE'), {
    label: 'Unrated',
    className: 'badge badge--unrated',
  });
});
