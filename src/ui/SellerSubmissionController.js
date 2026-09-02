import { DISPATCH_OUTCOMES } from '../services/DispatchService.js';

export class SellerSubmissionController {
  constructor({
    submissionService,
    hapticsService,
    dispatchService = null,
    sessionStashService = null,
    syncAdapter = null,
  } = {}) {
    if (!submissionService) {
      throw new Error('SellerSubmissionController requires a submissionService');
    }

    this.submissionService = submissionService;
    this.hapticsService = hapticsService ?? null;
    this.dispatchService = dispatchService;
    this.sessionStashService = sessionStashService;
    this.syncAdapter = syncAdapter;
  }

  submitSubmission(data) {
    const submission = this.submissionService.submit(data);
    this.hapticsService?.vibrate?.();
    const dispatchResult = this.dispatchService?.dispatch?.(submission);
    // Broadcast the post-dispatch submission (status/spread fields already resolved) so a
    // synced desktop inbox renders the correct PENDING_APPROVAL/AUTO_COUNTER_SENT actions
    // immediately, instead of a stale NEW-status lead with no follow-up sync event.
    this.syncAdapter?.submitSubmissionCreated?.({ ...(dispatchResult?.submission ?? submission) });

    let pendingSessionId = null;
    if (dispatchResult?.outcome === DISPATCH_OUTCOMES.PENDING_APPROVAL && this.sessionStashService) {
      pendingSessionId = this.sessionStashService.createPending(submission.id);
    }

    return { submission, pendingSessionId };
  }

  getSubmission(id) {
    return this.submissionService.getSubmissions().find((submission) => submission.id === id) ?? null;
  }

  /** Binds a scanned QR pairing session id to this mobile view via `SessionStashService`. */
  bindPairingSession(pairingSessionId) {
    if (!pairingSessionId) {
      return null;
    }
    return this.sessionStashService?.connectPairingSession?.(pairingSessionId) ?? null;
  }
}
