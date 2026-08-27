export class SellerSubmissionController {
  constructor({ submissionService, hapticsService, dispatchService = null } = {}) {
    if (!submissionService) {
      throw new Error('SellerSubmissionController requires a submissionService');
    }

    this.submissionService = submissionService;
    this.hapticsService = hapticsService ?? null;
    this.dispatchService = dispatchService;
  }

  submitSubmission(data) {
    const submission = this.submissionService.submit(data);
    this.hapticsService?.vibrate?.();
    this.dispatchService?.dispatch?.(submission);
    return submission;
  }
}
