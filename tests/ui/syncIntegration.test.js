import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncAdapter, SYNC_EVENTS } from '../../src/services/SyncAdapter.js';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { SellerSubmissionController } from '../../src/ui/SellerSubmissionController.js';
import { LeadInboxController } from '../../src/ui/LeadInboxController.js';
import { TelemetryService } from '../../src/services/TelemetryService.js';
import { IngestService } from '../../src/services/IngestService.js';
import { SpreadConfigService } from '../../src/services/SpreadConfigService.js';
import { DispatchService } from '../../src/services/DispatchService.js';

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

/**
 * A shared-bus fake BroadcastChannel: postMessage on one channel instance is
 * delivered to every *other* instance on the bus, matching real BroadcastChannel
 * semantics (a channel never receives its own posted messages) so two independently
 * constructed SyncAdapters can stand in for two separate devices/tabs.
 */
function makeSharedBroadcastBus() {
  const channels = [];
  function createChannel() {
    const listeners = [];
    const self = {
      listeners,
      addEventListener: (type, handler) => listeners.push(handler),
      removeEventListener: (type, handler) => {
        const index = listeners.indexOf(handler);
        if (index !== -1) listeners.splice(index, 1);
      },
      postMessage: (data) => {
        channels.forEach((other) => {
          if (other !== self) other.listeners.forEach((handler) => handler({ data }));
        });
      },
    };
    channels.push(self);
    return self;
  }
  return { createChannel };
}

function makeDesktopServices(tenantId) {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId });
  const submissionService = new SubmissionService({ tenantId });
  return { telemetryService, ingestService, submissionService };
}

test('a mobile intake submission reaches a desktop lead inbox through the SyncAdapter broadcast channel', () => {
  const bus = makeSharedBroadcastBus();
  const mobileSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  const desktopSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  mobileSync.connect();
  desktopSync.connect();

  const mobileSubmissionService = new SubmissionService({ tenantId: 't1' });
  const sellerController = new SellerSubmissionController({
    submissionService: mobileSubmissionService,
    syncAdapter: mobileSync,
  });

  const { submissionService: desktopSubmissionService, telemetryService, ingestService } = makeDesktopServices('t1');
  desktopSync.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => desktopSubmissionService.receiveExternalSubmission(payload));
  const leadInboxController = new LeadInboxController({
    submissionService: desktopSubmissionService,
    telemetryService,
    ingestService,
  });

  assert.equal(leadInboxController.buildLeadViewModels().length, 0);

  const { submission } = sellerController.submitSubmission(baseData());

  const leads = leadInboxController.buildLeadViewModels();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].id, submission.id);
  assert.equal(leads[0].vehicleTitle, '2020 Toyota Camry');
});

test('a submission for another tenant does not reach the desktop inbox', () => {
  const bus = makeSharedBroadcastBus();
  const mobileSync = new SyncAdapter({ tenantId: 't2', channel: bus.createChannel() });
  const desktopSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  mobileSync.connect();
  desktopSync.connect();

  const mobileSubmissionService = new SubmissionService({ tenantId: 't2' });
  const sellerController = new SellerSubmissionController({
    submissionService: mobileSubmissionService,
    syncAdapter: mobileSync,
  });

  const { submissionService: desktopSubmissionService } = makeDesktopServices('t1');
  desktopSync.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => desktopSubmissionService.receiveExternalSubmission(payload));

  sellerController.submitSubmission(baseData());

  assert.equal(desktopSubmissionService.getSubmissions().length, 0);
});

test('a submission already present locally (e.g. relayed twice) is not duplicated in the desktop inbox', () => {
  const bus = makeSharedBroadcastBus();
  const mobileSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  const desktopSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  mobileSync.connect();
  desktopSync.connect();

  const mobileSubmissionService = new SubmissionService({ tenantId: 't1' });
  const sellerController = new SellerSubmissionController({
    submissionService: mobileSubmissionService,
    syncAdapter: mobileSync,
  });

  const { submissionService: desktopSubmissionService } = makeDesktopServices('t1');
  let syncedCount = 0;
  desktopSync.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => {
    syncedCount += 1;
    desktopSubmissionService.receiveExternalSubmission(payload);
  });

  const { submission } = sellerController.submitSubmission(baseData());
  mobileSync.submitSubmissionCreated({ ...submission });

  assert.equal(syncedCount, 2);
  assert.equal(desktopSubmissionService.getSubmissions().length, 1);
});

test('intake submission still reaches the desktop inbox via the local BroadcastChannel while the socket relay has not connected yet', () => {
  class PendingWebSocket {
    send() {
      throw new Error('should not be called before the socket has opened');
    }
    close() {}
  }

  const bus = makeSharedBroadcastBus();
  const mobileSync = new SyncAdapter({
    tenantId: 't1',
    wsUrl: 'ws://relay.example',
    WebSocketClass: PendingWebSocket,
    channel: bus.createChannel(),
  });
  const desktopSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  mobileSync.connect();
  desktopSync.connect();

  assert.equal(mobileSync.mode, 'connecting');

  const mobileSubmissionService = new SubmissionService({ tenantId: 't1' });
  const sellerController = new SellerSubmissionController({
    submissionService: mobileSubmissionService,
    syncAdapter: mobileSync,
  });

  const { submissionService: desktopSubmissionService } = makeDesktopServices('t1');
  desktopSync.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => desktopSubmissionService.receiveExternalSubmission(payload));

  const { submission } = sellerController.submitSubmission(baseData());

  assert.equal(desktopSubmissionService.getSubmissions().length, 1);
  assert.equal(desktopSubmissionService.getSubmissions()[0].id, submission.id);

  mobileSync.socket.onerror(new Error('connection refused'));
  assert.equal(mobileSync.mode, 'broadcast');
});

test('the synced submission reflects the post-dispatch status, not the stale pre-dispatch NEW snapshot', () => {
  const bus = makeSharedBroadcastBus();
  const mobileSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  const desktopSync = new SyncAdapter({ tenantId: 't1', channel: bus.createChannel() });
  mobileSync.connect();
  desktopSync.connect();

  const mobileSubmissionService = new SubmissionService({ tenantId: 't1' });
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const dispatchService = new DispatchService({
    submissionService: mobileSubmissionService,
    spreadConfigService,
    telemetryService,
    ingestService,
  });
  const sellerController = new SellerSubmissionController({
    submissionService: mobileSubmissionService,
    dispatchService,
    syncAdapter: mobileSync,
  });

  const { submissionService: desktopSubmissionService } = makeDesktopServices('t1');
  desktopSync.on(SYNC_EVENTS.SUBMISSION_SYNCED, (payload) => desktopSubmissionService.receiveExternalSubmission(payload));

  const { submission } = sellerController.submitSubmission(baseData());
  const dispatched = mobileSubmissionService.getSubmissions().find((s) => s.id === submission.id);

  // No inventory comps registered, so DispatchService can't auto-approve and resolves to
  // the manual PENDING_APPROVAL path — the synced copy must carry that same resolved status,
  // not the stale pre-dispatch NEW snapshot submitSubmission() itself returns.
  assert.equal(dispatched.status, 'PENDING_APPROVAL');
  const [synced] = desktopSubmissionService.getSubmissions();
  assert.equal(synced.status, 'PENDING_APPROVAL');
  assert.equal(synced.calculatedCounterOffer, dispatched.calculatedCounterOffer);
});

test('submitSubmission is a safe no-op without a syncAdapter configured (desktop inbox stays empty until reload)', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const controller = new SellerSubmissionController({ submissionService });

  assert.doesNotThrow(() => controller.submitSubmission(baseData()));
});
