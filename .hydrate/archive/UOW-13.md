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

### UOW-13 — Instant Counter-Offer Action Engine & Approval Routing

**Objective**
Implement an automated counter-offer dispatch engine with configurable Auto-Counter Bands and Approval Notification Routing. Low-dollar bands dispatch instantly via Web Share / SMS, while high-dollar or custom bands pause for human review in the Lead Inbox.

**Acceptance Criteria** (as given by Product Owner)
1. Auto-Counter Band Configuration (`src/services/SpreadConfigService.js`) — per-tier `autoApprove` toggle; low brackets default `true`, `$20k+`-class bracket defaults `false`; Admin UI toggle per tier row.
2. Dispatch Engine & Action Pipeline (`src/services/DispatchService.js`) — auto path marks `AUTO_COUNTER_SENT` on GREENLIGHT + `autoApprove` tiers; manual path flags `PENDING_APPROVAL`, pre-fills a counter, offers "Approve & Send"/"Modify Counter", and fires a mock push/webhook payload at the CarBoyZ distro group.
3. One-Tap Seller Notification Pipeline — clean message formatter + `navigator.share()` integration with a fallback.
4. Admin Portal & Inbox Enhancements (`src/ui/LeadInboxView.js`) — visually distinguish Auto-Countered vs Pending Sign-off cards; allow counter override before Approve & Send.

Testing: `tests/dispatchService.test.js` covering band matching, auto vs. manual routing, payload formatting; ≥80% line/branch coverage on new modules; full `npm test` regression.

### Architecture (Lead Architect step — matches existing repo conventions)

**Submission status additions** (`src/models/Submission.js`): extend `SUBMISSION_STATUSES` with `PENDING_APPROVAL` and `AUTO_COUNTER_SENT` (existing `updateStatus` re-validates through the `Submission` constructor already — no other change needed there).

**Tier shape gains `autoApprove`** (`src/services/SpreadConfigService.js`): `{ ...existing fields, autoApprove: boolean }`. `DEFAULT_TIERS` keeps the existing 3-bracket ladder from UOW-12 ($0–15k / $15k–30k / $30k+) rather than re-cutting it to the ticket's illustrative `$10k`/`$20k` example numbers — continuity with the already-shipped Admin UI and existing tests outweighs matching the ticket's "e.g." figures exactly. `autoApprove: true` on the first two brackets, `false` on the $30k+ bracket. `validateTier` accepts an optional boolean `autoApprove` (throws if present and non-boolean); `validateConfig`'s per-tier normalization defaults a missing `autoApprove` to `false` (same terse-authoring precedent as `strategy` defaulting to `MAX`, but conservative here — an unspecified band requires human sign-off rather than silently auto-sending).

**`SpreadService.js` (small, backward-compatible extension):** `calculateSpread`'s return value gains `matchedTier` (the raw matched tier object, or `null` when no `tierConfig`/no bracket matched) so callers can read `matchedTier.autoApprove` without re-implementing bracket matching. `resolveCounterOfferOffset` internally returns `{ counterOffset, matchedTier }` instead of a bare number. No existing test asserts the full result shape (all existing assertions are per-field `assert.equal`), so this is additive only.

