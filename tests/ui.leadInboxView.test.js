import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerSourceBadge, isPassedLead, needsReviewBadge, formatEscalatedAtLabel } from '../src/ui/LeadInboxView.js';

test('offerSourceBadge renders an amber [ESTIMATE COUNTER] badge for a VIN-verified ESTIMATE lead', () => {
  const badge = offerSourceBadge('ESTIMATE', '1HGCM82633A004352');
  assert.equal(badge.label, '[ESTIMATE COUNTER]');
  assert.match(badge.className, /badge--estimate-counter/);
});

test('offerSourceBadge renders an amber-outline [PRELIMINARY - NO VIN] badge for a no-VIN ESTIMATE lead', () => {
  const withoutVinArg = offerSourceBadge('ESTIMATE');
  assert.equal(withoutVinArg.label, '[PRELIMINARY - NO VIN]');
  assert.match(withoutVinArg.className, /badge--preliminary-no-vin/);

  const withNullVin = offerSourceBadge('ESTIMATE', null);
  assert.equal(withNullVin.label, '[PRELIMINARY - NO VIN]');
  assert.match(withNullVin.className, /badge--preliminary-no-vin/);
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

test('isPassedLead is true only for REJECTED status', () => {
  assert.equal(isPassedLead('REJECTED'), true);
  assert.equal(isPassedLead('PENDING_APPROVAL'), false);
  assert.equal(isPassedLead('AUTO_COUNTER_SENT'), false);
  assert.equal(isPassedLead('DECLINED'), false);
  assert.equal(isPassedLead(undefined), false);
});

test('needsReviewBadge fires only for a PENDING_APPROVAL lead waiting 15+ minutes', () => {
  const badge = needsReviewBadge('PENDING_APPROVAL', 15);
  assert.equal(badge.label, '[NEEDS REVIEW - 15m+]');
  assert.match(badge.className, /badge--needs-review/);

  assert.equal(needsReviewBadge('PENDING_APPROVAL', 14.9), null);
  assert.equal(needsReviewBadge('AUTO_COUNTER_SENT', 30), null);
  assert.equal(needsReviewBadge('REJECTED', 30), null);
});

test('formatEscalatedAtLabel is null until nagSentAt is set, otherwise shows the escalation time', () => {
  assert.equal(formatEscalatedAtLabel(null), null);
  assert.equal(formatEscalatedAtLabel(undefined), null);
  assert.match(formatEscalatedAtLabel('2026-08-25T14:05:00.000Z'), /^Escalated to desk at \d{2}:\d{2}/);
});
