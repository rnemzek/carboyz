import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConsoleSmsAdapter,
  TwilioSmsAdapter,
  createSmsAdapterFromEnv,
  formatPendingApprovalSms,
  formatEscalationSms,
  formatMorningDigestSms,
  NotificationService,
} from '../src/services/NotificationService.js';
import { TEAM_MEMBER_ROLES } from '../src/services/DealerProfileService.js';

function baseSubmission(overrides = {}) {
  return {
    id: 't1-sub-9',
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    ...overrides,
  };
}

function fakeDealerProfileService(members) {
  return { listMembers: () => members };
}

function fakeSmsAdapter() {
  const calls = [];
  return {
    calls,
    sendSms: (payload) => {
      calls.push(payload);
      return { success: true, provider: 'fake', ...payload };
    },
  };
}

test('ConsoleSmsAdapter.sendSms logs the payload and reports success', () => {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const result = new ConsoleSmsAdapter().sendSms({ to: '(555) 123-4567', body: 'hello' });
    assert.equal(result.success, true);
    assert.equal(result.provider, 'console');
    assert.equal(logs.length, 1);
    assert.match(logs[0], /\(555\) 123-4567/);
    assert.match(logs[0], /hello/);
  } finally {
    console.log = originalLog;
  }
});

test('TwilioSmsAdapter requires accountSid, authToken, and fromNumber', () => {
  assert.throws(() => new TwilioSmsAdapter({}), /accountSid/);
  assert.throws(() => new TwilioSmsAdapter({ accountSid: 'AC1', authToken: 'tok' }), /fromNumber/);
});

test('TwilioSmsAdapter.sendSms posts to the Twilio REST API with Basic Auth and form-encoded body', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true };
  };
  const adapter = new TwilioSmsAdapter({
    accountSid: 'AC123',
    authToken: 'secret-token',
    fromNumber: '+15550100100',
    fetchImpl,
  });

  const result = await adapter.sendSms({ to: '+15559876543', body: 'Lead alert' });

  assert.equal(result.success, true);
  assert.equal(result.provider, 'twilio');
  assert.equal(requests.length, 1);
  const { url, init } = requests[0];
  assert.equal(url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, `Basic ${Buffer.from('AC123:secret-token').toString('base64')}`);
  const body = new URLSearchParams(init.body.toString());
  assert.equal(body.get('To'), '+15559876543');
  assert.equal(body.get('From'), '+15550100100');
  assert.equal(body.get('Body'), 'Lead alert');
});

test('createSmsAdapterFromEnv falls back to ConsoleSmsAdapter when Twilio env vars are absent', () => {
  assert.ok(createSmsAdapterFromEnv({}) instanceof ConsoleSmsAdapter);
  assert.ok(createSmsAdapterFromEnv({ TWILIO_ACCOUNT_SID: 'AC1' }) instanceof ConsoleSmsAdapter);
});

test('createSmsAdapterFromEnv returns a configured TwilioSmsAdapter when all three env vars are set', () => {
  const adapter = createSmsAdapterFromEnv({
    TWILIO_ACCOUNT_SID: 'AC1',
    TWILIO_AUTH_TOKEN: 'tok',
    TWILIO_FROM_NUMBER: '+15550100100',
  });
  assert.ok(adapter instanceof TwilioSmsAdapter);
  assert.equal(adapter.accountSid, 'AC1');
  assert.equal(adapter.fromNumber, '+15550100100');
});

test('formatPendingApprovalSms matches the required alert template', () => {
  const message = formatPendingApprovalSms({
    submission: baseSubmission(),
    host: 'https://dealer.carboyz.app',
  });
  assert.equal(
    message,
    '🔥 CarBoyZ Lead Alert: 2021 Honda Civic (Comp: CarMax $15,000). ' +
      'Review pending counter at: https://dealer.carboyz.app/dealer?sub=t1-sub-9',
  );
});

test('formatPendingApprovalSms labels an Other competitor with the dealer name', () => {
  const message = formatPendingApprovalSms({
    submission: baseSubmission({ competitor: 'Other', competitorDealerName: 'Hendrick Motors' }),
  });
  assert.match(message, /Comp: Hendrick Motors/);
});

test('NotificationService requires a dealerProfileService', () => {
  assert.throws(() => new NotificationService({}), /dealerProfileService/);
});

