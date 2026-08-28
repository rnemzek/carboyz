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
