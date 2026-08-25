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

export function calculateSpread({
  fairMarketValue,
  competitorOfferAmount,
  counterOfferOffset = DEFAULT_COUNTER_OFFSET,
} = {}) {
  if (typeof competitorOfferAmount !== 'number' || competitorOfferAmount < 0) {
    throw new Error('calculateSpread requires a non-negative numeric competitorOfferAmount');
  }

  const recommendedCounterOffer = competitorOfferAmount + counterOfferOffset;

  if (typeof fairMarketValue !== 'number' || fairMarketValue <= 0) {
    return {
      estimatedWholesaleValue: null,
      spread: null,
      recommendedCounterOffer,
      status: DealScoreStatus.NO_DATA,
    };
  }

  const estimatedWholesaleValue = fairMarketValue * WHOLESALE_FACTOR;
  const spread = estimatedWholesaleValue - competitorOfferAmount;

  return {
    estimatedWholesaleValue,
    spread,
    recommendedCounterOffer,
    status: scoreSpread(spread),
  };
}
