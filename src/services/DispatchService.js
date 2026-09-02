import { calculateSpread, DealScoreStatus } from './SpreadService.js';

export const DISPATCH_OUTCOMES = Object.freeze({
  AUTO_COUNTER_SENT: 'AUTO_COUNTER_SENT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
});

const DISTRO_GROUP = 'CarBoyZ distro group';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function vehicleTitle(submission) {
  return [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(' ');
}

function competitorLabel(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return submission.competitorDealerName;
  }
  return submission.competitor;
}

export function formatCounterOfferMessage({ submission, recommendedCounterOffer, link = '#' }) {
  return (
    `Car Offer Beaters: We reviewed your ${competitorLabel(submission)} offer of ` +
    `${currencyFormatter.format(submission.competitorOfferAmount)} for your ${vehicleTitle(submission)}. ` +
    `We can give you ${currencyFormatter.format(recommendedCounterOffer)} today! Tap here to confirm: ${link}`
  );
}

export function formatPriceBracket(tier) {
  if (!tier) {
    return null;
  }
  const min = currencyFormatter.format(tier.minPrice);
  if (tier.maxPrice === null) {
    return `${min}+`;
  }
  return `${min}-${currencyFormatter.format(tier.maxPrice)}`;
}

export function buildApprovalNotification({ submission, recommendedCounterOffer }) {
  return {
    target: DISTRO_GROUP,
    title: `New ${currencyFormatter.format(submission.competitorOfferAmount)} Lead requires counter-offer sign-off`,
    body: `${vehicleTitle(submission)} — recommended counter ${currencyFormatter.format(recommendedCounterOffer)}`,
    submissionId: submission.id,
  };
}

export class DispatchService {
  constructor({ submissionService, spreadConfigService, telemetryService, ingestService, notifier = null } = {}) {
    if (!submissionService) {
      throw new Error('DispatchService requires a submissionService');
    }
    if (!spreadConfigService) {
      throw new Error('DispatchService requires a spreadConfigService');
    }
    if (!telemetryService) {
      throw new Error('DispatchService requires a telemetryService');
    }
    if (!ingestService) {
      throw new Error('DispatchService requires an ingestService');
    }

    this.submissionService = submissionService;
    this.spreadConfigService = spreadConfigService;
    this.telemetryService = telemetryService;
    this.ingestService = ingestService;
    this.notifier = notifier;
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

  evaluate(submission) {
    const fairMarketValue = this.resolveFairMarketValue(submission);
    const tierConfig = this.spreadConfigService.getTiersForCompetitor(submission.competitor);
    const spreadResult = calculateSpread({
      fairMarketValue,
      competitorOfferAmount: submission.competitorOfferAmount,
      tierConfig,
      policyVersionId: this.spreadConfigService.getActivePolicyVersionId(),
    });
    const autoApprove = spreadResult.matchedTier?.autoApprove ?? false;
    const shouldAutoDispatch = autoApprove && spreadResult.status === DealScoreStatus.GREENLIGHT;

    return { spreadResult, autoApprove, shouldAutoDispatch };
  }

  dispatch(submission) {
    const { spreadResult, shouldAutoDispatch } = this.evaluate(submission);
    const calculatedCounterOffer = spreadResult.recommendedCounterOffer;
    const expectedMargin =
      spreadResult.estimatedWholesaleValue === null
        ? null
        : spreadResult.estimatedWholesaleValue - calculatedCounterOffer;
    const priceBracket = formatPriceBracket(spreadResult.matchedTier);
    const initialCompetitorOffer = submission.initialCompetitorOffer ?? submission.competitorOfferAmount;

    if (shouldAutoDispatch) {
      // This IS the counter dispatch — speed-to-lead is measured from intake to right now.
      const timeToCounterMs = Date.now() - new Date(submission.timestamp).getTime();
      const updated = this.submissionService.updateFields(submission.id, {
        status: 'AUTO_COUNTER_SENT',
        winLossStatus: 'AUTO_COUNTERED',
        initialCompetitorOffer,
        calculatedCounterOffer,
        finalCounterOffer: calculatedCounterOffer,
        expectedMargin,
        priceBracket,
        approvalType: 'AUTO_DISPATCH',
        timeToCounterMs,
        policyVersionId: spreadResult.policyVersionId,
      });
      const message = formatCounterOfferMessage({
        submission: updated,
        recommendedCounterOffer: spreadResult.recommendedCounterOffer,
      });
      return { outcome: DISPATCH_OUTCOMES.AUTO_COUNTER_SENT, submission: updated, spreadResult, message };
    }

    // Manual path: nothing has actually been sent to the seller yet, so timeToCounterMs
    // and approvalType stay null until LeadInboxController.approveAndSend() dispatches it.
    const updated = this.submissionService.updateFields(submission.id, {
      status: 'PENDING_APPROVAL',
      winLossStatus: 'PENDING',
      initialCompetitorOffer,
      calculatedCounterOffer,
      finalCounterOffer: calculatedCounterOffer,
      expectedMargin,
      priceBracket,
      policyVersionId: spreadResult.policyVersionId,
    });
    const notification = buildApprovalNotification({
      submission: updated,
      recommendedCounterOffer: spreadResult.recommendedCounterOffer,
    });
    this.notifier?.notify?.(notification);
    return { outcome: DISPATCH_OUTCOMES.PENDING_APPROVAL, submission: updated, spreadResult, notification };
  }
}
