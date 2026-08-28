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

  const { submission, pendingSessionId } = controller.submitSubmission(baseData());

  assert.equal(submission.vin, '1HGCM82633A004352');
  assert.equal(haptics.calls.length, 1);
  assert.equal(pendingSessionId, null);
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

  const { submission } = controller.submitSubmission(baseData());

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, submission.id);
});

test('submitSubmission works without a dispatchService configured', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const controller = new SellerSubmissionController({ submissionService });

  assert.doesNotThrow(() => controller.submitSubmission(baseData()));
});

test('submitSubmission stashes a pendingSessionId when dispatch requires manual sign-off', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const dispatchService = { dispatch: () => ({ outcome: 'PENDING_APPROVAL' }) };
  const stashCalls = [];
  const sessionStashService = {
    createPending: (submissionId) => {
      stashCalls.push(submissionId);
      return 'stash-123';
    },
  };
  const controller = new SellerSubmissionController({ submissionService, dispatchService, sessionStashService });

  const { submission, pendingSessionId } = controller.submitSubmission(baseData());

  assert.equal(stashCalls.length, 1);
  assert.equal(stashCalls[0], submission.id);
  assert.equal(pendingSessionId, 'stash-123');
});

test('submitSubmission does not stash a pendingSessionId on an auto-dispatch outcome', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const dispatchService = { dispatch: () => ({ outcome: 'AUTO_COUNTER_SENT' }) };
  const sessionStashService = {
    createPending: () => {
      throw new Error('should not be called for an auto-dispatch outcome');
    },
  };
  const controller = new SellerSubmissionController({ submissionService, dispatchService, sessionStashService });

  const { pendingSessionId } = controller.submitSubmission(baseData());

  assert.equal(pendingSessionId, null);
});

test('submitSubmission leaves pendingSessionId null without a sessionStashService configured, even on manual sign-off', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const dispatchService = { dispatch: () => ({ outcome: 'PENDING_APPROVAL' }) };
  const controller = new SellerSubmissionController({ submissionService, dispatchService });

  const { pendingSessionId } = controller.submitSubmission(baseData());

  assert.equal(pendingSessionId, null);
});
