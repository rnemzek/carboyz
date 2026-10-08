import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerSourceBadge } from '../src/ui/LeadInboxView.js';

test('offerSourceBadge renders an amber [ESTIMATE COUNTER] badge for an ESTIMATE-sourced lead', () => {
  const badge = offerSourceBadge('ESTIMATE');
  assert.equal(badge.label, '[ESTIMATE COUNTER]');
  assert.match(badge.className, /badge--estimate-counter/);
});

test('offerSourceBadge renders a green [FIRM COUNTER] badge for a FIRM_OFFER-sourced lead', () => {
  const badge = offerSourceBadge('FIRM_OFFER');
  assert.equal(badge.label, '[FIRM COUNTER]');
  assert.match(badge.className, /badge--firm-counter/);
});

test('offerSourceBadge returns null for an unset or unrecognized offerSourceType', () => {
  assert.equal(offerSourceBadge(undefined), null);
  assert.equal(offerSourceBadge(null), null);
  assert.equal(offerSourceBadge('WHATEVER'), null);
});
