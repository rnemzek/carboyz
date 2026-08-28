import { calculateSpread } from '../services/SpreadService.js';
import { formatCounterOfferMessage } from '../services/DispatchService.js';

export const WIN_LOSS_QUICK_ACTIONS = ['WON', 'LOST'];

function competitorLabel(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return `Other (${submission.competitorDealerName})`;
  }
  return submission.competitor;
}

export class LeadInboxController {
  constructor({
    submissionService,
    telemetryService,
    ingestService,
    spreadConfigService = null,
    sessionStashService = null,
  } = {}) {
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
    this.sessionStashService = sessionStashService;
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
    const before = this.submissionService.getSubmissions().find((submission) => submission.id === id);
    if (!before) {
      throw new Error(`Submission not found: ${id}`);
    }

    const fairMarketValue = this.resolveFairMarketValue(before);
    const tierConfig = this.spreadConfigService?.getTiersForCompetitor(before.competitor);
    const spreadResult = calculateSpread({
      fairMarketValue,
      competitorOfferAmount: before.competitorOfferAmount,
      tierConfig,
    });
    const expectedMargin =
      spreadResult.estimatedWholesaleValue === null
        ? null
        : spreadResult.estimatedWholesaleValue - counterOfferAmount;
    const timeToCounterMs = Date.now() - new Date(before.timestamp).getTime();

    const submission = this.submissionService.updateFields(id, {
      status: 'AUTO_COUNTER_SENT',
      winLossStatus: 'MANUAL_APPROVED',
      finalCounterOffer: counterOfferAmount,
      expectedMargin,
      approvalType: 'HUMAN_APPROVED',
      timeToCounterMs,
    });
    const message = formatCounterOfferMessage({ submission, recommendedCounterOffer: counterOfferAmount });
    this.sessionStashService?.resolveBySubmissionId?.(id, { finalCounterOffer: counterOfferAmount });
    return { submission, message };
  }

  markWinLoss(id, winLossStatus) {
    if (!WIN_LOSS_QUICK_ACTIONS.includes(winLossStatus)) {
      throw new Error(`markWinLoss only supports ${WIN_LOSS_QUICK_ACTIONS.join(' or ')}, got: ${winLossStatus}`);
    }
    return this.submissionService.updateFields(id, { winLossStatus });
  }
}
