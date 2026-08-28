import { DISPATCH_OUTCOMES } from '../services/DispatchService.js';

export class SellerSubmissionController {
  constructor({ submissionService, hapticsService, dispatchService = null, sessionStashService = null } = {}) {
    if (!submissionService) {
      throw new Error('SellerSubmissionController requires a submissionService');
    }

    this.submissionService = submissionService;
    this.hapticsService = hapticsService ?? null;
    this.dispatchService = dispatchService;
    this.sessionStashService = sessionStashService;
  }

  submitSubmission(data) {
    const submission = this.submissionService.submit(data);
    this.hapticsService?.vibrate?.();
    const dispatchResult = this.dispatchService?.dispatch?.(submission);

    let pendingSessionId = null;
    if (dispatchResult?.outcome === DISPATCH_OUTCOMES.PENDING_APPROVAL && this.sessionStashService) {
      pendingSessionId = this.sessionStashService.createPending(submission.id);
    }

    return { submission, pendingSessionId };
  }
}
