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

### UOW-15 — E2E Interactive Test Harness, QR Generator & Pending Session Stash

**Objective**
Build a dedicated E2E Test Harness & QR Generator tool alongside a Pending Session Stash to allow the Product Owner, a friend, and potential stakeholders to physically kick the tires on the entire pipeline — from scanning a live appraisal QR code to witnessing the 1-to-3 minute manual approval polling state update in real time.

**Acceptance Criteria** (as given by Product Owner)
1. Interactive Test Harness UI (`src/ui/TestHarnessView.js`)
   - Dedicated "Test Harness" / "Sandbox" tab in the navigation header.
   - Live Appraisal Generator: preset CarMax/Carvana appraisal sheet generator (realistic mock Year, Make, Model, VIN, Mileage, Competitor Offer Amounts across $5k/$15k/$25k/$45k brackets).
   - Dynamic QR Code Generator: a live, scannable QR code encoding the submission payload URL/data parameters.
   - One-Click Instant Inject: "Simulate Camera Snap" / "Inject Submission" button to fire `SellerSubmissionController` instantly without manual typing.
   - Batch Historical Data Seeder: "Seed 50 Historical Leads" button populating WON/LOST/AUTO_COUNTERED/MANUAL_APPROVED submissions spanning price tiers.
2. Pending Session Stash & Async Approval Listener (`src/services/SessionStashService.js`)
   - Session Stashing: on manual sign-off (`autoApprove === false` or deal score not `GREENLIGHT`), generate and store a `pendingSessionId` in client storage.
   - Seller Waiting Screen: "Evaluating Your Offer..." status screen with live pulse/spinner and polling listener.
   - Real-Time Resolution: a team member's "Approve & Send" click updates the stash and flips the seller's screen to "Offer Ready! We can pay you $X today."

### Prior UOW
UOW-14's staged content archived to `.hydrate/archive/UOW-14.md` (shipped and committed as `2938d23`).

### Architecture (Lead Architect step)

This UOW is **not** Fast-Path eligible: it introduces two new modules, wires two new cross-cutting dependencies into three existing controllers, and — per the design below — makes one deliberate, contained breaking change to `SellerSubmissionController.submitSubmission()`'s return shape. Full architecture is specified below so the Lead Developer can proceed directly to implementation without a second planning pass.

---

#### 1. QR Code Generation Strategy — zero-dependency, vanilla JS

**Decision: hand-rolled encoder, no new npm dependency, no CDN script.** The repo has two existing precedents for external code — an unpkg `<script>` global (`maplibre-gl`) and an `npm`-installed package vendored into `vendor/` for the import map (`@nemzilla/spatial-core`, `zod`, `h3-js`). Both were rejected here per the Product Owner's explicit ask for a clean, dependency-free generator: this is a small, self-contained algorithm (ISO/IEC 18004 QR encoding) well within "surgical" scope as a micro-utility, and avoids a third dependency-loading pattern in the codebase for something this contained.

**New file: `src/utils/qrEncoder.js`** (pure, no DOM — same tier as `src/utils/geo.js`).

Exports:
- `encodeQrMatrix(text, { errorCorrectionLevel = 'L' } = {})` → `boolean[][]` (the module matrix, `true` = dark). Pure function, fully deterministic for a given input.
- `renderQrSvg(matrix, { cellSize = 6, margin = 4 } = {})` → SVG markup string (a `<svg>` with a white background `<rect>` plus one `<rect>` per dark module — simplest, most robust rendering; no `<path>` merging needed at this scale). Pure string builder, no DOM access, safe to unit test.

