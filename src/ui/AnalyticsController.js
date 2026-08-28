import { DATE_RANGE_PRESETS, resolveSinceDate } from '../services/AnalyticsService.js';

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

  buildViewModel({ dateRange = DATE_RANGE_PRESETS.ALL_TIME, competitor = null } = {}) {
    const since = resolveSinceDate(dateRange);
    return this.analyticsService.getMetrics({ since, competitor: competitor || null });
  }
}
