import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService } from '../src/services/SubmissionService.js';
import {
  AnalyticsService,
  PRICE_TIERS,
  DATE_RANGE_PRESETS,
  resolveSinceDate,
  priceTierForAmount,
  competitorLabel,
  filterSubmissions,
  computeConversionMetrics,
  computeSpeedToLead,
  computeMarginTotals,
  computeCompetitorMatrix,
  computePriceTierDistribution,
  computeApprovalSplit,
  computeMetrics,
} from '../src/services/AnalyticsService.js';

function baseSubmission(overrides = {}) {
  return {
    id: 'id' in overrides ? overrides.id : 't1-sub-1',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    vin: '1HGCM82633A004352',
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    mileage: 25000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    ...overrides,
  };
}

test('resolveSinceDate returns a lower bound for 7/30-day presets and null for all time', () => {
  const now = new Date('2026-08-27T00:00:00.000Z');
  assert.equal(resolveSinceDate(DATE_RANGE_PRESETS.LAST_7_DAYS, now).toISOString(), '2026-08-20T00:00:00.000Z');
  assert.equal(resolveSinceDate(DATE_RANGE_PRESETS.LAST_30_DAYS, now).toISOString(), '2026-07-28T00:00:00.000Z');
  assert.equal(resolveSinceDate(DATE_RANGE_PRESETS.ALL_TIME, now), null);
  assert.equal(resolveSinceDate('UNKNOWN', now), null);
});

test('priceTierForAmount buckets at the documented boundaries', () => {
  assert.equal(priceTierForAmount(0).key, 'tier-0-15k');
  assert.equal(priceTierForAmount(14999).key, 'tier-0-15k');
  assert.equal(priceTierForAmount(15000).key, 'tier-15-30k');
  assert.equal(priceTierForAmount(29999).key, 'tier-15-30k');
  assert.equal(priceTierForAmount(30000).key, 'tier-30k-plus');
  assert.equal(priceTierForAmount(100000).key, 'tier-30k-plus');
  assert.equal(PRICE_TIERS.length, 3);
});

test('competitorLabel falls back to dealer name for Other, else the competitor value', () => {
  assert.equal(competitorLabel(baseSubmission({ competitor: 'Carvana' })), 'Carvana');
  assert.equal(
    competitorLabel(baseSubmission({ competitor: 'Other', competitorDealerName: 'WeBuyAnyCar' })),
    'Other (WeBuyAnyCar)',
  );
});

test('filterSubmissions filters by since date and by competitor label', () => {
  const submissions = [
    baseSubmission({ id: 'a', timestamp: '2026-08-01T00:00:00.000Z', competitor: 'CarMax' }),
    baseSubmission({ id: 'b', timestamp: '2026-08-20T00:00:00.000Z', competitor: 'Carvana' }),
    baseSubmission({
      id: 'c',
      timestamp: '2026-08-25T00:00:00.000Z',
      competitor: 'Other',
      competitorDealerName: 'WeBuyAnyCar',
    }),
  ];

  const sinceFiltered = filterSubmissions(submissions, { since: new Date('2026-08-10T00:00:00.000Z') });
  assert.deepEqual(sinceFiltered.map((s) => s.id), ['b', 'c']);

  const competitorFiltered = filterSubmissions(submissions, { competitor: 'Carvana' });
  assert.deepEqual(competitorFiltered.map((s) => s.id), ['b']);

  const otherFiltered = filterSubmissions(submissions, { competitor: 'Other (WeBuyAnyCar)' });
  assert.deepEqual(otherFiltered.map((s) => s.id), ['c']);

  assert.deepEqual(filterSubmissions(submissions, {}).map((s) => s.id), ['a', 'b', 'c']);
});

