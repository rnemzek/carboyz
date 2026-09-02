# Unit of Work Payload: UOW-CARBOYZ-29

**Title:** Counterfactual "What-If" Scenario Simulation Engine
**Target Scope:** `src/services/SimulationService.js`, `src/controllers/SimulationController.js`, `src/ui/SimulationView.js`, `src/ui/App.js`

---

## 1. Context & Objective
Build a counterfactual simulation engine that allows dealership managers to test prospective spread policies (candidate tier offsets, margin caps, and auto-approval thresholds) against historical seller submission pools[span_5](start_span)[span_5](end_span). The engine re-evaluates past submission datasets to project conversion deltas, total gross margin shifts, and volume vs. profit trade-off curves before live policy deployment[span_6](start_span)[span_6](end_span).

---

## 2. Acceptance Criteria
- [ ] **Simulation Core Service:** Create `SimulationService.js` that accepts a candidate spread configuration and replays a pool of historical `Submission` instances through `SpreadService.js` to compute projected vs. actual outcomes[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span).
- [ ] **Comparative Impact Metrics:** Compute projected delta metrics: Win Rate % shift, Total Gross Margin shift, Average Margin per Won Deal, and Auto-Approval Volume delta[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).
- [ ] **"What-If" Simulation UI:** Create `SimulationView.js` / `SimulationController.js` providing interactive sliders/inputs for candidate tier adjustments and side-by-side comparison cards (Current Policy vs. Candidate Policy)[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span).
- [ ] **App Navigation Integration:** Wire the Simulation engine into `App.js` navigation bar so dealer users can seamlessly toggle between live Analytics and Simulation modes[span_13](start_span)[span_13](end_span).
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% of existing 563 tests plus new unit tests for `SimulationService.js`[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span). Maintain $\ge 80\%$ line and branch test coverage on new service and controller logic[span_16](start_span)[span_16](end_span).

---

## 3. Surgical Implementation Plan
1. **Simulation Service Logic:** Implement `SimulationService.simulateCandidatePolicy(historicalSubmissions, candidateConfig)` re-running pricing evaluations without mutating active state[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span).
2. **Controller & State Management:** Create `SimulationController.js` to bridge Candidate Policy inputs to `SimulationService` and formulate view models[span_19](start_span)[span_19](end_span).
3. **Interactive Simulation View:** Build `SimulationView.js` featuring tier adjustment form controls and side-by-side projected KPI cards[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span).
4. **Unit Verification:** Write unit tests in `tests/services/SimulationService.test.js` validating comparative delta calculations and edge cases[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span).
