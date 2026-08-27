import { calculateSpread } from '../services/SpreadService.js';
import { formatCounterOfferMessage } from '../services/DispatchService.js';

function competitorLabel(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return `Other (${submission.competitorDealerName})`;
  }
  return submission.competitor;
}

export class LeadInboxController {
  constructor({ submissionService, telemetryService, ingestService, spreadConfigService = null } = {}) {
    if (!submissionService) {
      throw new Error('LeadInboxController requires a submissionService');
    }
    if (!telemetryService) {
      throw new Error('LeadInboxController requires a telemetryService');
    }
    if (!ingestService) {
      throw new Error('LeadInboxController requires an ingestService');
    }

    this.submissionService = submissionService;
    this.telemetryService = telemetryService;
    this.ingestService = ingestService;
    this.spreadConfigService = spreadConfigService;
  }

  resolveFairMarketValue(submission) {
    const inventory = this.ingestService.getInventory();
    const marketStats = this.telemetryService.getMarketStats(inventory, {
      make: submission.make,
      model: submission.model,
      year: submission.year,
    });
    return marketStats.average;
  }

  buildLeadViewModels() {
    return this.submissionService.getSubmissions().map((submission) => {
      const fairMarketValue = this.resolveFairMarketValue(submission);
      const tierConfig = this.spreadConfigService?.getTiersForCompetitor(submission.competitor);
      const spreadResult = calculateSpread({
        fairMarketValue,
        competitorOfferAmount: submission.competitorOfferAmount,
        tierConfig,
      });

      return {
        id: submission.id,
        vehicleTitle: [submission.year, submission.make, submission.model, submission.trim]
          .filter(Boolean)
          .join(' '),
        mileage: submission.mileage,
        zipCode: submission.zipCode,
        competitorLabel: competitorLabel(submission),
        competitorOfferAmount: submission.competitorOfferAmount,
        offerDocument: submission.offerDocument,
        status: submission.status,
        spreadResult,
        counterMessage: formatCounterOfferMessage({
          submission,
          recommendedCounterOffer: spreadResult.recommendedCounterOffer,
        }),
      };
    });
  }

  updateStatus(id, status) {
    return this.submissionService.updateStatus(id, status);
  }

  approveAndSend(id, counterOfferAmount) {
    const submission = this.submissionService.updateStatus(id, 'AUTO_COUNTER_SENT');
    const message = formatCounterOfferMessage({ submission, recommendedCounterOffer: counterOfferAmount });
    return { submission, message };
  }
}