test('computeConversionMetrics is empty-safe and computes winRate over closed deals only', () => {
  assert.deepEqual(computeConversionMetrics([]), { total: 0, won: 0, lost: 0, winRate: 0 });

  const submissions = [
    baseSubmission({ id: 'a', winLossStatus: 'WON' }),
    baseSubmission({ id: 'b', winLossStatus: 'WON' }),
    baseSubmission({ id: 'c', winLossStatus: 'LOST' }),
    baseSubmission({ id: 'd', winLossStatus: 'PENDING' }),
  ];
  const result = computeConversionMetrics(submissions);
  assert.deepEqual(result, { total: 4, won: 2, lost: 1, winRate: 2 / 3 });
});

test('computeSpeedToLead returns null (not NaN/0) for empty slices and averages correctly', () => {
  assert.deepEqual(computeSpeedToLead([]), { overallAvgMs: null, autoDispatchAvgMs: null, humanApprovedAvgMs: null });

  const submissions = [
    baseSubmission({ id: 'a', timeToCounterMs: 1000, approvalType: 'AUTO_DISPATCH' }),
    baseSubmission({ id: 'b', timeToCounterMs: 3000, approvalType: 'AUTO_DISPATCH' }),
    baseSubmission({ id: 'c', timeToCounterMs: 6000, approvalType: 'HUMAN_APPROVED' }),
    baseSubmission({ id: 'd', timeToCounterMs: null }),
  ];
  const result = computeSpeedToLead(submissions);
  assert.equal(result.overallAvgMs, (1000 + 3000 + 6000) / 3);
  assert.equal(result.autoDispatchAvgMs, 2000);
  assert.equal(result.humanApprovedAvgMs, 6000);
});

test('computeMarginTotals sums expectedMargin only for WON submissions with a numeric margin', () => {
  assert.deepEqual(computeMarginTotals([]), { totalExpectedMargin: 0 });

  const submissions = [
    baseSubmission({ id: 'a', winLossStatus: 'WON', expectedMargin: 500 }),
    baseSubmission({ id: 'b', winLossStatus: 'WON', expectedMargin: 250 }),
    baseSubmission({ id: 'c', winLossStatus: 'LOST', expectedMargin: 900 }),
    baseSubmission({ id: 'd', winLossStatus: 'WON', expectedMargin: null }),
  ];
  assert.deepEqual(computeMarginTotals(submissions), { totalExpectedMargin: 750 });
});

test('computeApprovalSplit is empty-safe and scopes percentages to dispatched submissions only', () => {
  assert.deepEqual(computeApprovalSplit([]), {
    autoDispatchCount: 0,
    humanApprovedCount: 0,
    autoDispatchPct: 0,
    humanApprovedPct: 0,
  });

  const submissions = [
    baseSubmission({ id: 'a', approvalType: 'AUTO_DISPATCH' }),
    baseSubmission({ id: 'b', approvalType: 'AUTO_DISPATCH' }),
    baseSubmission({ id: 'c', approvalType: 'AUTO_DISPATCH' }),
    baseSubmission({ id: 'd', approvalType: 'HUMAN_APPROVED' }),
    baseSubmission({ id: 'e', approvalType: null }),
  ];
  const result = computeApprovalSplit(submissions);
  assert.deepEqual(result, {
    autoDispatchCount: 3,
    humanApprovedCount: 1,
    autoDispatchPct: 0.75,
    humanApprovedPct: 0.25,
  });
});

test('computeCompetitorMatrix aggregates per distinct competitor label', () => {
  const submissions = [
    baseSubmission({ id: 'a', competitor: 'CarMax', winLossStatus: 'WON', finalCounterOffer: 16000, expectedMargin: 400 }),
    baseSubmission({ id: 'b', competitor: 'CarMax', winLossStatus: 'LOST', finalCounterOffer: 15500 }),
    baseSubmission({ id: 'c', competitor: 'Carvana', winLossStatus: 'WON', finalCounterOffer: 20000, expectedMargin: 600 }),
  ];
  const matrix = computeCompetitorMatrix(submissions);
  assert.equal(matrix.length, 2);

  const carmax = matrix.find((row) => row.competitor === 'CarMax');
  assert.equal(carmax.volume, 2);
  assert.equal(carmax.avgCounterOffer, (16000 + 15500) / 2);
  assert.equal(carmax.winRate, 0.5);
  assert.equal(carmax.totalMargin, 400);

  const carvana = matrix.find((row) => row.competitor === 'Carvana');
  assert.equal(carvana.volume, 1);
  assert.equal(carvana.winRate, 1);
  assert.equal(carvana.totalMargin, 600);
});

