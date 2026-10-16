import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LeadEscalationService,
  startEscalationTicker,
  stopEscalationTicker,
  ESCALATION_TICK_INTERVAL_MS,
} from '../src/services/LeadEscalationService.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { DEFAULT_OPERATING_SCHEDULE } from '../src/config/tenantConfig.js';

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

function pendingSubmission(submissionService, overrides = {}) {
  const submission = submissionService.submit(baseSubmission(overrides));
  return submissionService.updateFields(submission.id, { status: 'PENDING_APPROVAL' });
}

function fakeNotificationService() {
  const escalationCalls = [];
  const digestCalls = [];
  return {
    escalationCalls,
    digestCalls,
    notifyEscalation: (payload) => escalationCalls.push(payload),
    notifyMorningDigest: (payload) => digestCalls.push(payload),
  };
}

function fakeTenantConfigService(schedule = DEFAULT_OPERATING_SCHEDULE) {
  return { getOperatingSchedule: () => schedule };
}

test('LeadEscalationService requires submissionService, notificationService, and tenantConfigService', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const notificationService = fakeNotificationService();
  const tenantConfigService = fakeTenantConfigService();

  assert.throws(() => new LeadEscalationService({ notificationService, tenantConfigService }), /submissionService/);
  assert.throws(() => new LeadEscalationService({ submissionService, tenantConfigService }), /notificationService/);
  assert.throws(() => new LeadEscalationService({ submissionService, notificationService }), /tenantConfigService/);
});

test('evaluatePendingLeads escalates a PENDING_APPROVAL lead past the nag interval during operating hours', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const submission = pendingSubmission(submissionService, { timestamp: '2026-01-15T12:30:00.000Z' });
  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluatePendingLeads({ now: new Date('2026-01-15T13:00:00.000Z') }); // 8:00 ET, 30m elapsed

  assert.equal(result.escalated.length, 1);
  assert.equal(result.escalated[0].id, submission.id);
  assert.equal(result.queued.length, 0);
  assert.equal(notificationService.escalationCalls.length, 1);
  assert.equal(notificationService.escalationCalls[0].elapsedMinutes, 30);
  const updated = submissionService.getSubmissions().find((s) => s.id === submission.id);
  assert.equal(updated.nagSentAt, '2026-01-15T13:00:00.000Z');
});

test('evaluatePendingLeads queues (instead of nagging) a PENDING_APPROVAL lead during quiet hours', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const submission = pendingSubmission(submissionService, { timestamp: '2026-01-15T04:00:00.000Z' });
  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluatePendingLeads({ now: new Date('2026-01-15T05:00:00.000Z') }); // 00:00 ET, 60m elapsed

  assert.equal(result.escalated.length, 0);
  assert.equal(result.queued.length, 1);
  assert.equal(notificationService.escalationCalls.length, 0);
  const updated = submissionService.getSubmissions().find((s) => s.id === submission.id);
  assert.equal(updated.queuedForMorningDigest, true);
  assert.equal(updated.nagSentAt, null);
});

test('evaluatePendingLeads ignores leads under the nag interval, already-nagged leads, and non-pending statuses', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  pendingSubmission(submissionService, { timestamp: '2026-01-15T12:50:00.000Z' }); // 10m elapsed, under 15m interval
  const alreadyNagged = pendingSubmission(submissionService, { timestamp: '2026-01-15T12:00:00.000Z' });
  submissionService.updateFields(alreadyNagged.id, { nagSentAt: '2026-01-15T12:20:00.000Z' });
  submissionService.submit(baseSubmission({ timestamp: '2026-01-15T12:00:00.000Z' })); // status NEW, not pending

  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluatePendingLeads({ now: new Date('2026-01-15T13:00:00.000Z') });

  assert.equal(result.escalated.length, 0);
  assert.equal(result.queued.length, 0);
  assert.equal(notificationService.escalationCalls.length, 0);
});

