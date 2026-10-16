import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFER_GRID_FILTERS,
  sortLeadsByTimestampDesc,
  filterOfferGridLeads,
  computeOfferGridSummary,
  previewCounterAdjustment,
} from '../src/ui/OfferCounterTableView.js';

function lead(overrides = {}) {
  return {
    id: 'lead-1',
    timestamp: '2026-08-25T10:00:00.000Z',
    status: 'PENDING_APPROVAL',
    projectedMargin: null,
    spreadResult: { spread: 1000, estimatedWholesaleValue: 17600, recommendedCounterOffer: 15300 },
    ...overrides,
  };
}

test('sortLeadsByTimestampDesc orders newest first without mutating the input', () => {
  const oldest = lead({ id: 'a', timestamp: '2026-08-20T00:00:00.000Z' });
  const newest = lead({ id: 'b', timestamp: '2026-08-26T00:00:00.000Z' });
  const middle = lead({ id: 'c', timestamp: '2026-08-23T00:00:00.000Z' });
  const input = [oldest, newest, middle];

  const sorted = sortLeadsByTimestampDesc(input);

  assert.deepEqual(sorted.map((l) => l.id), ['b', 'c', 'a']);
  assert.deepEqual(input.map((l) => l.id), ['a', 'b', 'c']);
});

test('filterOfferGridLeads ALL returns every lead unchanged', () => {
  const leads = [lead({ id: 'a', status: 'PENDING_APPROVAL' }), lead({ id: 'b', status: 'REJECTED' })];
  assert.deepEqual(filterOfferGridLeads(leads, OFFER_GRID_FILTERS.ALL), leads);
});

test('filterOfferGridLeads NEEDS_REVIEW keeps only PENDING_APPROVAL leads', () => {
  const leads = [
    lead({ id: 'a', status: 'PENDING_APPROVAL' }),
    lead({ id: 'b', status: 'AUTO_COUNTER_SENT' }),
    lead({ id: 'c', status: 'REJECTED' }),
  ];
  assert.deepEqual(filterOfferGridLeads(leads, OFFER_GRID_FILTERS.NEEDS_REVIEW).map((l) => l.id), ['a']);
});

test('filterOfferGridLeads COUNTER_SENT keeps only AUTO_COUNTER_SENT leads', () => {
  const leads = [
    lead({ id: 'a', status: 'PENDING_APPROVAL' }),
    lead({ id: 'b', status: 'AUTO_COUNTER_SENT' }),
  ];
  assert.deepEqual(filterOfferGridLeads(leads, OFFER_GRID_FILTERS.COUNTER_SENT).map((l) => l.id), ['b']);
});

test('filterOfferGridLeads PASSED keeps only REJECTED leads', () => {
  const leads = [lead({ id: 'a', status: 'REJECTED' }), lead({ id: 'b', status: 'IN_REVIEW' })];
  assert.deepEqual(filterOfferGridLeads(leads, OFFER_GRID_FILTERS.PASSED).map((l) => l.id), ['a']);
});

test('computeOfferGridSummary counts total bids and pending review across the full lead set', () => {
  const leads = [
    lead({ id: 'a', status: 'PENDING_APPROVAL' }),
    lead({ id: 'b', status: 'PENDING_APPROVAL' }),
    lead({ id: 'c', status: 'AUTO_COUNTER_SENT' }),
  ];
  const summary = computeOfferGridSummary(leads);
  assert.equal(summary.totalBids, 3);
  assert.equal(summary.pendingReviewCount, 2);
});

test('computeOfferGridSummary aggregates projectedMargin when set, falling back to spreadResult.spread otherwise', () => {
  const leads = [
    lead({ id: 'a', projectedMargin: 2000, spreadResult: { spread: 999999, estimatedWholesaleValue: 1, recommendedCounterOffer: 1 } }),
    lead({ id: 'b', projectedMargin: null, spreadResult: { spread: 1500, estimatedWholesaleValue: 1, recommendedCounterOffer: 1 } }),
    lead({ id: 'c', projectedMargin: null, spreadResult: { spread: null, estimatedWholesaleValue: null, recommendedCounterOffer: 1 } }),
  ];
  const summary = computeOfferGridSummary(leads);
  assert.equal(summary.aggregateProjectedMargin, 2000 + 1500 + 0);
});

test('previewCounterAdjustment computes projected margin and delta from the recommended counter', () => {
  const l = lead({ spreadResult: { spread: 1000, estimatedWholesaleValue: 17600, recommendedCounterOffer: 15300 } });
  const preview = previewCounterAdjustment(l, 16000);
  assert.equal(preview.projectedMargin, 1600);
  assert.equal(preview.deltaFromRecommended, 700);
});

test('previewCounterAdjustment returns null projectedMargin when estimatedWholesaleValue is unavailable (NO_DATA)', () => {
  const l = lead({ spreadResult: { spread: null, estimatedWholesaleValue: null, recommendedCounterOffer: 15300 } });
  const preview = previewCounterAdjustment(l, 15300);
  assert.equal(preview.projectedMargin, null);
  assert.equal(preview.deltaFromRecommended, 0);
});
