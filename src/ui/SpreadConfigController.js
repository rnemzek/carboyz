import { COMPETITORS } from '../models/Submission.js';

export class SpreadConfigController {
  constructor({ spreadConfigService } = {}) {
    if (!spreadConfigService) {
      throw new Error('SpreadConfigController requires a spreadConfigService');
    }

    this.spreadConfigService = spreadConfigService;
  }

  getCompetitors() {
    return [...COMPETITORS];
  }

  buildViewModel() {
    return {
      competitors: this.getCompetitors().map((competitor) => ({
        competitor,
        tiers: this.spreadConfigService.getTiersForCompetitor(competitor),
      })),
    };
  }

  saveTiers(tiersByCompetitor) {
    return this.spreadConfigService.saveConfig({ tiersByCompetitor });
  }

  resetToDefault() {
    return this.spreadConfigService.resetToDefault();
  }
}