test('evaluateMorningDigest dispatches a rollup and clears the flag once operating hours resume', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const a = pendingSubmission(submissionService, { timestamp: '2026-01-15T04:00:00.000Z' });
  submissionService.updateFields(a.id, { queuedForMorningDigest: true });
  const b = pendingSubmission(submissionService, { timestamp: '2026-01-15T04:30:00.000Z' });
  submissionService.updateFields(b.id, { queuedForMorningDigest: true });

  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluateMorningDigest({ now: new Date('2026-01-15T13:00:00.000Z') }); // 8:00 ET, open

  assert.equal(result.dispatched, true);
  assert.equal(result.count, 2);
  assert.equal(notificationService.digestCalls.length, 1);
  assert.equal(notificationService.digestCalls[0].count, 2);
  for (const id of [a.id, b.id]) {
    const updated = submissionService.getSubmissions().find((s) => s.id === id);
    assert.equal(updated.queuedForMorningDigest, false);
    assert.equal(updated.digestSentAt, '2026-01-15T13:00:00.000Z');
  }
});

test('evaluateMorningDigest is a no-op during quiet hours even with leads queued', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const a = pendingSubmission(submissionService, { timestamp: '2026-01-15T04:00:00.000Z' });
  submissionService.updateFields(a.id, { queuedForMorningDigest: true });

  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluateMorningDigest({ now: new Date('2026-01-15T05:00:00.000Z') }); // 00:00 ET, closed

  assert.equal(result.dispatched, false);
  assert.equal(result.count, 0);
  assert.equal(notificationService.digestCalls.length, 0);
  const updated = submissionService.getSubmissions().find((s) => s.id === a.id);
  assert.equal(updated.queuedForMorningDigest, true);
});

test('evaluateMorningDigest is a no-op when nothing is queued', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const notificationService = fakeNotificationService();
  const service = new LeadEscalationService({
    submissionService,
    notificationService,
    tenantConfigService: fakeTenantConfigService(),
  });

  const result = service.evaluateMorningDigest({ now: new Date('2026-01-15T13:00:00.000Z') });

  assert.equal(result.dispatched, false);
  assert.equal(notificationService.digestCalls.length, 0);
});

// Escalation heartbeat (UOW-52): App.js's startEscalationTicker/stopEscalationTicker wiring.
test('startEscalationTicker ticks evaluatePendingLeads and evaluateMorningDigest on every interval', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  const calls = [];
  const service = {
    evaluatePendingLeads: (options) => calls.push(['pending', options.now]),
    evaluateMorningDigest: (options) => calls.push(['digest', options.now]),
  };
  const now = () => new Date('2026-01-15T13:00:00.000Z');

  const handle = startEscalationTicker(service, { intervalMs: 1000, now });
  assert.equal(calls.length, 0);

  t.mock.timers.tick(1000);
  assert.deepEqual(calls.map(([kind]) => kind), ['pending', 'digest']);

  t.mock.timers.tick(2000);
  assert.equal(calls.length, 6);

  stopEscalationTicker(handle);
});

test('startEscalationTicker defaults to a 60-second interval', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  let tickCount = 0;
  const service = {
    evaluatePendingLeads: () => {
      tickCount += 1;
    },
    evaluateMorningDigest: () => {},
  };

  const handle = startEscalationTicker(service);
  t.mock.timers.tick(ESCALATION_TICK_INTERVAL_MS - 1);
  assert.equal(tickCount, 0);

  t.mock.timers.tick(1);
  assert.equal(tickCount, 1);

  stopEscalationTicker(handle);
});

test('stopEscalationTicker clears the interval so no further ticks fire, and no-ops on a null handle', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  let tickCount = 0;
  const service = {
    evaluatePendingLeads: () => {
      tickCount += 1;
    },
    evaluateMorningDigest: () => {},
  };

  const handle = startEscalationTicker(service, { intervalMs: 1000 });
  t.mock.timers.tick(1000);
  assert.equal(tickCount, 1);

  stopEscalationTicker(handle);
  t.mock.timers.tick(5000);
  assert.equal(tickCount, 1);

  assert.doesNotThrow(() => stopEscalationTicker(null));
  assert.doesNotThrow(() => stopEscalationTicker(undefined));
});
