export class SellerSubmissionController {
  constructor({ submissionService, hapticsService } = {}) {
    if (!submissionService) {
      throw new Error('SellerSubmissionController requires a submissionService');
    }

    this.submissionService = submissionService;
    this.hapticsService = hapticsService ?? null;
  }

  submitSubmission(data) {
    const submission = this.submissionService.submit(data);
    this.hapticsService?.vibrate?.();
    return submission;
  }
}
