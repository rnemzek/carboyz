import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SellerSubmissionController } from '../src/ui/SellerSubmissionController.js';

function makeHapticsSpy() {
  const calls = [];
  return { calls, vibrate: (pattern) => calls.push(pattern ?? 'default') };
}

function baseData(overrides = {}) {
  return {
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    mileage: 30000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 18000,
    ...overrides,
  };
}

test('SellerSubmissionController requires a submissionService', () => {
  assert.throws(() => new SellerSubmissionController({}), /submissionService/);
});

test('submitSubmission submits and triggers haptics on success', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const haptics = makeHapticsSpy();
  const controller = new SellerSubmissionController({ submissionService, hapticsService: haptics });

  const submission = controller.submitSubmission(baseData());

  assert.equal(submission.vin, '1HGCM82633A004352');
  assert.equal(haptics.calls.length, 1);
});

test('submitSubmission works without a hapticsService configured', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const controller = new SellerSubmissionController({ submissionService });

  assert.doesNotThrow(() => controller.submitSubmission(baseData()));
});

test('submitSubmission does not trigger haptics when the submission is invalid', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const haptics = makeHapticsSpy();
  const controller = new SellerSubmissionController({ submissionService, hapticsService: haptics });

  assert.throws(() => controller.submitSubmission(baseData({ competitor: 'NotReal' })));
  assert.equal(haptics.calls.length, 0);
});

test('submitSubmission dispatches the created submission when a dispatchService is configured', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const calls = [];
  const dispatchService = { dispatch: (submission) => calls.push(submission) };
  const controller = new SellerSubmissionController({ submissionService, dispatchService });

  const submission = controller.submitSubmission(baseData());

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, submission.id);
});

test('submitSubmission works without a dispatchService configured', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const controller = new SellerSubmissionController({ submissionService });

  assert.doesNotThrow(() => controller.submitSubmission(baseData()));
});
