import { COMPETITORS } from '../models/Submission.js';

export class SimulationController {
  constructor({ simulationService, spreadConfigService } = {}) {
    if (!simulationService) {
      throw new Error('SimulationController requires a simulationService');
    }
    if (!spreadConfigService) {
      throw new Error('SimulationController requires a spreadConfigService');
    }

    this.simulationService = simulationService;
    this.spreadConfigService = spreadConfigService;
  }

  getCompetitors() {
    return [...COMPETITORS];
  }

  /** Seeds the candidate editor with the currently active tier config, per competitor. */
  buildCandidateSeed() {
    const { tiersByCompetitor, policyVersionId } = this.spreadConfigService.getConfig();
    return {
      currentPolicyVersionId: policyVersionId,
      competitors: this.getCompetitors().map((competitor) => ({
        competitor,
        tiers: tiersByCompetitor[competitor] ?? [],
      })),
    };
  }

  runSimulation(tiersByCompetitor) {
    return this.simulationService.simulateCandidatePolicy({ tiersByCompetitor });
  }
}
