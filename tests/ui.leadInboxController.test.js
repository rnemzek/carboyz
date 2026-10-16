import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryService } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { LeadInboxController } from '../src/ui/LeadInboxController.js';
import { DealScoreStatus } from '../src/services/SpreadService.js';

function baseSubmission(overrides = {}) {
  return {
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    mileage: 30000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    ...overrides,
  };
}

function makeServices() {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const submissionService = new SubmissionService({ tenantId: 't1' });
  return { telemetryService, ingestService, submissionService };
}

test('LeadInboxController requires submissionService, telemetryService, and ingestService', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();

  assert.throws(() => new LeadInboxController({ telemetryService, ingestService }), /submissionService/);
  assert.throws(() => new LeadInboxController({ submissionService, ingestService }), /telemetryService/);
  assert.throws(() => new LeadInboxController({ submissionService, telemetryService }), /ingestService/);
});

test('buildLeadViewModels resolves fair market value from matching inventory comps and scores the spread', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2020, price: 20000 });

  submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.vehicleTitle, '2020 Toyota Camry');
  assert.equal(lead.competitorLabel, 'CarMax');
  assert.equal(lead.competitorOfferAmount, 15000);
  // FMV = 20000 (single comp average); estimatedWholesaleValue = 17600; spread = 2600
  assert.equal(lead.spreadResult.spread, 2600);
  assert.equal(lead.spreadResult.status, DealScoreStatus.GREENLIGHT);
  assert.equal(lead.spreadResult.recommendedCounterOffer, 15300);
});

test('buildLeadViewModels surfaces the submission offerSourceType, defaulting to FIRM_OFFER', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  submissionService.submit(baseSubmission());
  submissionService.submit(baseSubmission({ offerSourceType: 'ESTIMATE' }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [firm, estimate] = controller.buildLeadViewModels();
  assert.equal(firm.offerSourceType, 'FIRM_OFFER');
  assert.equal(estimate.offerSourceType, 'ESTIMATE');
});

test('buildLeadViewModels surfaces the submission vin (null for a no-VIN ESTIMATE lead)', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  submissionService.submit(baseSubmission({ vin: undefined, offerSourceType: 'ESTIMATE' }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.vin, null);
});

test('buildLeadViewModels surfaces the submission timestamp and nagSentAt', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const submission = submissionService.submit(baseSubmission());
  submissionService.updateFields(submission.id, { status: 'PENDING_APPROVAL', nagSentAt: '2026-08-25T14:05:00.000Z' });
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.timestamp, submission.timestamp);
  assert.equal(lead.nagSentAt, '2026-08-25T14:05:00.000Z');
});

test('buildLeadViewModels labels an Other competitor with the dealer name', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  submissionService.submit(
    baseSubmission({ competitor: 'Other', competitorDealerName: 'Hendrick Motors' }),
  );
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.competitorLabel, 'Other (Hendrick Motors)');
});

test('buildLeadViewModels returns NO_DATA when no inventory comps exist for the submission', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.spreadResult.status, DealScoreStatus.NO_DATA);
  assert.equal(lead.spreadResult.recommendedCounterOffer, 15300);
});

test('updateStatus delegates to submissionService and is reflected in the next view model build', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  controller.updateStatus(created.id, 'IN_REVIEW');

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.status, 'IN_REVIEW');
});

test('buildLeadViewModels includes a formatted counterMessage for each lead', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [lead] = controller.buildLeadViewModels();
  assert.match(lead.counterMessage, /Car Offer Beaters/);
  assert.match(lead.counterMessage, /\$15,300/);
});

test('approveAndSend marks the submission AUTO_COUNTER_SENT and formats the message with the given amount', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const { submission, message } = controller.approveAndSend(created.id, 16000);

  assert.equal(submission.status, 'AUTO_COUNTER_SENT');
  assert.match(message, /\$16,000/);

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.status, 'AUTO_COUNTER_SENT');
});

test('approveAndSend marks isAutoApproved: false (rep-adjusted, not auto-calculated) and mirrors projectedMargin to expectedMargin', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2020, price: 20000 });
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const { submission } = controller.approveAndSend(created.id, 16000);

  assert.equal(submission.isAutoApproved, false);
  assert.equal(submission.approvalType, 'HUMAN_APPROVED');
  assert.equal(submission.projectedMargin, submission.expectedMargin);
  assert.notEqual(submission.projectedMargin, null);
});

test('approveAndSend resolves the session stash with the override amount when a sessionStashService is configured', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const resolveCalls = [];
  const sessionStashService = {
    resolveBySubmissionId: (id, patch) => resolveCalls.push({ id, ...patch }),
  };
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService, sessionStashService });

  controller.approveAndSend(created.id, 16000);

  assert.equal(resolveCalls.length, 1);
  assert.equal(resolveCalls[0].id, created.id);
  assert.equal(resolveCalls[0].finalCounterOffer, 16000);
});

test('approveAndSend works without a sessionStashService configured', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.doesNotThrow(() => controller.approveAndSend(created.id, 16000));
});

test('approveAndSend marks modifiedBy DESK_OVERRIDE and stamps modifiedAt', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const before = Date.now();
  const { submission } = controller.approveAndSend(created.id, 16000);

  assert.equal(submission.modifiedBy, 'DESK_OVERRIDE');
  assert.ok(new Date(submission.modifiedAt).getTime() >= before);
});