**`src/services/DispatchService.js` (new):**
- Exports `DISPATCH_OUTCOMES = { AUTO_COUNTER_SENT, PENDING_APPROVAL }`.
- Exports pure helpers `formatCounterOfferMessage({ submission, recommendedCounterOffer, link = '#' })` → the seller-facing text block ("Car Offer Beaters: We reviewed your ... Tap here to confirm: ..."), and `buildApprovalNotification({ submission, recommendedCounterOffer })` → `{ target: 'CarBoyZ distro group', title: 'New $Xk Lead requires counter-offer sign-off', body, submissionId }`. Both are exported standalone so `LeadInboxController` can reuse the message formatter without a full `DispatchService` DI.
- `class DispatchService`, DI'd `{ submissionService, spreadConfigService, telemetryService, ingestService, notifier = null }` — first four required (throw pattern matches `LeadInboxController`), mirrors its own private `resolveFairMarketValue` helper (same 3-line inventory/comp-average lookup — small deliberate duplication rather than extracting a shared helper module, consistent with this repo not sharing that logic across `DealerStudioController`/`LeadInboxController` either).
- `evaluate(submission)` → resolves FMV, pulls `tierConfig` via `spreadConfigService.getTiersForCompetitor`, calls `calculateSpread`, and returns `{ spreadResult, autoApprove: matchedTier?.autoApprove ?? false, shouldAutoDispatch: autoApprove && status === GREENLIGHT }`. **Scope decision:** auto-dispatch requires *both* an `autoApprove` tier match *and* a GREENLIGHT score — an `autoApprove` band that doesn't clear GREENLIGHT (e.g. `NO_DATA`/`MARGINAL`/`PASS`) still routes to manual review rather than auto-sending a weak counter. The ticket's "passes as GREENLIGHT" language for the auto path supports this reading; it isn't spelled out for the inverse, but auto-sending an unvetted low-quality counter has no acceptance-criteria support and real downside, so the conservative default applies.
- `dispatch(submission)` → auto path: `submissionService.updateStatus(id, 'AUTO_COUNTER_SENT')`, returns `{ outcome, submission, spreadResult, message: formatCounterOfferMessage(...) }`. Manual path: `submissionService.updateStatus(id, 'PENDING_APPROVAL')`, calls `this.notifier?.notify?.(notification)` (optional — defaults to a no-op so unit tests don't need a fake), returns `{ outcome, submission, spreadResult, notification }`.

**Trigger point — `src/ui/SellerSubmissionController.js`:** gains an **optional** 3rd constructor param `dispatchService = null` (same optional-DI precedent as `hapticsService`). `submitSubmission(data)` calls `this.dispatchService?.dispatch?.(submission)` right after `submissionService.submit(data)` — this is the only place "a new seller submission arrives," so it's the natural hook for "auto-mark on arrival." Existing required-dep test/behavior for `submissionService` is untouched.

**`src/ui/LeadInboxController.js` (extend):** `buildLeadViewModels()` adds `counterMessage: formatCounterOfferMessage({ submission, recommendedCounterOffer: spreadResult.recommendedCounterOffer })` to each view model (imported directly from `DispatchService.js`, no new constructor dependency). New method `approveAndSend(id, counterOfferAmount)` — updates status to `AUTO_COUNTER_SENT` via `submissionService.updateStatus` and returns `{ submission, message: formatCounterOfferMessage(...) }` using the caller-supplied (possibly overridden) amount; the view is responsible for passing either the untouched recommended value or an edited one.

**`src/ui/LeadInboxView.js` (extend):** card rendering branches on `lead.status`:
- `PENDING_APPROVAL` → badge "Pending Sign-off", a number input pre-filled with `spreadResult.recommendedCounterOffer`, "Approve & Send" button (reads the input's current value, calls `controller.approveAndSend`, re-renders), and "Modify Counter" button. **Scope simplification:** "Modify Counter" focuses/selects the input rather than persisting a separate draft state — the input is already always editable, so the two-button framing from the ticket collapses to "send now" vs. "let me edit first," which is what the input + focus affordance provides without inventing new persisted state the ticket didn't ask for.
- `AUTO_COUNTER_SENT` → badge "Auto-Countered", plus a "Send Counter" button that calls the existing `ShareService.share({ title: 'Counter Offer', text: lead.counterMessage })` — reusing the exact `onShare` disable/relabel pattern already used for vehicle cards in `App.js`'s `renderVehicleCard`, wired in via a new `onSendCounter` callback param from `App.js` (passes `(text) => shareService.share({ title: 'Counter Offer', text })`).
- Other statuses (`NEW`, `IN_REVIEW`, etc.) keep the existing spread badge/actions unchanged.

**`src/ui/SpreadConfigView.js` (extend):** each tier row gains an `<input type="checkbox">` labeled "Auto-Dispatch Counter Offer", defaulted from `tier.autoApprove`; `readTier()` includes `autoApprove: checkbox.checked`. New "Add Tier" rows default the checkbox unchecked (`autoApprove: false`), matching the conservative validator default.

**`App.js` wiring:** `getTenantState()` gains `dispatchService: new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService, notifier })`, where `notifier` is a small inline mock (`console.info` + best-effort browser `Notification` API if permitted — not a new service class, just a few lines, since the ticket calls this a "mock/browser Push Notification"). `SellerSubmissionController` construction passes `dispatchService: state.dispatchService`. `renderLeadInboxView` gets an `onSendCounter` callback wired to `shareService.share(...)`.

**Styling (`styles.css`):** `.badge--pending-approval` / `.badge--auto-countered` (reuse existing badge base + color tokens — `--color-overpriced` for pending, `--color-underpriced`/fair-green analog for auto-countered, matching the existing spread-badge palette, no new tokens), and a small `.card__counter-input` sized like existing form inputs.

**Tests:**
- `tests/submission.test.js` (extend): `PENDING_APPROVAL`/`AUTO_COUNTER_SENT` accepted as valid statuses.
- `tests/spreadConfigService.test.js` (extend): `DEFAULT_TIERS` autoApprove values per bracket; validator rejects non-boolean `autoApprove`; a tier omitting `autoApprove` defaults to `false`.
- `tests/spreadService.test.js` (extend): `matchedTier` is `null` with no `tierConfig`/no bracket match, and is the matched tier object (including `autoApprove`) otherwise.
- `tests/dispatchService.test.js` (new — the graded suite): constructor required-dep throws; `evaluate()` band matching (autoApprove tier + GREENLIGHT → `shouldAutoDispatch: true`; autoApprove tier + MARGINAL/PASS/NO_DATA → `false`; non-autoApprove tier + GREENLIGHT → `false`; no tier match → `false`); `dispatch()` auto path sets status `AUTO_COUNTER_SENT` and returns a formatted message matching the "Car Offer Beaters..." template; `dispatch()` manual path sets status `PENDING_APPROVAL` and calls an injected `notifier.notify` with a payload naming the CarBoyZ distro group; `formatCounterOfferMessage`/`buildApprovalNotification` formatting unit tests in isolation.
- `tests/ui.sellerSubmissionController.test.js` (extend): submitting with an injected `dispatchService` calls `dispatch()` with the created submission; omitting `dispatchService` behaves exactly as before (no throw, no call).
- `tests/ui.leadInboxController.test.js` (extend): `counterMessage` appears in the view model; `approveAndSend` updates status and returns the formatted message using the override amount when supplied.
- Regression: `npm test` must stay green across all existing tests (264 as of UOW-12, plus the same 3 pre-existing unrelated `locationAdapter.test.js` env flakes — confirm those are still the only pre-existing failures).
- Coverage: `node --test --experimental-test-coverage` on `DispatchService.js` (and the touched slices of `SpreadConfigService.js`/`SpreadService.js`/`LeadInboxController.js`) must clear the repo's 80% line/branch standard.

## Execution Instruction
Architecture staged above. Lead Developer (Claude Code) to proceed via `EnterPlanMode` before touching files, per repo precedent for materially new scope (new domain service + new action-pipeline wiring across 3 existing controllers + a schema change to `Submission`'s status enum).
