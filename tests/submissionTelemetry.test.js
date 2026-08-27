import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Submission, WIN_LOSS_STATUSES, APPROVAL_TYPES } from '../src/models/Submission.js';
import { TelemetryService } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SpreadConfigService } from '../src/services/SpreadConfigService.js';
import { DispatchService } from '../src/services/DispatchService.js';
import { LeadInboxController, WIN_LOSS_QUICK_ACTIONS } from '../src/ui/LeadInboxController.js';

function baseSubmissionData(overrides = {}) {
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

function submissionData(overrides = {}) {
  return {
    id: 's1',
    timestamp: '2026-08-25T00:00:00.000Z',
    ...baseSubmissionData(overrides),
  };
}

function makeServices() {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  return { telemetryService, ingestService, submissionService, spreadConfigService };
}

// --- Schema validation ---

test('Submission defaults winLossStatus to PENDING and telemetry fields to null', () => {
  const submission = new Submission(submissionData());
  assert.equal(submission.winLossStatus, 'PENDING');
  assert.equal(submission.initialCompetitorOffer, null);
  assert.equal(submission.calculatedCounterOffer, null);
  assert.equal(submission.finalCounterOffer, null);
  assert.equal(submission.expectedMargin, null);
  assert.equal(submission.timeToCounterMs, null);
  assert.equal(submission.priceBracket, null);
  assert.equal(submission.approvalType, null);
});

test('Submission accepts every WIN_LOSS_STATUSES value and rejects an invalid one', () => {
  WIN_LOSS_STATUSES.forEach((winLossStatus) => {
    assert.doesNotThrow(() => new Submission(submissionData({ winLossStatus })));
  });
  assert.throws(() => new Submission(submissionData({ winLossStatus: 'MAYBE' })), /winLossStatus/);
});

test('Submission accepts every APPROVAL_TYPES value plus null, and rejects an invalid one', () => {
  APPROVAL_TYPES.forEach((approvalType) => {
    assert.doesNotThrow(() => new Submission(submissionData({ approvalType })));
  });
  assert.doesNotThrow(() => new Submission(submissionData({ approvalType: null })));
  assert.throws(() => new Submission(submissionData({ approvalType: 'MAYBE' })), /approvalType/);
});

test('Submission validates numeric telemetry fields', () => {
  assert.throws(() => new Submission(submissionData({ calculatedCounterOffer: 'lots' })), /calculatedCounterOffer/);
  assert.throws(() => new Submission(submissionData({ finalCounterOffer: -5 })), /finalCounterOffer/);
  assert.throws(() => new Submission(submissionData({ initialCompetitorOffer: -1 })), /initialCompetitorOffer/);
  assert.throws(() => new Submission(submissionData({ timeToCounterMs: -1 })), /timeToCounterMs/);
  assert.throws(() => new Submission(submissionData({ timeToCounterMs: 'fast' })), /timeToCounterMs/);
  assert.doesNotThrow(() => new Submission(submissionData({ calculatedCounterOffer: 15300 })));
});

test('Submission allows expectedMargin to be negative (a deal can run at a loss)', () => {
  const submission = new Submission(submissionData({ expectedMargin: -200 }));
  assert.equal(submission.expectedMargin, -200);
});

test('Submission validates priceBracket as a string or null', () => {
  assert.doesNotThrow(() => new Submission(submissionData({ priceBracket: '$0-$15,000' })));
  assert.doesNotThrow(() => new Submission(submissionData({ priceBracket: null })));
  assert.throws(() => new Submission(submissionData({ priceBracket: 12345 })), /priceBracket/);
});

// --- DispatchService: auto-population + delta time math + margin ---

test('dispatch: auto path populates telemetry, timeToCounterMs, and priceBracket', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const timestamp = new Date(Date.now() - 5000).toISOString();
  const submission = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 15000, timestamp }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const before = Date.now();
  const { submission: updated, spreadResult } = dispatchService.dispatch(submission);
  const after = Date.now();

  assert.equal(updated.winLossStatus, 'AUTO_COUNTERED');
  assert.equal(updated.approvalType, 'AUTO_DISPATCH');
  assert.equal(updated.initialCompetitorOffer, 15000);
  assert.equal(updated.calculatedCounterOffer, spreadResult.recommendedCounterOffer);
  assert.equal(updated.finalCounterOffer, spreadResult.recommendedCounterOffer);
  assert.equal(updated.expectedMargin, spreadResult.estimatedWholesaleValue - spreadResult.recommendedCounterOffer);
  assert.equal(updated.priceBracket, '$15,000-$30,000');

  // timeToCounterMs is measured from the submission's own timestamp to "now" at dispatch time.
  assert.ok(updated.timeToCounterMs >= before - new Date(timestamp).getTime());
  assert.ok(updated.timeToCounterMs <= after - new Date(timestamp).getTime());
});