test('notifyPendingApproval dispatches SMS strictly to roster members with notifyOnPending: true', () => {
  const members = [
    { id: 'm1', name: 'Front Desk', phone: '(910) 555-0128', notifyOnPending: true },
    { id: 'm2', name: 'Opted Out Rep', phone: '(910) 555-0199', notifyOnPending: false },
    { id: 'm3', name: 'Sales Rep', phone: '(910) 555-0150', notifyOnPending: true },
  ];
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService(members),
    smsAdapter,
    host: 'https://dealer.carboyz.app',
  });

  notificationService.notifyPendingApproval({ submission: baseSubmission() });

  assert.equal(smsAdapter.calls.length, 2);
  assert.deepEqual(smsAdapter.calls.map((c) => c.to), ['(910) 555-0128', '(910) 555-0150']);
  assert.match(smsAdapter.calls[0].body, /CarBoyZ Lead Alert/);
  assert.match(smsAdapter.calls[0].body, /dealer\?sub=t1-sub-9/);
});

test('notifyPendingApproval sends nothing when no roster member has notifyOnPending: true', () => {
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService([{ id: 'm1', phone: '555', notifyOnPending: false }]),
    smsAdapter,
  });

  notificationService.notifyPendingApproval({ submission: baseSubmission() });

  assert.equal(smsAdapter.calls.length, 0);
});

test('notify(notification) delegates to notifyPendingApproval when a submission is present', () => {
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService([{ id: 'm1', phone: '555', notifyOnPending: true }]),
    smsAdapter,
  });

  notificationService.notify({ submission: baseSubmission() });

  assert.equal(smsAdapter.calls.length, 1);
});

test('notify(notification) is a no-op when the notification carries no submission', () => {
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService([{ id: 'm1', phone: '555', notifyOnPending: true }]),
    smsAdapter,
  });

  assert.deepEqual(notificationService.notify({}), []);
  assert.equal(smsAdapter.calls.length, 0);
});

test('formatEscalationSms matches the required alert template', () => {
  const message = formatEscalationSms({
    submission: baseSubmission(),
    elapsedMinutes: 22,
    host: 'https://dealer.carboyz.app',
  });
  assert.equal(
    message,
    '⚠️ Escalation: Lead #t1-sub-9 (2021 Honda Civic) waiting 22m without review. ' +
      'Review now: https://dealer.carboyz.app/dealer?sub=t1-sub-9',
  );
});

test('formatMorningDigestSms matches the required rollup template', () => {
  const message = formatMorningDigestSms({ count: 3, host: 'https://dealer.carboyz.app' });
  assert.equal(
    message,
    '🌅 Good morning CarBoyZ desk: 3 customer offer(s) arrived overnight waiting for review: ' +
      'https://dealer.carboyz.app/dealer',
  );
});

test('notifyEscalation dispatches SMS strictly to roster members with notifyOnPending: true', () => {
  const members = [
    { id: 'm1', phone: '(910) 555-0128', notifyOnPending: true },
    { id: 'm2', phone: '(910) 555-0199', notifyOnPending: false },
  ];
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService(members),
    smsAdapter,
    host: 'https://dealer.carboyz.app',
  });

  notificationService.notifyEscalation({ submission: baseSubmission(), elapsedMinutes: 16 });

  assert.equal(smsAdapter.calls.length, 1);
  assert.equal(smsAdapter.calls[0].to, '(910) 555-0128');
  assert.match(smsAdapter.calls[0].body, /Escalation/);
});

test('notifyMorningDigest dispatches a single rollup SMS strictly to MANAGER-role roster members', () => {
  const members = [
    { id: 'm1', phone: '(910) 555-0128', role: TEAM_MEMBER_ROLES.MANAGER, notifyOnPending: true },
    { id: 'm2', phone: '(910) 555-0150', role: TEAM_MEMBER_ROLES.SALES_REP, notifyOnPending: true },
  ];
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService(members),
    smsAdapter,
    host: 'https://dealer.carboyz.app',
  });

  notificationService.notifyMorningDigest({ count: 4 });

  assert.equal(smsAdapter.calls.length, 1);
  assert.equal(smsAdapter.calls[0].to, '(910) 555-0128');
  assert.match(smsAdapter.calls[0].body, /4 customer offer/);
});
