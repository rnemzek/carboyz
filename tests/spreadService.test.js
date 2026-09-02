import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpread, DealScoreStatus, WHOLESALE_FACTOR, DEFAULT_COUNTER_OFFSET } from '../src/services/SpreadService.js';

test('calculateSpread requires a non-negative numeric competitorOfferAmount', () => {
  assert.throws(
    () => calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: -1 }),
    /competitorOfferAmount/,
  );
  assert.throws(
    () => calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 'nope' }),
    /competitorOfferAmount/,
  );
  assert.throws(() => calculateSpread({ fairMarketValue: 20000 }), /competitorOfferAmount/);
});

test('applies the 0.88 wholesale factor to fair market value', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000 });
  assert.equal(result.estimatedWholesaleValue, 20000 * WHOLESALE_FACTOR);
});

test('recommended counter offer defaults to competitor offer + $300', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000 });
  assert.equal(result.recommendedCounterOffer, 15000 + DEFAULT_COUNTER_OFFSET);
});

test('counterOfferOffset is configurable', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, counterOfferOffset: 500 });
  assert.equal(result.recommendedCounterOffer, 15500);
});

test('spread exactly $1,000 scores GREENLIGHT', () => {
  // estimatedWholesaleValue = 20000 * 0.88 = 17600; spread = 17600 - 16600 = 1000
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 16600 });
  assert.equal(result.spread, 1000);
  assert.equal(result.status, DealScoreStatus.GREENLIGHT);
});

test('spread just below $1,000 scores MARGINAL', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 16601 });
  assert.equal(result.spread, 999);
  assert.equal(result.status, DealScoreStatus.MARGINAL);
});

test('spread exactly $300 scores MARGINAL', () => {
  // estimatedWholesaleValue = 17600; spread = 17600 - 17300 = 300
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 17300 });
  assert.equal(result.spread, 300);
  assert.equal(result.status, DealScoreStatus.MARGINAL);
});

test('spread just below $300 scores PASS', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 17301 });
  assert.equal(result.spread, 299);
  assert.equal(result.status, DealScoreStatus.PASS);
});

test('negative spread (competitor offer beats wholesale value) scores PASS', () => {
  const result = calculateSpread({ fairMarketValue: 10000, competitorOfferAmount: 15000 });
  assert.ok(result.spread < 0);
  assert.equal(result.status, DealScoreStatus.PASS);
});

test('missing fairMarketValue returns NO_DATA but still computes a recommended counter offer', () => {
  const result = calculateSpread({ competitorOfferAmount: 15000 });
  assert.equal(result.estimatedWholesaleValue, null);
  assert.equal(result.spread, null);
  assert.equal(result.status, DealScoreStatus.NO_DATA);
  assert.equal(result.recommendedCounterOffer, 15300);
});

test('null or non-positive fairMarketValue returns NO_DATA', () => {
  assert.equal(
    calculateSpread({ fairMarketValue: null, competitorOfferAmount: 15000 }).status,
    DealScoreStatus.NO_DATA,
  );
  assert.equal(
    calculateSpread({ fairMarketValue: 0, competitorOfferAmount: 15000 }).status,
    DealScoreStatus.NO_DATA,
  );
  assert.equal(
    calculateSpread({ fairMarketValue: -500, competitorOfferAmount: 15000 }).status,
    DealScoreStatus.NO_DATA,
  );
});

test('tierConfig matches the bracket containing the exact minPrice boundary', () => {
  const tierConfig = [
    { minPrice: 0, maxPrice: 10000, flatAmount: 100, percent: 0, strategy: 'FLAT_ONLY' },
    { minPrice: 10000, maxPrice: null, flatAmount: 200, percent: 0, strategy: 'FLAT_ONLY' },
  ];
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 10000, tierConfig });
  assert.equal(result.recommendedCounterOffer, 10200);
});

test('tierConfig rolls a value at the maxPrice boundary into the next bracket', () => {
  const tierConfig = [
    { minPrice: 0, maxPrice: 10000, flatAmount: 100, percent: 0, strategy: 'FLAT_ONLY' },
    { minPrice: 10000, maxPrice: null, flatAmount: 200, percent: 0, strategy: 'FLAT_ONLY' },
  ];
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 9999, tierConfig });
  assert.equal(result.recommendedCounterOffer, 10099);
});

test('MAX strategy picks the larger of flat and percent-of-offer', () => {
  const tierConfig = [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.1, strategy: 'MAX' }];
  // flat = 300, percent = 15000 * 0.1 = 1500 -> MAX picks 1500
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig });
  assert.equal(result.recommendedCounterOffer, 16500);
});

test('FLAT_ONLY strategy ignores the percent amount', () => {
  const tierConfig = [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.5, strategy: 'FLAT_ONLY' }];
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig });
  assert.equal(result.recommendedCounterOffer, 15300);
});

test('PERCENT_ONLY strategy ignores the flat amount', () => {
  const tierConfig = [{ minPrice: 0, maxPrice: null, flatAmount: 5000, percent: 0.02, strategy: 'PERCENT_ONLY' }];
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig });
  assert.equal(result.recommendedCounterOffer, 15300);
});

test('a tierConfig with no bracket covering the offer amount falls back to the flat counterOfferOffset', () => {
  const tierConfig = [{ minPrice: 20000, maxPrice: null, flatAmount: 999, percent: 0, strategy: 'FLAT_ONLY' }];
  const result = calculateSpread({
    fairMarketValue: 20000,
    competitorOfferAmount: 15000,
    tierConfig,
    counterOfferOffset: 300,
  });
  assert.equal(result.recommendedCounterOffer, 15300);
});

test('an empty tierConfig array falls back to the flat counterOfferOffset', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig: [] });
  assert.equal(result.recommendedCounterOffer, 15300);
});

test('matchedTier is null when no tierConfig is provided', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000 });
  assert.equal(result.matchedTier, null);
});

test('matchedTier is null when tierConfig has no bracket covering the offer amount', () => {
  const tierConfig = [{ minPrice: 20000, maxPrice: null, flatAmount: 999, percent: 0, strategy: 'FLAT_ONLY' }];
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig });
  assert.equal(result.matchedTier, null);
});

test('matchedTier is the matched tier object, including autoApprove, when a bracket matches', () => {
  const tier = { minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02, strategy: 'MAX', autoApprove: true };
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, tierConfig: [tier] });
  assert.deepEqual(result.matchedTier, tier);
});

test('matchedTier is populated even when fairMarketValue is missing (NO_DATA)', () => {
  const tier = { minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02, strategy: 'MAX', autoApprove: false };
  const result = calculateSpread({ competitorOfferAmount: 15000, tierConfig: [tier] });
  assert.equal(result.status, DealScoreStatus.NO_DATA);
  assert.deepEqual(result.matchedTier, tier);
});

test('policyVersionId defaults to null when not provided', () => {
  const result = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000 });
  assert.equal(result.policyVersionId, null);
});

test('policyVersionId is echoed back on the result, including the NO_DATA path', () => {
  const priced = calculateSpread({ fairMarketValue: 20000, competitorOfferAmount: 15000, policyVersionId: 'v1.2.0' });
  assert.equal(priced.policyVersionId, 'v1.2.0');

  const noData = calculateSpread({ competitorOfferAmount: 15000, policyVersionId: 'v1.2.0' });
  assert.equal(noData.policyVersionId, 'v1.2.0');
});
