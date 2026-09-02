# Unit of Work Payload: UOW-CARBOYZ-27

**Title:** Synthetic Submission Generator & Time-Series Historical Policy State Seeder
**Target Scope:** `src/utils/seedInventory.js`, `src/services/SubmissionService.js`, `src/services/AuditLedgerService.js`, `src/ui/TestHarnessView.js`

---

## 1. Context & Objective
Build a parameterized submission generator and time-series historical state seeder to support analytics visualization and counterfactual simulation[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span). Generate statistically realistic submission datasets (valid VINs, competitor offers, mileage distributions, and market comp valuations) paired with historical policy version chains (`v1.0.0` $\rightarrow$ `v1.2.0`) and timestamped telemetry[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span).

---

## 2. Acceptance Criteria
- [ ] **Parameterized Submission Generator:** Extend `seedInventory.js` / `TestHarnessView.js` with a deterministic generator capable of producing batches of valid `Submission` instances across selectable date ranges, vehicle makes, and competitor sources (CarMax, Carvana, Hendrick)[span_8](start_span)[span_8](end_span).
- [ ] **Historical State Seeder:** Utility that seeds sequential policy version mutations (`v1.0.0`, `v1.1.0`, `v1.2.0`) into `AuditLedgerService` and associates each generated submission batch with the active `policyVersionId` corresponding to its timestamp[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).
- [ ] **Test Harness Integration:** Expose seed actions directly within `TestHarnessView.js` to allow one-click population of mock historical lead and policy data for development and testing[span_11](start_span)[span_11](end_span).
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% of existing 541 tests plus new unit tests covering the seeder and generator[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span). Maintain $\ge 80\%$ line and branch coverage on new/modified modules[span_14](start_span)[span_14](end_span).

---

## 3. Surgical Implementation Plan
1. **Generator Utility:** Implement `buildSyntheticSubmissions(count, config)` with realistic VINs, market comp variations, and competitor offers[span_15](start_span)[span_15](end_span).
2. **Timeline Seeder:** Create `seedHistoricalPolicyTimeline(tenantId)` to populate chronological policy snapshots and hashed audit ledger entries[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span).
3. **UI Integration:** Add control triggers to `TestHarnessView.js` for seeding 30-day, 60-day, or 90-day historical submission pools[span_18](start_span)[span_18](end_span).
4. **Unit Verification:** Write unit tests verifying generated submission validity, timestamp distribution, and correct `policyVersionId` linkage[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span).