test('buildLeadViewModels exposes proposedCounterOffer, defaulting to the recommended counter until a finalCounterOffer is set', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2020, price: 20000 });
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const [beforeOverride] = controller.buildLeadViewModels();
  assert.equal(beforeOverride.proposedCounterOffer, beforeOverride.spreadResult.recommendedCounterOffer);
  assert.equal(beforeOverride.finalCounterOffer, null);

  controller.overrideCounterOffer(created.id, 15900);

  const [afterOverride] = controller.buildLeadViewModels();
  assert.equal(afterOverride.proposedCounterOffer, 15900);
  assert.equal(afterOverride.finalCounterOffer, 15900);
});

test('overrideCounterOffer stages a desk-adjusted counter without dispatching (status stays unchanged)', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2020, price: 20000 });
  const created = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  submissionService.updateStatus(created.id, 'PENDING_APPROVAL');
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const { submission, projectedMargin } = controller.overrideCounterOffer(created.id, 15900);

  assert.equal(submission.status, 'PENDING_APPROVAL');
  assert.equal(submission.finalCounterOffer, 15900);
  assert.equal(submission.modifiedBy, 'DESK_OVERRIDE');
  assert.ok(submission.modifiedAt);
  // FMV = 20000; estimatedWholesaleValue = 17600; projectedMargin = 17600 - 15900 = 1700
  assert.equal(projectedMargin, 1700);
  assert.equal(submission.projectedMargin, 1700);
});

test('overrideCounterOffer throws for an unknown submission id', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.throws(() => controller.overrideCounterOffer('nope', 1000), /Submission not found/);
});

test('rejectLead marks the submission REJECTED and persists the rejection reason and notes', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const updated = controller.rejectLead(created.id, {
    rejectionReason: 'TITLE_OR_CONDITION_ISSUE',
    rejectionNotes: 'Salvage title per NMVTIS check.',
  });

  assert.equal(updated.status, 'REJECTED');
  assert.equal(updated.rejectionReason, 'TITLE_OR_CONDITION_ISSUE');
  assert.equal(updated.rejectionNotes, 'Salvage title per NMVTIS check.');

  const [lead] = controller.buildLeadViewModels();
  assert.equal(lead.status, 'REJECTED');
  assert.equal(lead.rejectionReason, 'TITLE_OR_CONDITION_ISSUE');
});

test('rejectLead defaults rejectionNotes to null when omitted', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const updated = controller.rejectLead(created.id, { rejectionReason: 'OTHER' });

  assert.equal(updated.rejectionNotes, null);
});

test('rejectLead throws without a valid rejectionReason, mirroring the Submission model validation', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.throws(() => controller.rejectLead(created.id, {}), /rejectionReason/);
});

test('getSubmission returns the matching submission by id, or null when not found', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const created = submissionService.submit(baseSubmission());
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.equal(controller.getSubmission(created.id), created);
  assert.equal(controller.getSubmission('nope'), null);
});

test('buildLeadViewModels applies a custom tier config from an injected spreadConfigService', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2020, price: 20000 });
  submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));

  const spreadConfigService = {
    getTiersForCompetitor: (competitor) => {
      assert.equal(competitor, 'CarMax');
      return [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0.1, strategy: 'PERCENT_ONLY' }];
    },
  };
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService, spreadConfigService });

  const [lead] = controller.buildLeadViewModels();
  // percent-only tier: 15000 * 0.1 = 1500, so recommended counter is 15000 + 1500 = 16500 (not the flat +300 default)
  assert.equal(lead.spreadResult.recommendedCounterOffer, 16500);
});

test('createPairingSession delegates to sessionStashService and builds a pairing URL', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const calls = [];
  const sessionStashService = {
    createPairingSession: () => {
      calls.push('createPairingSession');
      return 'pair-t1-123';
    },
  };
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService, sessionStashService });

  const { pairingSessionId, url } = controller.createPairingSession({ baseUrl: 'https://app.example/sell' });

  assert.equal(calls.length, 1);
  assert.equal(pairingSessionId, 'pair-t1-123');
  assert.equal(url, 'https://app.example/sell?sessionId=pair-t1-123');
});

test('createPairingSession throws without a sessionStashService configured', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  assert.throws(() => controller.createPairingSession({ baseUrl: 'https://app.example' }), /sessionStashService/);
});

test('subscribeToPairingConnected delegates to sessionStashService and returns its unsubscribe function', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const subscribeCalls = [];
  const unsubscribeSpy = () => {};
  const sessionStashService = {
    subscribeToPairingConnected: (pairingSessionId, onConnected) => {
      subscribeCalls.push({ pairingSessionId, onConnected });
      return unsubscribeSpy;
    },
  };
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService, sessionStashService });

  const onConnected = () => {};
  const unsubscribe = controller.subscribeToPairingConnected('pair-t1-123', onConnected);

  assert.equal(subscribeCalls.length, 1);
  assert.equal(subscribeCalls[0].pairingSessionId, 'pair-t1-123');
  assert.equal(subscribeCalls[0].onConnected, onConnected);
  assert.equal(unsubscribe, unsubscribeSpy);
});

test('subscribeToPairingConnected is a safe no-op without a sessionStashService configured', () => {
  const { telemetryService, ingestService, submissionService } = makeServices();
  const controller = new LeadInboxController({ submissionService, telemetryService, ingestService });

  const unsubscribe = controller.subscribeToPairingConnected('anything', () => {
    throw new Error('should never be called');
  });
  assert.doesNotThrow(() => unsubscribe());
});
