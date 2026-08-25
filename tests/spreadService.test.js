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
