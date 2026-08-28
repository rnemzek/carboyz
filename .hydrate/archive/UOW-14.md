# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: carboyz
Working Directory (absolute): /Users/rnemzek/Projects/personal/carboyz

⚠ SAFETY: Before executing any file edits, confirm your current working
directory and open project match the path above exactly. If they do not
match, STOP and alert the Product Owner instead of proceeding.

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Architectural & System Execution Rules
See AI_PROJECT_RULES.md at repo root (Operating Triad Contract, Quality Gates, Surgical Execution Boundaries, Fast-Path Protocol).

## Target Task Scope & Active Sprint

### UOW-14 — Analytics & Full-Lifecycle Event Logging Schema

**Objective**
Enrich the Submission data model and persistence layers to capture full-lifecycle event telemetry on every transaction from day one, so all real and simulated activity records the data points needed for future win/loss reporting.

**Acceptance Criteria** (as given by Product Owner)
1. Extended Telemetry Schema (`src/models/Submission.js`) — `winLossStatus` (enum: PENDING/AUTO_COUNTERED/MANUAL_APPROVED/WON/LOST/EXPIRED/DECLINED), `initialCompetitorOffer`, `calculatedCounterOffer`, `finalCounterOffer`, `expectedMargin` (= estimatedWholesaleValue - finalCounterOffer), `timeToCounterMs` (intake→counter-dispatch delta), `priceBracket` (matched tier label, e.g. "$0-$15,000"), `approvalType` (enum: AUTO_DISPATCH/HUMAN_APPROVED).
2. Service Layer Integration (`DispatchService.js` & `SubmissionService.js`) — dispatch auto-populates the telemetry fields and computes `timeToCounterMs`; `LeadInboxController.approveAndSend()` re-calculates `finalCounterOffer`/`expectedMargin`/`approvalType` on human override; expose quick-action status toggles for WON/LOST.
3. Testing: `tests/submissionTelemetry.test.js` — schema validation, delta time math, margin calculations, WON/LOST status transitions. ≥80% line/branch coverage on touched modules. Full `npm test` regression.

### Prior UOW
UOW-13's staged content archived to `.hydrate/archive/UOW-13.md` (shipped and committed as `8ba440e`).

### Architecture (Lead Architect step — matches existing repo conventions)

**`src/models/Submission.js`:** add `WIN_LOSS_STATUSES` (`PENDING` default, `AUTO_COUNTERED`, `MANUAL_APPROVED`, `WON`, `LOST`, `EXPIRED`, `DECLINED`) and `APPROVAL_TYPES` (`AUTO_DISPATCH`, `HUMAN_APPROVED`) enums, exported alongside `SUBMISSION_STATUSES`. `winLossStatus` is a lifecycle dimension distinct from the existing `status` field (dispatch/routing state) — it tracks deal outcome. New constructor params: `winLossStatus = 'PENDING'` (validated against enum), `approvalType` (nullable, validated against enum when present), and five nullable numeric/string telemetry fields: `initialCompetitorOffer`, `calculatedCounterOffer`, `finalCounterOffer`, `expectedMargin`, `timeToCounterMs`, `priceBracket`. A small module-level `validateOptionalNumber(value, fieldName, { allowNegative })` helper (matching the `validateTier`-style helper precedent in `SpreadConfigService.js`) covers the 5 numeric fields — all reject non-numbers, all reject negative values except `expectedMargin` (a deal can run at a loss). All five default to `null` when omitted, so existing callers/tests constructing bare submissions are unaffected.

**`src/services/SubmissionService.js`:** `submit()` auto-populates `initialCompetitorOffer` from `competitorOfferAmount` as an immutable intake snapshot (`data.initialCompetitorOffer ?? data.competitorOfferAmount`). New `updateFields(id, patch)` — generalizes the existing `updateStatus` mutation (find by id, reconstruct via `new Submission({...existing, ...patch})`, persist) so callers can patch multiple telemetry fields atomically; `updateStatus(id, status)` becomes a thin `return this.updateFields(id, { status })` wrapper — same "not found" error, existing tests unaffected.

