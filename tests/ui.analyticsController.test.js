import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { AnalyticsService, DATE_RANGE_PRESETS } from '../src/services/AnalyticsService.js';
import { AnalyticsController } from '../src/ui/AnalyticsController.js';
import { AuditLedgerService } from '../src/services/AuditLedgerService.js';

function baseSubmission(overrides = {}) {
  return {
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

function makeController() {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const analyticsService = new AnalyticsService({ submissionService });
  const controller = new AnalyticsController({ analyticsService });
  return { submissionService, controller };
}

test('AnalyticsController requires an analyticsService', () => {
  assert.throws(() => new AnalyticsController({}), /analyticsService/);
});

test('getDateRangePresets returns all 5 presets', () => {
  const { controller } = makeController();
  assert.deepEqual(controller.getDateRangePresets(), [
    DATE_RANGE_PRESETS.LAST_7_DAYS,
    DATE_RANGE_PRESETS.LAST_30_DAYS,
    DATE_RANGE_PRESETS.LAST_60_DAYS,
    DATE_RANGE_PRESETS.LAST_90_DAYS,
    DATE_RANGE_PRESETS.ALL_TIME,
  ]);
});

test('getCompetitorOptions delegates to the analyticsService', () => {
  const { submissionService, controller } = makeController();
  submissionService.submit(baseSubmission({ competitor: 'Carvana' }));
  submissionService.submit(baseSubmission({ competitor: 'CarMax' }));
  assert.deepEqual(controller.getCompetitorOptions(), ['CarMax', 'Carvana']);
});

test('buildViewModel defaults to all time and no competitor filter', () => {
  const { submissionService, controller } = makeController();
  submissionService.submit(baseSubmission({ timestamp: '2020-01-01T00:00:00.000Z' }));

  const metrics = controller.buildViewModel();
  assert.equal(metrics.totalVolume, 1);
});

test('buildViewModel applies date range and competitor filters', () => {
  const { submissionService, controller } = makeController();
  submissionService.submit(baseSubmission({ timestamp: '2020-01-01T00:00:00.000Z', competitor: 'CarMax' }));
  submissionService.submit(baseSubmission({ competitor: 'Carvana' }));

  const recentOnly = controller.buildViewModel({ dateRange: DATE_RANGE_PRESETS.LAST_7_DAYS });
  assert.equal(recentOnly.totalVolume, 1);

  const carMaxOnly = controller.buildViewModel({ dateRange: DATE_RANGE_PRESETS.ALL_TIME, competitor: 'CarMax' });
  assert.equal(carMaxOnly.totalVolume, 1);
});

test('buildViewModel applies price tier and approval type filters', () => {
  const { submissionService, controller } = makeController();
  submissionService.submit(baseSubmission({ competitorOfferAmount: 5000, approvalType: 'AUTO_DISPATCH' }));
  submissionService.submit(baseSubmission({ competitorOfferAmount: 40000, approvalType: 'HUMAN_APPROVED' }));

  const lowTierOnly = controller.buildViewModel({ priceTier: 'tier-0-15k' });
  assert.equal(lowTierOnly.totalVolume, 1);

  const humanApprovedOnly = controller.buildViewModel({ approvalType: 'HUMAN_APPROVED' });
  assert.equal(humanApprovedOnly.totalVolume, 1);
});

test('getPriceTierOptions and getApprovalTypeOptions expose static filter choices', () => {
  const { controller } = makeController();
  assert.deepEqual(controller.getPriceTierOptions(), [
    { key: 'tier-0-15k', label: '$0–$15k' },
    { key: 'tier-15-30k', label: '$15k–$30k' },
    { key: 'tier-30k-plus', label: '$30k+' },
  ]);
  assert.deepEqual(controller.getApprovalTypeOptions(), ['AUTO_DISPATCH', 'HUMAN_APPROVED']);
});

test('getPolicyVersionPins delegates to the analyticsService', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const auditLedgerService = new AuditLedgerService({ tenantId: 't1', now: () => '2026-01-01T00:00:00.000Z' });
  auditLedgerService.recordMutation({ authorId: 'system', newConfig: { tenantId: 't1', tiersByCompetitor: {} } });
  const analyticsService = new AnalyticsService({ submissionService, auditLedgerService });
  const controller = new AnalyticsController({ analyticsService });

  assert.deepEqual(controller.getPolicyVersionPins(), [
    { policyVersionId: 'v1.1.0', timestamp: '2026-01-01T00:00:00.000Z', sequence: 1 },
  ]);
});
