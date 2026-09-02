# Unit of Work Payload: UOW-CARBOYZ-28

**Title:** Analytics Policy Version Pinning, Dynamic Filters & Responsive Layout
**Target Scope:** `src/ui/AnalyticsView.js`, `src/controllers/AnalyticsController.js`, `src/services/AnalyticsService.js`

---

## 1. Context & Objective
Upgrade `AnalyticsView.js` and `AnalyticsService.js` to render interactive time-series visualizations with policy version pinning overlays[span_5](start_span)[span_5](end_span)[span_6](start_span)[span_6](end_span). Visual vertical timeline pins will mark exact moments when pricing policy versions (`v1.0.0`, `v1.1.0`) were deployed[span_7](start_span)[span_7](end_span). Add dynamic slice-and-dice filter controls (date range, competitor source, price tier) and optimize dashboard responsiveness across mobile and desktop viewports[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span).

---

## 2. Acceptance Criteria
- [ ] **Policy Version Pinning Overlays:** `AnalyticsView.js` renders visual timeline indicators/pins over conversion and margin charts corresponding to `policyVersionId` deployment timestamps in `AuditLedgerService`[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span).
- [ ] **Dynamic Multi-Variable Filters:** `AnalyticsController.js` / `AnalyticsView.js` provides interactive filter controls for date range (30/60/90 days), competitor source (CarMax, Carvana, Hendrick), price band, and approval type[span_12](start_span)[span_12](end_span).
- [ ] **Mobile & Desktop Responsive Layout:** `AnalyticsView.js` adapts smoothly across small mobile viewports and wide desktop displays without layout breaking[span_13](start_span)[span_13](end_span).
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% of existing 550 tests plus new unit tests for filtered analytics aggregation logic[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span). Maintain $\ge 80\%$ test coverage on modified controller and service logic[span_16](start_span)[span_16](end_span).

---

## 3. Surgical Implementation Plan
1. **Analytics Service Enhancements:** Update `AnalyticsService.js` to accept filter predicate parameters (date range, competitor, price tier) and correlate metrics with active policy snapshots[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span).
2. **Controller State & Filtering:** Update `AnalyticsController.js` to maintain active filter state and compute version pin annotations from `AuditLedgerService`[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span).
3. **View Layout & Version Pins:** Upgrade `AnalyticsView.js` to render version pin markers and dynamic summary cards[span_21](start_span)[span_21](end_span)[span_22](start_span)[span_22](end_span).
4. **Unit Verification:** Add tests in `tests/services/AnalyticsService.test.js` or `tests/controllers/` verifying filtered calculations and version pin payload generation[span_23](start_span)[span_23](end_span)[span_24](start_span)[span_24](end_span).
