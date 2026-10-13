import { NO_VIN_ESTIMATE_BEAT_BUMP } from './SpreadConfigService.js';

export const WHOLESALE_FACTOR = 0.88;
export const DEFAULT_COUNTER_OFFSET = 300;

export const DealScoreStatus = Object.freeze({
  GREENLIGHT: 'GREENLIGHT',
  MARGINAL: 'MARGINAL',
  PASS: 'PASS',
  NO_DATA: 'NO_DATA',
});

function scoreSpread(spread) {
  if (spread >= 1000) {
    return DealScoreStatus.GREENLIGHT;
  }
  if (spread >= 300) {
    return DealScoreStatus.MARGINAL;
  }
  return DealScoreStatus.PASS;
}

function matchTier(tiers, amount) {
  return (tiers ?? []).find((tier) => amount >= tier.minPrice && (tier.maxPrice === null || amount < tier.maxPrice)) ?? null;
}

function evaluateTierOffset(tier, competitorOfferAmount) {
  const flatAmount = tier.flatAmount ?? 0;
  const percentAmount = competitorOfferAmount * (tier.percent ?? 0);

  if (tier.strategy === 'FLAT_ONLY') {
    return flatAmount;
  }
  if (tier.strategy === 'PERCENT_ONLY') {
    return percentAmount;
  }
  return Math.max(flatAmount, percentAmount);
}

function resolveCounterOfferOffset({ competitorOfferAmount, tierConfig, fallbackOffset }) {
  const tier = matchTier(tierConfig, competitorOfferAmount);
  if (!tier) {
    return { counterOffset: fallbackOffset, matchedTier: null };
  }
  return { counterOffset: evaluateTierOffset(tier, competitorOfferAmount), matchedTier: tier };
}

export function calculateSpread({
  fairMarketValue,
  competitorOfferAmount,
  tierConfig,
  counterOfferOffset = DEFAULT_COUNTER_OFFSET,
  policyVersionId = null,
  offerSourceType = null,
  vin = null,
} = {}) {
  if (typeof competitorOfferAmount !== 'number' || competitorOfferAmount < 0) {
    throw new Error('calculateSpread requires a non-negative numeric competitorOfferAmount');
  }

  // No VIN yet on an ESTIMATE-sourced offer -> conditional, conservative bump, bypassing the
  // competitor/price tier ladder entirely. A VIN-verified estimate (or any FIRM_OFFER) falls
  // through to the normal tier-based resolution below, unchanged.
  const { counterOffset, matchedTier } =
    offerSourceType === 'ESTIMATE' && !vin
      ? { counterOffset: NO_VIN_ESTIMATE_BEAT_BUMP, matchedTier: null }
      : resolveCounterOfferOffset({
          competitorOfferAmount,
          tierConfig,
          fallbackOffset: counterOfferOffset,
        });
  const recommendedCounterOffer = competitorOfferAmount + counterOffset;

  if (typeof fairMarketValue !== 'number' || fairMarketValue <= 0) {
    return {
      estimatedWholesaleValue: null,
      spread: null,
      recommendedCounterOffer,
      status: DealScoreStatus.NO_DATA,
      matchedTier,
      policyVersionId,
    };
  }

  const estimatedWholesaleValue = fairMarketValue * WHOLESALE_FACTOR;
  const spread = estimatedWholesaleValue - competitorOfferAmount;

  return {
    estimatedWholesaleValue,
    spread,
    recommendedCounterOffer,
    status: scoreSpread(spread),
    matchedTier,
    policyVersionId,
  };
}
