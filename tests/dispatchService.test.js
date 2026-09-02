import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryService } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SpreadConfigService } from '../src/services/SpreadConfigService.js';
import { DealScoreStatus } from '../src/services/SpreadService.js';
import {
  DispatchService,
  DISPATCH_OUTCOMES,
  formatCounterOfferMessage,
  buildApprovalNotification,
} from '../src/services/DispatchService.js';

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

function makeServices() {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  return { telemetryService, ingestService, submissionService, spreadConfigService };
}

function makeDeps(overrides = {}) {
  return { ...makeServices(), ...overrides };
}

test('DispatchService requires submissionService, spreadConfigService, telemetryService, and ingestService', () => {
  const deps = makeDeps();

  assert.throws(
    () =>
      new DispatchService({
        spreadConfigService: deps.spreadConfigService,
        telemetryService: deps.telemetryService,
        ingestService: deps.ingestService,
      }),
    /submissionService/,
  );
  assert.throws(
    () =>
      new DispatchService({
        submissionService: deps.submissionService,
        telemetryService: deps.telemetryService,
        ingestService: deps.ingestService,
      }),
    /spreadConfigService/,
  );
  assert.throws(
    () =>
      new DispatchService({
        submissionService: deps.submissionService,
        spreadConfigService: deps.spreadConfigService,
        ingestService: deps.ingestService,
      }),
    /telemetryService/,
  );
  assert.throws(
    () =>
      new DispatchService({
        submissionService: deps.submissionService,
        spreadConfigService: deps.spreadConfigService,
        telemetryService: deps.telemetryService,
      }),
    /ingestService/,
  );
});

test('evaluate: an autoApprove tier scoring GREENLIGHT should auto-dispatch', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  // FMV = 20000; estimatedWholesaleValue = 17600; spread = 2600 -> GREENLIGHT.
  // 15000 lands in the $15k-30k default bracket, which defaults to autoApprove:true.
  const { spreadResult, autoApprove, shouldAutoDispatch } = dispatchService.evaluate(submission);
  assert.equal(spreadResult.status, DealScoreStatus.GREENLIGHT);
  assert.equal(autoApprove, true);
  assert.equal(shouldAutoDispatch, true);
});

test('evaluate: an autoApprove tier that does not score GREENLIGHT still requires manual review', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  // No inventory comps -> NO_DATA, even though the $0-15k/$15k-30k brackets are autoApprove:true.
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const { spreadResult, autoApprove, shouldAutoDispatch } = dispatchService.evaluate(submission);
  assert.equal(spreadResult.status, DealScoreStatus.NO_DATA);
  assert.equal(autoApprove, true);
  assert.equal(shouldAutoDispatch, false);
});

test('evaluate: a non-autoApprove ($30k+) tier never auto-dispatches even at GREENLIGHT', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 40000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 32000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  // estimatedWholesaleValue = 35200; spread = 3200 -> GREENLIGHT, but $30k+ bracket is autoApprove:false.
  const { spreadResult, autoApprove, shouldAutoDispatch } = dispatchService.evaluate(submission);
  assert.equal(spreadResult.status, DealScoreStatus.GREENLIGHT);
  assert.equal(autoApprove, false);
  assert.equal(shouldAutoDispatch, false);
});

test('evaluate: no matching tier bracket defaults to requiring manual review', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  spreadConfigService.saveConfig({
    tiersByCompetitor: { CarMax: [{ minPrice: 20000, maxPrice: null, flatAmount: 500, percent: 0, autoApprove: true }] },
  });
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const { autoApprove, shouldAutoDispatch } = dispatchService.evaluate(submission);
  assert.equal(autoApprove, false);
  assert.equal(shouldAutoDispatch, false);
});

test('dispatch: auto path marks AUTO_COUNTER_SENT and returns a formatted message', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const result = dispatchService.dispatch(submission);

  assert.equal(result.outcome, DISPATCH_OUTCOMES.AUTO_COUNTER_SENT);
  assert.equal(result.submission.status, 'AUTO_COUNTER_SENT');
  assert.equal(submissionService.getSubmissions()[0].status, 'AUTO_COUNTER_SENT');
  assert.match(result.message, /Car Offer Beaters/);
  assert.match(result.message, /2021 Honda Civic/);
});

test('dispatch: auto path pins the spreadConfigService active policyVersionId onto the submission', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  spreadConfigService.saveConfig({
    tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02, autoApprove: true }] },
  });
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 20000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 15000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const result = dispatchService.dispatch(submission);

  assert.equal(spreadConfigService.getActivePolicyVersionId(), 'v1.1.0');
  assert.equal(result.submission.policyVersionId, 'v1.1.0');
  assert.equal(result.spreadResult.policyVersionId, 'v1.1.0');
});

test('dispatch: manual path also pins the active policyVersionId onto the submission', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 40000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 32000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  const result = dispatchService.dispatch(submission);

  assert.equal(result.submission.policyVersionId, spreadConfigService.getActivePolicyVersionId());
});

test('dispatch: manual path marks PENDING_APPROVAL and notifies the distro group', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 40000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 32000 }));
  const notifications = [];
  const notifier = { notify: (n) => notifications.push(n) };
  const dispatchService = new DispatchService({
    submissionService,
    spreadConfigService,
    telemetryService,
    ingestService,
    notifier,
  });

  const result = dispatchService.dispatch(submission);

  assert.equal(result.outcome, DISPATCH_OUTCOMES.PENDING_APPROVAL);
  assert.equal(result.submission.status, 'PENDING_APPROVAL');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].target, 'CarBoyZ distro group');
  assert.match(notifications[0].title, /sign-off/);
});

test('dispatch: manual path works without a notifier configured', () => {
  const { telemetryService, ingestService, submissionService, spreadConfigService } = makeServices();
  ingestService.intake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 40000 });
  const submission = submissionService.submit(baseSubmission({ competitorOfferAmount: 32000 }));
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  assert.doesNotThrow(() => dispatchService.dispatch(submission));
});

test('formatCounterOfferMessage produces the expected template', () => {
  const submission = {
    competitor: 'CarMax',
    competitorOfferAmount: 18000,
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    trim: null,
  };
  const message = formatCounterOfferMessage({ submission, recommendedCounterOffer: 18450, link: 'https://example.test/confirm' });

  assert.equal(
    message,
    'Car Offer Beaters: We reviewed your CarMax offer of $18,000 for your 2021 Honda Civic. ' +
      'We can give you $18,450 today! Tap here to confirm: https://example.test/confirm',
  );
});

test('formatCounterOfferMessage labels an Other competitor with the dealer name', () => {
  const submission = {
    competitor: 'Other',
    competitorDealerName: 'Hendrick Motors',
    competitorOfferAmount: 18000,
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    trim: null,
  };
  const message = formatCounterOfferMessage({ submission, recommendedCounterOffer: 18450 });
  assert.match(message, /Hendrick Motors offer/);
});

test('buildApprovalNotification names the CarBoyZ distro group and the submission id', () => {
  const submission = {
    id: 'sub-1',
    competitor: 'CarMax',
    competitorOfferAmount: 24000,
    year: 2022,
    make: 'Toyota',
    model: 'Camry',
    trim: null,
  };
  const notification = buildApprovalNotification({ submission, recommendedCounterOffer: 24500 });

  assert.equal(notification.target, 'CarBoyZ distro group');
  assert.equal(notification.submissionId, 'sub-1');
  assert.match(notification.title, /\$24,000 Lead requires counter-offer sign-off/);
  assert.match(notification.body, /2022 Toyota Camry/);
});
