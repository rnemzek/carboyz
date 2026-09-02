import { calculateSpread, DealScoreStatus, WHOLESALE_FACTOR } from './SpreadService.js';
import { validateConfig } from './SpreadConfigService.js';

/**
 * A historical Submission only records the counter offer it actually received, not the
 * fair market value SpreadService used to derive it. estimatedWholesaleValue = fairMarketValue *
 * WHOLESALE_FACTOR and expectedMargin = estimatedWholesaleValue - finalCounterOffer (see
 * DispatchService.dispatch / LeadInboxController.approveAndSend), so FMV is reconstructed by
 * inverting that — letting the candidate tier config be replayed against the same market
 * conditions the deal actually happened under.
 */
function resolveFairMarketValue(submission) {
  if (typeof submission.expectedMargin !== 'number' || typeof submission.finalCounterOffer !== 'number') {
    return null;
  }
  const estimatedWholesaleValue = submission.expectedMargin + submission.finalCounterOffer;
  return estimatedWholesaleValue / WHOLESALE_FACTOR;
}

/**
 * Only closed deals (WON/LOST) with a reconstructable fair market value are replayed — an open
 * or expired submission has no ground-truth outcome to compare a projection against.
 */
export function isSimulatable(submission) {
  return (
    (submission.winLossStatus === 'WON' || submission.winLossStatus === 'LOST') &&
    resolveFairMarketValue(submission) !== null
  );
}

/**
 * Projects a single historical submission through the candidate tier config.
 *
 * calculateSpread's own `status` is derived only from fairMarketValue and competitorOfferAmount —
 * it never varies with tierConfig, so it can't drive a policy-sensitive win projection on its
 * own. Viability is instead scored on what's left over *after* paying the candidate's recommended
 * counter offer: a second calculateSpread call treats that counter offer as the amount paid out
 * (tierConfig: [], counterOfferOffset: 0, so nothing further is added on top), reusing
 * calculateSpread's own GREENLIGHT/MARGINAL/PASS thresholds instead of duplicating them. A
 * projected deal is "won" — i.e. still worth chasing under the candidate policy — when that
 * leftover margin clears PASS. This measures projected deal profitability, not seller acceptance
 * odds; no seller-behavior model exists in this codebase to project the latter.
 *
 * autoApprove mirrors DispatchService.evaluate()'s live rule (matchedTier.autoApprove gated on a
 * GREENLIGHT raw spread), so it responds to the candidate tier's own autoApprove flag.
 */
function projectSubmission(submission, tiersByCompetitor, policyVersionId) {
  const fairMarketValue = resolveFairMarketValue(submission);
  const tierConfig = tiersByCompetitor[submission.competitor] ?? [];
  const spreadResult = calculateSpread({
    fairMarketValue,
    competitorOfferAmount: submission.competitorOfferAmount,
    tierConfig,
    policyVersionId,
  });

  const viability = calculateSpread({
    fairMarketValue,
    competitorOfferAmount: spreadResult.recommendedCounterOffer,
    tierConfig: [],
    counterOfferOffset: 0,
  });

  const won = viability.status !== DealScoreStatus.PASS;
  const autoApprove = (spreadResult.matchedTier?.autoApprove ?? false) && spreadResult.status === DealScoreStatus.GREENLIGHT;

  return {
    submissionId: submission.id,
    spreadResult,
    won,
    autoApprove,
    expectedMargin: viability.spread,
  };
}

function summarize(volume, wonCount, autoApprovalVolume, totalGrossMargin) {
  return {
    volume,
    wonCount,
    winRate: volume === 0 ? 0 : wonCount / volume,
    totalGrossMargin,
    avgMarginPerWonDeal: wonCount === 0 ? 0 : totalGrossMargin / wonCount,
    autoApprovalVolume,
  };
}

function summarizeActual(submissions) {
  const won = submissions.filter((submission) => submission.winLossStatus === 'WON');
  const autoApprovalVolume = submissions.filter((submission) => submission.approvalType === 'AUTO_DISPATCH').length;
  const totalGrossMargin = won.reduce((sum, submission) => sum + (submission.expectedMargin ?? 0), 0);
  return summarize(submissions.length, won.length, autoApprovalVolume, totalGrossMargin);
}

function summarizeProjected(projections) {
  const won = projections.filter((projection) => projection.won);
  const autoApprovalVolume = projections.filter((projection) => projection.autoApprove).length;
  const totalGrossMargin = won.reduce((sum, projection) => sum + (projection.expectedMargin ?? 0), 0);
  return summarize(projections.length, won.length, autoApprovalVolume, totalGrossMargin);
}

/**
 * Replays `historicalSubmissions` through `candidateConfig` without mutating any active
 * SpreadConfigService state — every input is read-only and the candidate config is only ever
 * passed to the pure calculateSpread() function.
 */
export function simulateCandidatePolicy(historicalSubmissions, candidateConfig) {
  const { tiersByCompetitor, policyVersionId } = validateConfig(candidateConfig);

  const pool = historicalSubmissions ?? [];
  const simulatable = pool.filter(isSimulatable);
  const projections = simulatable.map((submission) =>
    projectSubmission(submission, tiersByCompetitor, policyVersionId ?? null),
  );

  const current = summarizeActual(simulatable);
  const candidate = summarizeProjected(projections);

  return {
    sampleSize: simulatable.length,
    excludedCount: pool.length - simulatable.length,
    current,
    candidate,
    delta: {
      winRate: candidate.winRate - current.winRate,
      totalGrossMargin: candidate.totalGrossMargin - current.totalGrossMargin,
      avgMarginPerWonDeal: candidate.avgMarginPerWonDeal - current.avgMarginPerWonDeal,
      autoApprovalVolume: candidate.autoApprovalVolume - current.autoApprovalVolume,
    },
    projections,
  };
}

export class SimulationService {
  constructor({ submissionService } = {}) {
    if (!submissionService) {
      throw new Error('SimulationService requires a submissionService');
    }
    this.submissionService = submissionService;
  }

  simulateCandidatePolicy(candidateConfig) {
    return simulateCandidatePolicy(this.submissionService.getSubmissions(), candidateConfig);
  }
}
