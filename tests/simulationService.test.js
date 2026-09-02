import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SimulationService, isSimulatable, simulateCandidatePolicy } from '../src/services/SimulationService.js';
import { DEFAULT_TIERS, TIER_STRATEGIES } from '../src/services/SpreadConfigService.js';

function baseSubmission(overrides = {}) {
  return {
    vin: '1HGCM82633A004352',
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    mileage: 25000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    ...overrides,
  };
}

function candidateConfig(overrides = {}) {
  return {
    tiersByCompetitor: {
      CarMax: DEFAULT_TIERS.map((tier) => ({ ...tier })),
      Carvana: DEFAULT_TIERS.map((tier) => ({ ...tier })),
      KBB: DEFAULT_TIERS.map((tier) => ({ ...tier })),
      GiveMeTheVin: DEFAULT_TIERS.map((tier) => ({ ...tier })),
      Other: DEFAULT_TIERS.map((tier) => ({ ...tier })),
      ...overrides,
    },
  };
}

test('isSimulatable requires a closed deal with a reconstructable fair market value', () => {
  assert.equal(isSimulatable({ winLossStatus: 'WON', expectedMargin: 100, finalCounterOffer: 9000 }), true);
  assert.equal(isSimulatable({ winLossStatus: 'PENDING', expectedMargin: 100, finalCounterOffer: 9000 }), false);
  assert.equal(isSimulatable({ winLossStatus: 'WON', expectedMargin: null, finalCounterOffer: 9000 }), false);
  assert.equal(isSimulatable({ winLossStatus: 'LOST', expectedMargin: 100, finalCounterOffer: null }), false);
});

test('simulateCandidatePolicy requires a valid candidateConfig', () => {
  assert.throws(() => simulateCandidatePolicy([], {}), /tiersByCompetitor/);
  assert.throws(() => simulateCandidatePolicy([], null), /tiersByCompetitor/);
});

test('simulateCandidatePolicy returns zeroed metrics for an empty submission pool', () => {
  const result = simulateCandidatePolicy([], candidateConfig());
  assert.equal(result.sampleSize, 0);
  assert.equal(result.excludedCount, 0);
  assert.deepEqual(result.current, { volume: 0, wonCount: 0, winRate: 0, totalGrossMargin: 0, avgMarginPerWonDeal: 0, autoApprovalVolume: 0 });
  assert.deepEqual(result.candidate, result.current);
  assert.deepEqual(result.delta, { winRate: 0, totalGrossMargin: 0, avgMarginPerWonDeal: 0, autoApprovalVolume: 0 });
});

test('simulateCandidatePolicy excludes open/unresolvable submissions from the sample', () => {
  const pending = { ...baseSubmission(), id: 'p1', winLossStatus: 'PENDING' };
  const noMargin = { ...baseSubmission(), id: 'p2', winLossStatus: 'WON' };
  const result = simulateCandidatePolicy([pending, noMargin], candidateConfig());
  assert.equal(result.sampleSize, 0);
  assert.equal(result.excludedCount, 2);
});

test('simulateCandidatePolicy replays historical submissions against a candidate policy and computes deltas', () => {
  const submissionA = {
    id: 'a',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...baseSubmission({
      competitor: 'CarMax',
      competitorOfferAmount: 9500,
      winLossStatus: 'WON',
      approvalType: 'AUTO_DISPATCH',
      finalCounterOffer: 9800,
      expectedMargin: 1200,
    }),
  };
  const submissionB = {
    id: 'b',
    timestamp: '2026-01-02T00:00:00.000Z',
    ...baseSubmission({
      competitor: 'Carvana',
      competitorOfferAmount: 8000,
      winLossStatus: 'LOST',
      approvalType: 'HUMAN_APPROVED',
      finalCounterOffer: 8300,
      expectedMargin: 148,
    }),
  };

  const candidate = candidateConfig({
    CarMax: [
      { minPrice: 0, maxPrice: 15000, flatAmount: 2000, percent: 0, strategy: TIER_STRATEGIES.MAX, autoApprove: false },
      ...DEFAULT_TIERS.slice(1).map((tier) => ({ ...tier })),
    ],
    Carvana: [
      { minPrice: 0, maxPrice: 15000, flatAmount: 0, percent: 0, strategy: TIER_STRATEGIES.MAX, autoApprove: true },
      ...DEFAULT_TIERS.slice(1).map((tier) => ({ ...tier })),
    ],
  });

  const result = simulateCandidatePolicy([submissionA, submissionB], candidate);

  assert.equal(result.sampleSize, 2);
  assert.equal(result.excludedCount, 0);

  // Current (actual) side reflects the ground-truth outcomes as recorded.
  assert.equal(result.current.wonCount, 1);
  assert.equal(result.current.winRate, 0.5);
  assert.equal(result.current.totalGrossMargin, 1200);
  assert.equal(result.current.avgMarginPerWonDeal, 1200);
  assert.equal(result.current.autoApprovalVolume, 1);

  // Candidate side: CarMax's much larger flat offset pushes submission A's post-offer margin
  // into PASS (11000 - 11500 = -500), flipping it to a projected loss. Carvana's zeroed-out
  // offset leaves submission B's margin fully intact (8448 - 8000 = 448), flipping it to a win.
  const projA = result.projections.find((p) => p.submissionId === 'a');
  const projB = result.projections.find((p) => p.submissionId === 'b');
  assert.equal(projA.won, false);
  assert.equal(projA.autoApprove, false);
  assert.equal(projB.won, true);
  assert.equal(projB.expectedMargin, 448);
  assert.equal(projB.autoApprove, false);

  assert.equal(result.candidate.wonCount, 1);
  assert.equal(result.candidate.winRate, 0.5);
  assert.equal(result.candidate.totalGrossMargin, 448);
  assert.equal(result.candidate.avgMarginPerWonDeal, 448);
  assert.equal(result.candidate.autoApprovalVolume, 0);

  assert.equal(result.delta.winRate, 0);
  assert.equal(result.delta.totalGrossMargin, -752);
  assert.equal(result.delta.avgMarginPerWonDeal, -752);
  assert.equal(result.delta.autoApprovalVolume, -1);
});

test('SimulationService requires a submissionService', () => {
  assert.throws(() => new SimulationService({}), /submissionService/);
});

test('SimulationService.simulateCandidatePolicy replays the submissionService pool without mutating it', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  submissionService.submit(
    baseSubmission({
      competitor: 'CarMax',
      competitorOfferAmount: 9500,
      winLossStatus: 'WON',
      approvalType: 'AUTO_DISPATCH',
      finalCounterOffer: 9800,
      expectedMargin: 1200,
    }),
  );
  const before = submissionService.getSubmissions();

  const simulationService = new SimulationService({ submissionService });
  const result = simulationService.simulateCandidatePolicy(candidateConfig());

  assert.equal(result.sampleSize, 1);
  assert.deepEqual(submissionService.getSubmissions(), before);
});
