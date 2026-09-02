import { DATE_RANGE_PRESETS, resolveSinceDate, PRICE_TIERS, APPROVAL_TYPES } from '../services/AnalyticsService.js';

export class AnalyticsController {
  constructor({ analyticsService } = {}) {
    if (!analyticsService) {
      throw new Error('AnalyticsController requires an analyticsService');
    }
    this.analyticsService = analyticsService;
  }

  getDateRangePresets() {
    return Object.values(DATE_RANGE_PRESETS);
  }

  getCompetitorOptions() {
    return this.analyticsService.getCompetitorLabels();
  }

  getPriceTierOptions() {
    return PRICE_TIERS.map(({ key, label }) => ({ key, label }));
  }

  getApprovalTypeOptions() {
    return APPROVAL_TYPES;
  }

  getPolicyVersionPins() {
    return this.analyticsService.getPolicyVersionPins();
  }

  buildViewModel({ dateRange = DATE_RANGE_PRESETS.ALL_TIME, competitor = null, priceTier = null, approvalType = null } = {}) {
    const since = resolveSinceDate(dateRange);
    return this.analyticsService.getMetrics({
      since,
      competitor: competitor || null,
      priceTier: priceTier || null,
      approvalType: approvalType || null,
    });
  }
}