test('dispatch: manual path populates pending telemetry but leaves timeToCounterMs/approvalType null', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 40000 });
  const submission = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 32000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const { submission: updated, spreadResult } = dispatchService.dispatch(submission);

  assert.equal(updated.status, 'PENDING_APPROVAL');
  assert.equal(updated.winLossStatus, 'PENDING');
  assert.equal(updated.approvalType, null);
  assert.equal(updated.timeToCounterMs, null);
  assert.equal(updated.calculatedCounterOffer, spreadResult.recommendedCounterOffer);
  assert.equal(updated.finalCounterOffer, spreadResult.recommendedCounterOffer);
  assert.equal(updated.priceBracket, '$30,000+');
});

test('dispatch: expectedMargin is null when no market data is available (NO_DATA)', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  const submission = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const { submission: updated, spreadResult } = dispatchService.dispatch(submission);

  assert.equal(spreadResult.status, 'NO_DATA');
  assert.equal(updated.expectedMargin, null);
});

test('dispatch: priceBracket is null when no tier bracket matches', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  spreadConfigService.saveConfig({
    tiersByCompetitor: { CarMax: [{ minPrice: 20000, maxPrice: null, flatAmount: 500, percent: 0, autoApprove: true }] },
  });
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const submission = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const { submission: updated } = dispatchService.dispatch(submission);
  assert.equal(updated.priceBracket, null);
});

// --- LeadInboxController: re-calculation on human override + WON/LOST toggles ---

test('approveAndSend re-calculates finalCounterOffer, expectedMargin, approvalType, and timeToCounterMs on override', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const created = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService, spreadConfigService });

  // FMV = 20000; estimatedWholesaleValue = 17600.
  const { submission } = controller.approveAndSend(created.id, 16000);

  assert.equal(submission.status, 'AUTO_COUNTER_SENT');
  assert.equal(submission.winLossStatus, 'MANUAL_APPROVED');
  assert.equal(submission.approvalType, 'HUMAN_APPROVED');
  assert.equal(submission.finalCounterOffer, 16000);
  assert.equal(submission.expectedMargin, 17600 - 16000);
  assert.ok(submission.timeToCounterMs >= 0);
});

test('approveAndSend sets expectedMargin to null when no market data is available', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const { submission } = controller.approveAndSend(created.id, 15300);
  assert.equal(submission.expectedMargin, null);
});

test('approveAndSend throws for a missing submission id', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });
  assert.throws(() => controller.approveAndSend('missing-id', 100), /not found/);
});

test('markWinLoss transitions a submission to WON or LOST', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmissionData());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const won = controller.markWinLoss(created.id, 'WON');
  assert.equal(won.winLossStatus, 'WON');

  const lost = controller.markWinLoss(created.id, 'LOST');
  assert.equal(lost.winLossStatus, 'LOST');

  assert.deepEqual(WIN_LOSS_QUICK_ACTIONS, ['WON', 'LOST']);
});

test('markWinLoss rejects any status outside the WON/LOST quick actions', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmissionData());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.throws(() => controller.markWinLoss(created.id, 'EXPIRED'), /markWinLoss/);
});

// --- SubmissionService: intake snapshot + generic field patching ---

test('submit auto-populates initialCompetitorOffer as an immutable intake snapshot', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const created = submissionService.submit(baseSubmissionData({ competitorOfferAmount: 22000 }));
  assert.equal(created.initialCompetitorOffer, 22000);
});

test('updateFields patches multiple telemetry fields atomically and persists them', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const created = submissionService.submit(baseSubmissionData());

  const updated = submissionService.updateFields(created.id, {
    calculatedCounterOffer: 15300,
    finalCounterOffer: 15300,
    expectedMargin: 2300,
    priceBracket: '$0-$15,000',
  });

  assert.equal(updated.calculatedCounterOffer, 15300);
  assert.equal(updated.finalCounterOffer, 15300);
  assert.equal(updated.expectedMargin, 2300);
  assert.equal(updated.priceBracket, '$0-$15,000');
  assert.throws(() => submissionService.updateFields('missing-id', { winLossStatus: 'WON' }), /not found/);
});
