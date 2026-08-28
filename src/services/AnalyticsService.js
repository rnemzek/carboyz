const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PRICE_TIERS = [
  { key: 'tier-0-15k', label: '$0–$15k', min: 0, max: 15000 },
  { key: 'tier-15-30k', label: '$15k–$30k', min: 15000, max: 30000 },
  { key: 'tier-30k-plus', label: '$30k+', min: 30000, max: null },
];

export const DATE_RANGE_PRESETS = Object.freeze({
  LAST_7_DAYS: 'LAST_7_DAYS',
  LAST_30_DAYS: 'LAST_30_DAYS',
  ALL_TIME: 'ALL_TIME',
});

export function resolveSinceDate(preset, now = new Date()) {
  switch (preset) {
    case DATE_RANGE_PRESETS.LAST_7_DAYS:
      return new Date(now.getTime() - 7 * MS_PER_DAY);
    case DATE_RANGE_PRESETS.LAST_30_DAYS:
      return new Date(now.getTime() - 30 * MS_PER_DAY);
    default:
      return null;
  }
}

export function priceTierForAmount(amount) {
  return PRICE_TIERS.find((tier) => amount >= tier.min && (tier.max === null || amount < tier.max)) ?? null;
}

export function competitorLabel(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return `Other (${submission.competitorDealerName})`;
  }
  return submission.competitor;
}

export function filterSubmissions(submissions, { since = null, competitor = null } = {}) {
  return submissions.filter((submission) => {
    if (since && new Date(submission.timestamp) < since) {
      return false;
    }
    if (competitor && competitorLabel(submission) !== competitor) {
      return false;
    }
    return true;
  });
}

function average(numbers) {
  if (numbers.length === 0) {
    return null;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function computeConversionMetrics(submissions) {
  const won = submissions.filter((submission) => submission.winLossStatus === 'WON').length;
  const lost = submissions.filter((submission) => submission.winLossStatus === 'LOST').length;
  const closed = won + lost;
  return { total: submissions.length, won, lost, winRate: closed === 0 ? 0 : won / closed };
}

export function computeSpeedToLead(submissions) {
  const withTime = submissions.filter((submission) => typeof submission.timeToCounterMs === 'number');
  const auto = withTime.filter((submission) => submission.approvalType === 'AUTO_DISPATCH');
  const human = withTime.filter((submission) => submission.approvalType === 'HUMAN_APPROVED');
  return {
    overallAvgMs: average(withTime.map((submission) => submission.timeToCounterMs)),
    autoDispatchAvgMs: average(auto.map((submission) => submission.timeToCounterMs)),
    humanApprovedAvgMs: average(human.map((submission) => submission.timeToCounterMs)),
  };
}

export function computeMarginTotals(submissions) {
  const wonWithMargin = submissions.filter(
    (submission) => submission.winLossStatus === 'WON' && typeof submission.expectedMargin === 'number',
  );
  return {
    totalExpectedMargin: wonWithMargin.reduce((sum, submission) => sum + submission.expectedMargin, 0),
  };
}

export function computeCompetitorMatrix(submissions) {
  const labels = [...new Set(submissions.map(competitorLabel))].sort();
  return labels.map((label) => {
    const group = submissions.filter((submission) => competitorLabel(submission) === label);
    const conversion = computeConversionMetrics(group);
    const margin = computeMarginTotals(group);
    const counters = group
      .filter((submission) => typeof submission.finalCounterOffer === 'number')
      .map((submission) => submission.finalCounterOffer);
    return {
      competitor: label,
      volume: group.length,
      avgCounterOffer: average(counters),
      winRate: conversion.winRate,
      totalMargin: margin.totalExpectedMargin,
    };
  });
}

export function computePriceTierDistribution(submissions) {
  return PRICE_TIERS.map((tier) => {
    const group = submissions.filter(
      (submission) => priceTierForAmount(submission.competitorOfferAmount)?.key === tier.key,
    );
    const conversion = computeConversionMetrics(group);
    return { tier: tier.key, label: tier.label, volume: group.length, winRate: conversion.winRate };
  });
}

export function computeApprovalSplit(submissions) {
  const dispatched = submissions.filter((submission) => submission.approvalType);
  const autoDispatchCount = dispatched.filter((submission) => submission.approvalType === 'AUTO_DISPATCH').length;
  const humanApprovedCount = dispatched.filter((submission) => submission.approvalType === 'HUMAN_APPROVED').length;
  const total = dispatched.length;
  return {
    autoDispatchCount,
    humanApprovedCount,
    autoDispatchPct: total === 0 ? 0 : autoDispatchCount / total,
    humanApprovedPct: total === 0 ? 0 : humanApprovedCount / total,
  };
}

export function computeMetrics(submissions) {
  const conversion = computeConversionMetrics(submissions);
  const speed = computeSpeedToLead(submissions);
  const margin = computeMarginTotals(submissions);

  return {
    totalVolume: submissions.length,
    winRate: conversion.winRate,
    won: conversion.won,
    lost: conversion.lost,
    avgResponseTimeMs: speed.overallAvgMs,
    speedToLead: speed,
    totalExpectedMargin: margin.totalExpectedMargin,
    competitorMatrix: computeCompetitorMatrix(submissions),
    priceTierDistribution: computePriceTierDistribution(submissions),
    approvalSplit: computeApprovalSplit(submissions),
  };
}

export class AnalyticsService {
  constructor({ submissionService } = {}) {
    if (!submissionService) {
      throw new Error('AnalyticsService requires a submissionService');
    }
    this.submissionService = submissionService;
  }

  getMetrics({ since = null, competitor = null } = {}) {
    const filtered = filterSubmissions(this.submissionService.getSubmissions(), { since, competitor });
    return computeMetrics(filtered);
  }

  getCompetitorLabels() {
    return [...new Set(this.submissionService.getSubmissions().map(competitorLabel))].sort();
  }
}
