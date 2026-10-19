import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConsoleSmsAdapter,
  TwilioSmsAdapter,
  FetchSmsAdapter,
  FetchEmailAdapter,
  createSmsAdapterFromEnv,
  formatPendingApprovalSms,
  formatEscalationSms,
  formatMorningDigestSms,
  formatPendingApprovalEmailSubject,
  formatPendingApprovalEmailHtml,
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

function fakeEmailAdapter() {
  const calls = [];
  return {
    calls,
    sendEmail: async (payload) => {
      calls.push(payload);
      return { success: true, provider: 'fake', id: 'fake-1' };
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

test('FetchSmsAdapter posts to the SMS relay endpoint and reports success with the returned messageId', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ success: true, messageId: 'msg-1' }) };
  };
  const adapter = new FetchSmsAdapter({ fetchImpl });

  const result = await adapter.sendSms({ to: '+15559876543', body: 'Lead alert' });

  assert.equal(result.success, true);
  assert.equal(result.messageId, 'msg-1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v1/notifications/sms');
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), { to: '+15559876543', message: 'Lead alert' });
});

test('FetchSmsAdapter warns and returns a failure when the relay responds with success: false', async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ success: false, error: 'no credentials' }) });
    const adapter = new FetchSmsAdapter({ fetchImpl });

    const result = await adapter.sendSms({ to: '+15559876543', body: 'Lead alert' });

    assert.equal(result.success, false);
    assert.equal(result.error, 'no credentials');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('FetchSmsAdapter warns and returns a failure instead of throwing when the network request itself fails', async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const fetchImpl = async () => {
      throw new Error('network down');
    };
    const adapter = new FetchSmsAdapter({ fetchImpl });

    const result = await adapter.sendSms({ to: '+15559876543', body: 'Lead alert' });

    assert.equal(result.success, false);
    assert.equal(result.error, 'network down');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('FetchEmailAdapter posts to the email relay endpoint and reports success with the returned id', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ success: true, id: 'resend-1' }) };
  };
  const adapter = new FetchEmailAdapter({ fetchImpl });

  const result = await adapter.sendEmail({ subject: 'New Lead', html: '<p>hi</p>' });

  assert.equal(result.success, true);
  assert.equal(result.id, 'resend-1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v1/notifications/email');
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), { subject: 'New Lead', html: '<p>hi</p>' });
});

test('FetchEmailAdapter warns and returns a failure when the relay responds with success: false', async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ success: false, error: 'RESEND_API_KEY missing' }) });
    const adapter = new FetchEmailAdapter({ fetchImpl });

    const result = await adapter.sendEmail({ subject: 'New Lead', html: '<p>hi</p>' });

    assert.equal(result.success, false);
    assert.equal(result.error, 'RESEND_API_KEY missing');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('FetchEmailAdapter warns and returns a failure instead of throwing when the network request itself fails', async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const fetchImpl = async () => {
      throw new Error('network down');
    };
    const adapter = new FetchEmailAdapter({ fetchImpl });

    const result = await adapter.sendEmail({ subject: 'New Lead', html: '<p>hi</p>' });

    assert.equal(result.success, false);
    assert.equal(result.error, 'network down');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
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

test('formatPendingApprovalEmailSubject matches the required subject template', () => {
  assert.equal(
    formatPendingApprovalEmailSubject({ submission: baseSubmission() }),
    'New $15,000 Lead: 2021 Honda Civic',
  );
});

test('formatPendingApprovalEmailHtml includes VIN, vehicle, mileage, counter, and a /dealer link', () => {
  const html = formatPendingApprovalEmailHtml({
    submission: baseSubmission({ vin: '1HGCM82633A123456', mileage: 42000 }),
    recommendedCounterOffer: 15500,
    host: 'https://dealer.carboyz.app',
  });

  assert.match(html, /1HGCM82633A123456/);
  assert.match(html, /2021 Honda Civic/);
  assert.match(html, /42,000/);
  assert.match(html, /\$15,500/);
  assert.match(html, /CarMax \$15,000/);
  assert.match(html, /https:\/\/dealer\.carboyz\.app\/dealer\?sub=t1-sub-9/);
});

test('formatPendingApprovalEmailHtml falls back to "Pending review" when no counter is recommended yet', () => {
  const html = formatPendingApprovalEmailHtml({ submission: baseSubmission() });
  assert.match(html, /Pending review/);
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
  assert.deepEqual(smsAdapter.calls.map((c) => c.to), ['+19105550128', '+19105550150']);
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
    dealerProfileService: fakeDealerProfileService([{ id: 'm1', phone: '(910) 555-0128', notifyOnPending: true }]),
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

test('notifyPendingApprovalEmail is a no-op when no emailAdapter is configured', () => {
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService([]),
    smsAdapter: fakeSmsAdapter(),
  });

  assert.equal(notificationService.notifyPendingApprovalEmail({ submission: baseSubmission() }), null);
});

test('notify(notification) fires the dealer alert email once, concurrently with the SMS fan-out', async () => {
  const members = [
    { id: 'm1', phone: '(910) 555-0128', notifyOnPending: true },
    { id: 'm2', phone: '(910) 555-0150', notifyOnPending: true },
  ];
  const smsAdapter = fakeSmsAdapter();
  const emailAdapter = fakeEmailAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService(members),
    smsAdapter,
    emailAdapter,
    host: 'https://dealer.carboyz.app',
  });

  const settled = await notificationService.notify({
    submission: baseSubmission(),
    recommendedCounterOffer: 15500,
  });

  assert.equal(smsAdapter.calls.length, 2);
  assert.equal(emailAdapter.calls.length, 1);
  assert.match(emailAdapter.calls[0].subject, /New \$15,000 Lead/);
  assert.match(emailAdapter.calls[0].html, /\$15,500/);
  assert.ok(Array.isArray(settled));
  assert.ok(settled.every((entry) => entry.status === 'fulfilled'));
});

test('notify(notification) still returns the plain SMS results array when no emailAdapter is configured', () => {
  const smsAdapter = fakeSmsAdapter();
  const notificationService = new NotificationService({
    dealerProfileService: fakeDealerProfileService([{ id: 'm1', phone: '(910) 555-0128', notifyOnPending: true }]),
    smsAdapter,
  });

  const result = notificationService.notify({ submission: baseSubmission() });

  assert.equal(smsAdapter.calls.length, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].success, true);
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
  assert.equal(smsAdapter.calls[0].to, '+19105550128');
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
  assert.equal(smsAdapter.calls[0].to, '+19105550128');
  assert.match(smsAdapter.calls[0].body, /4 customer offer/);
});

test('notifyPendingApproval skips a roster member with an unformattable phone instead of throwing', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const members = [
      { id: 'm1', name: 'Bad Record', phone: '555', notifyOnPending: true },
      { id: 'm2', name: 'Front Desk', phone: '(910) 555-0128', notifyOnPending: true },
    ];
    const smsAdapter = fakeSmsAdapter();
    const notificationService = new NotificationService({
      dealerProfileService: fakeDealerProfileService(members),
      smsAdapter,
    });

    const results = notificationService.notifyPendingApproval({ submission: baseSubmission() });

    assert.equal(smsAdapter.calls.length, 1);
    assert.equal(smsAdapter.calls[0].to, '+19105550128');
    assert.equal(results[0].success, false);
    assert.equal(results[1].success, true);
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});