Implementation notes for the Lead Developer (standard QR pipeline, all in `qrEncoder.js`, no external tables beyond what's inlined):
1. **Mode**: byte mode only (`0100`) — the payload is a URL/ASCII string, no need for numeric/alphanumeric/kanji modes.
2. **Version selection**: support versions 1–10 (up to 57×57 modules). Byte-mode capacity table (EC level L / M, the two levels this module supports) must be inlined as a small constant lookup (per-version data-codeword counts); pick the smallest version whose capacity ≥ payload length for the requested EC level, throw a clear error if the payload exceeds version 10's capacity (comfortably above what this UOW's payloads need — see §3 sizing below).
3. **Error correction**: support `'L'` (~7% recovery) and `'M'` (~15%); default `'L'` to maximize capacity/minimize module count, since the QR is displayed on a screen and scanned immediately (no print-damage tolerance needed) — smaller/less-dense codes scan more reliably off a screen.
4. **Encoding**: mode indicator + character count indicator + 8-bit data bytes + terminator + pad to codeword capacity, per spec.
5. **Error correction codewords**: Reed–Solomon over GF(256) — inline the log/antilog tables (generator polynomial computed from them); this is the one genuinely "algorithmic" piece but is well-documented and self-contained (no external reference implementation to copy verbatim — write it from the GF(256) math, not ported from a licensed library).
6. **Module placement**: standard zigzag data placement around finder/alignment/timing patterns, skipping reserved areas (finder patterns + separators, timing patterns, format-info area, one always-dark module, alignment pattern(s) for versions ≥ 2).
7. **Masking**: apply all 8 mask patterns, score each with the standard 4-rule penalty function, keep the lowest-penalty mask (this materially improves camera scan reliability over a fixed mask).
8. **Format/version info**: write the 15-bit format string (EC level + mask pattern, BCH-protected) into both format-info locations; version info blocks only needed ≥ version 7 (out of range for this UOW's payloads but implement per spec for correctness/headroom).

**Testing (`tests/qrEncoder.test.js`, new):** black-box only — no reference matrix comparison needed.
- `encodeQrMatrix` returns a square matrix whose size matches `((version - 1) * 4 + 21)` for a version implied by input length.
- Same input → identical matrix (determinism).
- Finder patterns present at the three expected corners (7×7 pattern check).
- Throws for a payload that exceeds version 10 capacity at the requested EC level.
- `renderQrSvg` output is a well-formed `<svg>` string whose `viewBox`/`width`/`height` match `matrix.length * cellSize + margin * 2`, and whose count of dark-module `<rect>` tags equals the number of `true` cells in the matrix.
- No literal round-trip-decode test (no decoder is being built) — correctness of the *encoding* is validated structurally per above; actual scannability is verified manually with a phone during the live test-drive, same as this repo's existing "test in the browser" precedent for UI work.

---

#### 2. Session Stash & Polling Storage Architecture

**New file: `src/services/SessionStashService.js`**, following the exact storage-service precedent already used by `SubmissionService`/`SpreadConfigService` (module-level `storageKey`/`readStash`/`writeStash` helpers, try/catch-silent on storage errors, constructor requires `tenantId`).

**Storage shape** — `localStorage` key `carboyz:sessionStash:${tenantId}` → JSON map:
```
{ [pendingSessionId]: { submissionId, status: 'PENDING' | 'READY', finalCounterOffer: number | null, updatedAt: ISOString } }
```

**Cross-tab live channel**: in addition to `localStorage` persistence (the durable source of truth, and the fallback poll target), the service opens a `BroadcastChannel('carboyz:sessionStash:${tenantId}')` when the constructor's `channel` param isn't overridden and `BroadcastChannel` exists in the environment (feature-detected — Node's test environment won't have it, tests inject a stub or omit it). `resolveBySubmissionId` posts a `{ type: 'RESOLVED', pendingSessionId, submissionId, finalCounterOffer }` message after writing to storage, giving other tabs an instant push instead of waiting for their next poll tick.

**API:**
- `constructor({ tenantId, storage = null, channel = null })` — same required/optional shape as sibling services; throws `SessionStashService requires a tenantId` if missing.
- `createPending(submissionId)` → generates `pendingSessionId` (`stash-${tenantId}-${Date.now()}-${random}`), writes a `PENDING` entry, returns the id.
- `resolveBySubmissionId(submissionId, { finalCounterOffer })` → finds the (most recent) `PENDING` entry for that `submissionId`, flips it to `READY` with the given `finalCounterOffer` and a fresh `updatedAt`, persists, posts the `BroadcastChannel` message, returns the updated entry (or `null` if no matching pending entry exists — not an error; a submission that was never stashed, e.g. auto-dispatched, simply has nothing to resolve).
- `getStatus(pendingSessionId)` → returns the stash entry or `null`.
- `subscribe(pendingSessionId, onResolved)` → attaches a `BroadcastChannel` `message` listener filtered to this `pendingSessionId`; returns an unsubscribe function. No-op subscribe (returns a no-op unsubscribe) when no channel is available — callers must not depend on `subscribe` alone, see below.

**Explicit scope boundary — this is same-browser, not cross-device:** both `localStorage` and `BroadcastChannel` are scoped to one browser's storage partition for one origin. Two tabs/windows of the *same browser* (e.g., a presenter's laptop with a "Sell" tab and a "Lead Inbox" tab side by side) get real-time resolution via the channel, with polling as the durable fallback. A QR code scanned by a genuinely separate device (a friend's own phone camera) opens its *own* browser context with no access to the presenter's `localStorage` or `BroadcastChannel` — it cannot receive the approval update, because this app has no server/backend component (confirmed: no server code in this repo, `npm start` is `npx serve .` over static files plus client-storage-backed services throughout). Making that scenario real would require introducing a backend, which is out of scope for this UOW and not something existing architecture supports. The demo path this UOW actually delivers: scan with a phone to land on a real, pre-filled Sell form and submit for real (see §3's prefill URL), then show the live approval flip either on that same phone reloading/polling its own submission, or side-by-side in two tabs on one machine for the full stash+channel experience. This boundary should be called out verbatim during the live test-drive so it isn't reported back as a bug.

**Wiring into existing controllers** (both changes additive/optional-dependency, matching the `dispatchService = null` / `spreadConfigService = null` precedent already used in this codebase):
- `SellerSubmissionController` gains an optional `sessionStashService` constructor dependency. In `submitSubmission(data)`, after `dispatchService?.dispatch?.(submission)` runs, if the result's `outcome === DISPATCH_OUTCOMES.PENDING_APPROVAL` (this *is* exactly "autoApprove === false or deal score is not GREENLIGHT" — it's `DispatchService.evaluate()`'s own `shouldAutoDispatch` check surfacing through `dispatch()`'s return value, so no changes to `DispatchService.js` are needed), call `sessionStashService.createPending(submission.id)`.
  - **Breaking-but-contained return-shape change**: `submitSubmission()` now returns `{ submission, pendingSessionId }` instead of a bare `Submission`, mirroring the `{ submission, message }` / `{ outcome, submission, ... }` shape already returned by `LeadInboxController.approveAndSend()` and `DispatchService.dispatch()` — this makes the new field discoverable the same way those are, instead of a separate stateful getter. `pendingSessionId` is `null` when no `sessionStashService` is configured or the dispatch outcome was auto-sent. Every existing caller/test that currently does `const submission = controller.submitSubmission(...)` must change to `const { submission } = controller.submitSubmission(...)` — confirmed low blast radius: only `tests/ui.sellerSubmissionController.test.js` (5 call sites) and `SellerSubmissionView.js`'s submit handler touch the return value.
- `LeadInboxController` gains an optional `sessionStashService` constructor dependency. In `approveAndSend(id, counterOfferAmount)`, after `updateFields(...)` runs, call `sessionStashService?.resolveBySubmissionId?.(id, { finalCounterOffer: counterOfferAmount })` — pure side effect, return shape of `approveAndSend` (`{ submission, message }`) is unchanged.
- `App.js`: instantiate one `SessionStashService` per tenant in `getTenantState()` (`storage: window.localStorage`, same pattern as `submissionService`/`spreadConfigService`), pass it into both controllers at construction in `render()`.

**Seller Waiting Screen** lives in `SellerSubmissionView.js` (extended, not a new file — it already owns the post-submit status UI): `renderSellerSubmissionView(controller, { sessionStashService, prefill } = {})`. On submit, if the returned `pendingSessionId` is non-null, swap the status text for a waiting-screen block (`.waiting-screen` — pulse/spinner via CSS animation, `role="status" aria-live="polite"` like the existing `statusEl`) showing "Evaluating Your Offer...". It both calls `sessionStashService.subscribe(pendingSessionId, onResolved)` for the instant path and starts a `setInterval` (~3s) calling `sessionStashService.getStatus(pendingSessionId)` as the documented, durable polling listener the ticket asks for (works even where `BroadcastChannel` isn't available). Either path calling into a shared `resolve(entry)` handler that clears the interval, unsubscribes, and swaps the waiting screen for "Offer Ready! We can pay you {currencyFormatter.format(entry.finalCounterOffer)} today." Interval/subscription are torn down on resolution to avoid leaked timers; this view function itself stays untested per this repo's existing precedent (no `*View.js` render function has direct tests — see `LeadInboxView.js`/`SellerSubmissionView.js` today; only `*Controller.js` and pure helper modules like `discoveryProgress.js`/`marketBadge.js` are tested).

---

#### 3. Test Harness & Seeder Layout — `src/ui/TestHarnessView.js`

Split, like every other view module in this app, into pure/testable exports plus one untested DOM-rendering function.

**Pure, exported, testable functions:**
- `PRICE_BRACKET_PRESETS` — 4 entries (`5k`, `15k`, `25k`, `45k`), each `{ key, label, offerRange: [min, max], vehicles: [{ year, make, model }, ...] }` with a small realistic pool per bracket (e.g. 5k: older Civic/Corolla/Altima; 15k: mainstream 5-8yr-old sedans/SUVs; 25k: newer SUVs/trucks; 45k: loaded trucks/near-new SUVs) and a `competitor` cycling between `'CarMax'`/`'Carvana'` per the ticket's "Preset CarMax/Carvana appraisal sheet".
- `generateVin(seedIndex)` — deterministic 17-char pseudo-VIN from a fixed charset excluding `I`/`O`/`Q` (matches real VIN rules), seeded by index so repeated calls in a seed batch don't collide.
- `buildMockAppraisal(bracketKey, seedIndex = 0)` → full data object shaped exactly like `SellerSubmissionView`'s form output (`vin, year, make, model, trim: null, mileage, zipCode, competitor, competitorDealerName: null, competitorOfferAmount, offerDocument: null`), picking a vehicle/offer amount from the bracket's pool/range deterministically off `seedIndex` (so the harness button can call it repeatedly with an incrementing counter to get varied-but-reproducible results, and it's trivially unit-testable: same `(bracketKey, seedIndex)` → same output; offer amount always within the bracket's `offerRange`).
- `encodeAppraisalForUrl(appraisal)` → compact pipe-delimited string (`carboyz-appraisal-v1|VIN|YEAR|MAKE|MODEL|MILEAGE|ZIP|COMPETITOR|OFFER`), not raw JSON — keeps the QR payload small (~60-90 bytes vs. ~150+ for JSON) so `qrEncoder.js` picks a low QR version, which scans more reliably off a screen. Versioned prefix (`carboyz-appraisal-v1`) so a future format change can be detected instead of silently misparsed.
- `decodeAppraisalFromUrlParam(raw)` → inverse of the above; throws/returns `null` on an unrecognized prefix or wrong field count (defensive, since this parses attacker-controllable-ish URL input — reject rather than partially populate the form).
- `buildPrefillUrl(baseUrl, appraisal)` → `${baseUrl}?tab=sell&pf=${encodeURIComponent(encodeAppraisalForUrl(appraisal))}`.
- `parsePrefillFromSearch(search)` → reads `pf` from `new URLSearchParams(search)`, returns `decodeAppraisalFromUrlParam(...)` or `null` if absent/invalid. Imported directly by `App.js`'s boot sequence (one-line call in `mountApp`, no new file needed for this glue).
- `HISTORICAL_OUTCOME_PRESETS` — 4 entries for `WON`, `LOST`, `AUTO_COUNTERED`, `MANUAL_APPROVED`, each mapping to the exact `{ status, winLossStatus, approvalType }` triple consistent with UOW-14's schema/state-machine (e.g. `AUTO_COUNTERED` → `{ status: 'AUTO_COUNTER_SENT', winLossStatus: 'AUTO_COUNTERED', approvalType: 'AUTO_DISPATCH' }`; `MANUAL_APPROVED` → `{ status: 'AUTO_COUNTER_SENT', winLossStatus: 'MANUAL_APPROVED', approvalType: 'HUMAN_APPROVED' }`; `WON`/`LOST` → same shape as `MANUAL_APPROVED`'s dispatch state with `winLossStatus` overridden to `WON`/`LOST`, matching what `markWinLoss` would have produced from a previously-approved lead).
- `buildHistoricalSubmissionPatch(bracketKey, outcomeKey, seedIndex)` → pure function combining `buildMockAppraisal` with a computed `calculatedCounterOffer`/`finalCounterOffer`/`expectedMargin`/`priceBracket`/`timeToCounterMs` (a past, randomish-but-deterministic delta) and a **past** `timestamp` (spread over the last ~90 days, deterministic off `seedIndex`), returning `{ submitData, updatePatch }` — `submitData` is what `submissionService.submit()` receives (including the backdated `timestamp`), `updatePatch` is what `submissionService.updateFields(created.id, updatePatch)` applies immediately after (status/winLossStatus/telemetry fields) — this two-step mirrors exactly how `DispatchService`/`LeadInboxController` already move a submission from intake to a resolved state, and is required because `SubmissionService.submit()` hardcodes `status: 'NEW'` on intake.
- `seedHistoricalLeads(submissionService, { count = 50 } = {})` → loops `count` times cycling deterministically through the 4×4 bracket×outcome grid (`brackets[i % 4]`, `outcomes[Math.floor(i / 4) % 4]`), calling `submit()` then `updateFields()` per the above, returns the array of final (post-patch) submissions. Takes a `submissionService` directly (no DOM) — fully unit-testable with a real `SubmissionService` instance, same style as `dispatchService.test.js`.

**DOM-rendering function (untested, same tier as `renderLeadInboxView`/`renderSellerSubmissionView`):**
`renderTestHarnessView({ sellerController, submissionService, tenantId })` → `{ section }`:
- 4 bracket buttons. Clicking one advances a local seed counter, calls `buildMockAppraisal(bracketKey, seedCounter++)`, renders the appraisal into a small preview panel, builds the prefill URL via `buildPrefillUrl(window.location.origin + window.location.pathname, appraisal)`, runs it through `qrEncoder.js`'s `encodeQrMatrix` + `renderQrSvg`, and injects the SVG string into a `.harness__qr` container (`innerHTML` — self-generated markup, not user input, so this is safe; consistent with `renderDocumentModal`'s existing use of `img.src`/`href` for user content elsewhere, which is *not* what's happening here).
- "Simulate Camera Snap / Inject Submission" button (enabled once a preset has been generated): calls `sellerController.submitSubmission(currentAppraisal)` directly and prints a one-line result (submission id, and "Pending sign-off" vs. "Auto-countered" based on whether `pendingSessionId` came back) into a `role="status"` element — same status-line convention as `SellerSubmissionView`.
- "Seed 50 Historical Leads" button: calls `seedHistoricalLeads(submissionService, { count: 50 })`, reports "Seeded 50 historical leads." — idempotent-safe to click multiple times (each click adds another 50 with fresh ids; no dedup needed for a sandbox tool).

**`App.js` wiring:**
- Add a 7th nav tab, `'harness'` → "Test Harness", following the exact `renderTabs`/tab-visibility pattern already used for all 6 existing tabs (no new gating/dev-mode concept introduced — the codebase has no environment-flag infrastructure today, and the existing "Admin" tab is already unconditionally visible, so Test Harness is added the same way rather than inventing a dev-mode system unrequested by any other part of this app).
- `mountApp`: call `parsePrefillFromSearch(window.location.search)` once at boot; if it returns non-null, set the initial `activeTab = 'sell'` and stash the decoded appraisal in a `pendingPrefill` variable consumed by the first `render()` call's `renderSellerSubmissionView(sellerController, { sessionStashService: state.sessionStashService, prefill: pendingPrefill })`, then clear `pendingPrefill` so later re-renders (tenant switch, tab change) don't reapply a stale prefill.
- `SellerSubmissionView.js`'s `renderSellerSubmissionView` applies `prefill` (if present) by setting the relevant inputs' `.value` before returning the section, and firing the existing `competitorSelect`'s `change` handler logic if `prefill.competitor === 'Other'` (not reachable from the harness's CarMax/Carvana-only presets today, but keep the form's existing invariants intact for any future preset).

---

### Testing Summary (new/extended)
- `tests/qrEncoder.test.js` (new) — structural encode/render checks per §1.
- `tests/sessionStashService.test.js` (new) — create/resolve/getStatus, no-matching-pending-entry returns null, `BroadcastChannel` message posted on resolve (inject a stub channel), storage-unavailable no-throw precedent.
- `tests/ui.testHarnessView.test.js` (new) — `buildMockAppraisal` determinism + bracket bounds, VIN format/uniqueness across a batch, `encodeAppraisalForUrl`/`decodeAppraisalFromUrlParam` round-trip + rejection of malformed input, `buildHistoricalSubmissionPatch` produces schema-valid enum combinations for all 4 outcomes, `seedHistoricalLeads` against a real `SubmissionService` asserts 50 created, outcome/bracket distribution, and every produced submission passes `Submission` construction (implicitly, since `submissionService.submit`/`updateFields` construct real `Submission` instances and would throw on an invalid enum/number).
- `tests/ui.sellerSubmissionController.test.js` (extended) — update the 5 existing call sites to the new `{ submission }` destructure; add: `pendingSessionId` returned when a `sessionStashService` + manual-approval `dispatchService` result are present; `null` when no `sessionStashService` configured; `null` on an auto-dispatch outcome.
- `tests/ui.leadInboxController.test.js` (extended) — `approveAndSend` calls `sessionStashService.resolveBySubmissionId` with the override amount when configured; no-op/no-throw when not configured.
- Regression: full `npm test` must stay green (the same pre-existing `locationAdapter.test.js` env flakes are the only expected failures, per every prior UOW's journal entry).
- Coverage: 80% line/branch standard applies to `qrEncoder.js`, `SessionStashService.js`, `TestHarnessView.js`'s pure exports, and the touched slices of `SellerSubmissionController.js`/`LeadInboxController.js`.

### Other file touches
- `src/ui/styles.css` — waiting-screen pulse/spinner keyframes, `.harness__*` layout classes for the bracket buttons/QR panel/preview.
- No changes to `index.html` (no CDN script needed — see §1) and no changes to `package.json` (no new dependency).

## Execution Instruction
Architecture fully specified above, including the three areas the Product Owner flagged explicitly (zero-dependency QR encoder, localStorage+BroadcastChannel stash architecture, detailed TestHarnessView layout). Lead Developer (Claude Code) to proceed directly with implementation and verification per Fast-Path Protocol §3 (One-Shot Context Transition) — architecture is fully defined, so no secondary plan-approval cycle is required before writing code — but flag the one deliberate breaking change (`submitSubmission()`'s return shape) and the same-browser/no-cross-device scope boundary to the Product Owner in the session summary, since both affect how the live test-drive should be framed.