test('computeCompetitorMatrix is empty-safe', () => {
  assert.deepEqual(computeCompetitorMatrix([]), []);
});

test('computePriceTierDistribution always returns all 3 tiers, even at zero volume', () => {
  const distribution = computePriceTierDistribution([]);
  assert.equal(distribution.length, 3);
  distribution.forEach((row) => assert.deepEqual({ volume: row.volume, winRate: row.winRate }, { volume: 0, winRate: 0 }));

  const submissions = [
    baseSubmission({ id: 'a', competitorOfferAmount: 5000, winLossStatus: 'WON' }),
    baseSubmission({ id: 'b', competitorOfferAmount: 20000, winLossStatus: 'LOST' }),
    baseSubmission({ id: 'c', competitorOfferAmount: 40000, winLossStatus: 'WON' }),
  ];
  const populated = computePriceTierDistribution(submissions);
  assert.equal(populated.find((row) => row.tier === 'tier-0-15k').volume, 1);
  assert.equal(populated.find((row) => row.tier === 'tier-15-30k').volume, 1);
  assert.equal(populated.find((row) => row.tier === 'tier-30k-plus').volume, 1);
});

test('computeMetrics aggregates all slices into one shape', () => {
  const metrics = computeMetrics([]);
  assert.equal(metrics.totalVolume, 0);
  assert.equal(metrics.winRate, 0);
  assert.equal(metrics.avgResponseTimeMs, null);
  assert.equal(metrics.totalExpectedMargin, 0);
  assert.equal(metrics.competitorMatrix.length, 0);
  assert.equal(metrics.priceTierDistribution.length, 3);
  assert.deepEqual(metrics.approvalSplit, {
    autoDispatchCount: 0,
    humanApprovedCount: 0,
    autoDispatchPct: 0,
    humanApprovedPct: 0,
  });
});

test('AnalyticsService requires a submissionService', () => {
  assert.throws(() => new AnalyticsService({}), /submissionService/);
});

test('AnalyticsService.getMetrics reads through submissionService and applies filters', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  submissionService.submit(baseSubmission({ id: undefined, competitor: 'CarMax' }));
  const second = submissionService.submit(baseSubmission({ id: undefined, competitor: 'Carvana' }));
  submissionService.updateFields(second.id, { winLossStatus: 'WON', expectedMargin: 300 });

  const analyticsService = new AnalyticsService({ submissionService });
  const all = analyticsService.getMetrics();
  assert.equal(all.totalVolume, 2);

  const filtered = analyticsService.getMetrics({ competitor: 'Carvana' });
  assert.equal(filtered.totalVolume, 1);
  assert.equal(filtered.totalExpectedMargin, 300);
});

test('AnalyticsService.getCompetitorLabels dedupes and sorts distinct competitor labels', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  submissionService.submit(baseSubmission({ id: undefined, competitor: 'Carvana' }));
  submissionService.submit(baseSubmission({ id: undefined, competitor: 'CarMax' }));
  submissionService.submit(baseSubmission({ id: undefined, competitor: 'CarMax' }));
  submissionService.submit(
    baseSubmission({ id: undefined, competitor: 'Other', competitorDealerName: 'WeBuyAnyCar' }),
  );

  const analyticsService = new AnalyticsService({ submissionService });
  assert.deepEqual(analyticsService.getCompetitorLabels(), ['CarMax', 'Carvana', 'Other (WeBuyAnyCar)']);
});