**`src/services/DispatchService.js`:** new exported `formatPriceBracket(tier)` helper (reuses the existing module-level `currencyFormatter`) → `"$0-$15,000"` style for a bounded tier, `"$30,000+"` for an open-ended top tier, `null` when no tier matched — mirrors the ticket's own example string exactly. `dispatch()` computes `calculatedCounterOffer` (= `spreadResult.recommendedCounterOffer`) and `expectedMargin` (= `estimatedWholesaleValue - calculatedCounterOffer`, or `null` when `estimatedWholesaleValue` is `null` under `NO_DATA`) once, shared by both branches.
- **Auto path** (`AUTO_COUNTER_SENT`): this *is* the actual counter dispatch, so `timeToCounterMs = Date.now() - new Date(submission.timestamp).getTime()` is computed here. Also sets `winLossStatus: 'AUTO_COUNTERED'`, `finalCounterOffer: calculatedCounterOffer` (no override possible on the auto path), `priceBracket`, `approvalType: 'AUTO_DISPATCH'`.
- **Manual path** (`PENDING_APPROVAL`): no counter has actually been sent to the seller yet (it's queued for human sign-off), so `timeToCounterMs` and `approvalType` are deliberately left `null` here — populated later by `approveAndSend()` at the moment the human actually sends it. Still sets `winLossStatus: 'PENDING'`, `calculatedCounterOffer`, `finalCounterOffer` (defaulted to the system recommendation pending override), `expectedMargin`, `priceBracket`.
Both branches also carry forward `initialCompetitorOffer` (already set at intake by `SubmissionService.submit`).

**`src/ui/LeadInboxController.js`:** `approveAndSend(id, counterOfferAmount)` — this is the true "counter-offer dispatch" moment for a manual-path lead. Looks up the pre-update submission, resolves FMV via the existing `resolveFairMarketValue` helper, recomputes `calculateSpread(...)` to get `estimatedWholesaleValue` (not persisted directly — only `expectedMargin` is a stored field per schema), then calls `submissionService.updateFields(id, { status: 'AUTO_COUNTER_SENT', winLossStatus: 'MANUAL_APPROVED', finalCounterOffer: counterOfferAmount, expectedMargin, approvalType: 'HUMAN_APPROVED', timeToCounterMs })`. Throws the same `Submission not found: ${id}` error as `SubmissionService` if the id doesn't resolve, for a consistent error contract. New `markWinLoss(id, winLossStatus)` — validates against a `['WON', 'LOST']` allowlist (the two quick-action outcomes the ticket calls for; `EXPIRED`/`DECLINED`/etc. are schema-valid but not wired to a quick action in this UOW) and delegates to `submissionService.updateFields(id, { winLossStatus })`. **Scope boundary:** `LeadInboxView.js` is not in this ticket's named file list and is left untouched — `markWinLoss` is exposed on the controller (satisfies "expose quick-action toggles" as a callable, tested capability) without adding new UI wiring beyond ticket scope.

**Tests — `tests/submissionTelemetry.test.js` (new, the graded suite):**
- Schema: defaults (`winLossStatus: 'PENDING'`, telemetry fields `null`); every `WIN_LOSS_STATUSES`/`APPROVAL_TYPES` value accepted, invalid values rejected; numeric fields reject non-numbers and (except `expectedMargin`) negatives; `expectedMargin` accepts negative values.
- `DispatchService.dispatch()` auto path: telemetry fields populated, `approvalType: 'AUTO_DISPATCH'`, `winLossStatus: 'AUTO_COUNTERED'`, `timeToCounterMs` is a non-negative number consistent with the submission's timestamp; manual path: `approvalType`/`timeToCounterMs` still `null`, other telemetry fields populated, `winLossStatus: 'PENDING'`; `NO_DATA` case leaves `expectedMargin: null`.
- `LeadInboxController.approveAndSend()`: override amount becomes `finalCounterOffer`, `expectedMargin` recalculated off the override, `approvalType: 'HUMAN_APPROVED'`, `winLossStatus: 'MANUAL_APPROVED'`, `timeToCounterMs` populated.
- `LeadInboxController.markWinLoss()`: `WON`/`LOST` accepted and persisted; any other value throws.
- Regression: `npm test` must stay green across all existing tests (unchanged pre-existing `locationAdapter.test.js` env flakes are the only expected failures).
- Coverage: `node --test --experimental-test-coverage` on `Submission.js`, `SubmissionService.js`, `DispatchService.js`, and the touched slice of `LeadInboxController.js` must clear the repo's 80% line/branch standard.

## Execution Instruction
Architecture staged above. Lead Developer (Claude Code) to proceed directly with implementation and verification — this is a schema/service-layer extension with no new domain service, no new UI wiring, and no breaking changes to existing call signatures (`updateStatus`, `approveAndSend`'s existing 2-arg signature, `dispatch()`'s existing return shape are all preserved), so it qualifies for immediate execution per Fast-Path Protocol §3 rather than a fresh `EnterPlanMode` cycle.
