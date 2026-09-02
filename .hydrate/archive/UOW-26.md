# Unit of Work Payload: UOW-CARBOYZ-26

**Title:** Policy Versioning & Immutable Cryptographic Audit Ledger
**Target Scope:** `src/services/SpreadConfigService.js`, `src/services/AuditLedgerService.js`, `src/models/PolicySnapshot.js`

---

## 1. Context & Objective
Upgrade `SpreadConfigService` from direct `localStorage` overwrites to a versioned, append-only cryptographic audit trail[span_7](start_span)[span_7](end_span). When a dealer updates spread tiers, margin factors, or auto-approval thresholds, record an immutable audit log entry capturing `timestamp`, `authorId`, `previousConfigHash`, `newConfigHash`, and `diffPayload`[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span). Every evaluated submission will record the active `policyVersionId`[span_10](start_span)[span_10](end_span).

---

## 2. Acceptance Criteria
- [ ] **Immutable Audit Ledger Service:** Create `AuditLedgerService.js` handling SHA-256 (or Web Crypto API) hash chaining for policy configuration mutations[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span).
- [ ] **Semantic Policy Versioning:** Upgrade `SpreadConfigService.js` to assign semantic policy versions (`v1.0.0`, `v1.1.0`) upon saving updated tier configurations[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span).
- [ ] **Submission Version Pinning:** Ensure `Submission` evaluation records capture the immutable `policyVersionId` active at the moment of pricing calculation[span_15](start_span)[span_15](end_span).
- [ ] **Quality Gate & Zero Regression:** Maintain 100% test pass rate on `npm test` with $\ge 80\%$ line and branch test coverage on all new models/services[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span).

---

## 3. Surgical Implementation Plan
1. **Audit Ledger Core:** Create `AuditLedgerService.js` using `crypto.subtle` / fallback hash generation to record append-only mutation blocks[span_18](start_span)[span_18](end_span).
2. **Config Service Versioning:** Integrate version generation and audit logging into `SpreadConfigService.saveConfig()`[span_19](start_span)[span_19](end_span).
3. **Telemetry & Submission Pinning:** Pass active `policyVersionId` into `SpreadService.js` evaluation outputs[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span).
4. **Unit Verification:** Add tests in `tests/services/AuditLedgerService.test.js` validating hash continuity and version resolution[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span).
