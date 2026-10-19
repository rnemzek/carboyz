# Developer Journal — CarBoyZ

## [UOW-25] Offline Workbox PWA Service Worker & Background Sync Queue — 2026-09-02

**Approach:** No `workbox` npm dependency was added — kept the zero-dependency/ESM-first
precedent by hand-rolling the two Workbox patterns the UOW actually needed: app-shell
precaching on `install` and cache-first-with-background-revalidate (stale-while-revalidate)
runtime caching on `fetch`, both cleaned up on `activate`.

The pure, testable caching decisions (which URLs to precache, which requests are cacheable,
which old cache names to evict) live in a new `src/services/OfflineCachePolicy.js` so they're
unit-testable in Node without `self`/`caches` globals. `src/sw.js` is the thin browser-only
orchestration layer that wires those helpers to the real `install`/`activate`/`fetch` service
worker lifecycle events — consistent with the project's existing precedent of leaving DOM/worker
glue (e.g. `App.js`, View files) untested at that layer while the logic underneath is covered.

`TenantConfigService.registerServiceWorker(swUrl = '/src/sw.js')` registers it with
`{ type: 'module', scope: '/' }` (an injectable `navigator`, mirroring the existing `document`
DI pattern) and swallows registration failures via `.catch(() => null)` — same graceful-
degradation precedent as `PwaInstallPromptView`'s platform detection. `App.js` calls it once in
`mountApp()`.

**Offline submission queue:** Rather than repurposing `Submission.status` (whose enum is
validated by the `Submission` model, out of this UOW's surgical scope) into a `PENDING_SYNC`
value, `SubmissionService` tracks queue membership as a separate id list persisted under its own
`carboyz:submissions:pendingSync:<tenantId>` storage key. `submit()` auto-enqueues when an
injectable `isOnline()` (defaults to `navigator.onLine`) reports offline;
`getSyncState(id)` exposes the `PENDING_SYNC`/`SYNCED` state machine described in the UOW without
touching the `Submission` model or its validation. `flushPendingSync(syncFn)` replays each queued
submission through `syncFn` (in practice `syncAdapter.submitSubmissionCreated`) and leaves an
entry queued (for retry) if `syncFn` throws, rather than dropping it.

**Auto-resync on reconnect:** `App.js` listens for `window`'s `online`/`offline` events. `online`
flushes every cached tenant's queue through its `SyncAdapter` and re-renders; `offline` just
re-renders to show the banner. A tenant's queue is also flushed once at first `getTenantState()`
construction (covers reload-while-online with a stale queue left over from a prior offline
session).

**Offline status indicator:** New `renderOfflineBanner()` in `App.js` (new `.offline-banner` CSS
rule, styled like the existing `.sync-toast` pattern) shown in the app shell whenever `isOffline`
is true.

**Edge cases handled:** queued ids for submissions that no longer exist are filtered out on
rehydrate; duplicate `enqueueForSync` calls for the same id are no-ops; `flushPendingSync` with an
empty queue or no `syncFn` is a safe no-op; `registerServiceWorker` degrades to `null` with no
`navigator`/`serviceWorker`/on a rejected registration promise; `isCacheableRequest` rejects
non-GET requests, the `/ws` relay upgrade path, and malformed URLs.

**Files touched:** new `src/sw.js`, new `src/services/OfflineCachePolicy.js`,
`src/services/SubmissionService.js`, `src/services/TenantConfigService.js`, `src/ui/App.js`,
`src/ui/styles.css`, plus new/extended unit tests in `tests/offlineCachePolicy.test.js`,
`tests/submissionService.test.js`, `tests/tenantConfigService.test.js`.

**Verification:** `npm test` → 506/506 passing (zero regressions). Coverage on new/modified
modules: `OfflineCachePolicy.js` 100%/100% (line/branch), `SubmissionService.js` 93.51%/91.94%,
`TenantConfigService.js` 94.53%/95.00% — all above the 80% gate. `App.js` (DOM-mounting glue) is
untested at that layer, consistent with the project-wide convention documented in prior UOW
journals; the service worker's own lifecycle (`install`/`activate`/`fetch` against real `self`/
`caches`) was not exercised in a browser this session — flagging as unverified in a live PWA
install/offline round-trip.

## [UOW-22] LocationAdapter Network Assertion Repair — 2026-09-01

**Root cause:** Not an adapter logic bug — a test-isolation gap. `resolveApiKey()` in
`src/adapters/locationAdapter.js` falls back to `process.env.GOOGLE_PLACES_API_KEY` whenever
`options.apiKey` isn't explicitly passed. The 3 failing tests in `tests/locationAdapter.test.js`
assert "no API key configured → no network call," but the developer's ambient shell/`.env.local`
had `GOOGLE_PLACES_API_KEY` set, so the offline-gazetteer-fallback tests unintentionally routed
through the real Google Places geocoder path and tripped their `fetchImpl` mocks.

**Fix:** Added `before`/`after` hooks (`node:test`) at the top of
`tests/locationAdapter.test.js` that save, delete, and restore `process.env.GOOGLE_PLACES_API_KEY`
around the whole file, so "no apiKey option" deterministically means "no API key configured"
regardless of host environment. No production code in `src/adapters/locationAdapter.js` changed —
its fallback ordering (Google → OSM if enabled → offline gazetteer) was already correct.

**Files touched:** `tests/locationAdapter.test.js` (test isolation only).

**Verification:** `npm test` → 476/476 passing (was 473/476). Coverage on
`src/adapters/locationAdapter.js`: 100% line, 81.33% branch (gate: 80% line+branch) — meets the
quality gate.

## [UOW-23] Structural Codebase Audit & RECONSTRUCTED_STATE.md — 2026-09-02

**Scope:** No production code changed. Read every file in `src/` (58 files across
adapters/config/core/models/server/services/ui/utils) plus `package.json`, ran `npm test`
(476/476 passing) and `node --test --experimental-test-coverage`, and wrote
`docs/RECONSTRUCTED_STATE.md` — a ground-truth inventory of what's implemented, what's tested,
and what's stubbed/missing, superseding assumptions in `docs/REBUILD_ANALYSIS.md`.

**Key findings:**
- Every domain model, adapter, and service is fully implemented (no stubs/TODOs found anywhere
  in `src/`). The "spread/pricing policy engine" the roadmap doc listed as an MVP gap already
  exists: `SpreadService.js` + `SpreadConfigService.js` + `DispatchService.js`, all tested.
- Coverage gap (66.84% overall line, 91.27% branch) is concentrated entirely in DOM-mounting
  view functions (`App.js` 16%, `MapView.js` 10%, `SellerSubmissionView.js` 5%, etc.) — a
  consistent, intentional convention (thin DOM glue over fully-tested controllers/logic), not
  scattered incompleteness. Controllers, models, services, and adapters all meet or nearly meet
  the 80% gate.
- Confirmed real gaps vs. the roadmap: no isolated per-tenant backend (server is one shared
  Hono+ws process, two stub routes, no persistence); no QR-based phone-to-desktop session
  handoff wiring; no offline service worker/Workbox queue anywhere in `src/`; no policy
  mutation ledger/versioning/audit trail (`SpreadConfigService.saveConfig()` overwrites
  localStorage with no history); no analytics version-pinning or what-if simulation engine.
- Two standout hand-written implementations worth flagging for future work: a zero-dependency
  ISO/IEC 18004 QR encoder (`utils/qrEncoder.js`) and a spec-correct ISO 3779/NHTSA VIN
  check-digit + WMI decoder (`utils/vinScanner.js`).

**Files touched:** `docs/RECONSTRUCTED_STATE.md` (new).

**Verification:** `npm test` → 476/476 passing (unchanged, no production code modified).


## [UOW-24] Mobile QR Session Stash & Live Desktop Inbox Relay Handoff — 2026-09-02

**Summary:** Wired `qrEncoder.js` and `SessionStashService` into the Lead Inbox and Mobile
Intake views to close the QR pairing gap flagged in the architect's rebuild audit. The
underlying real-time desktop sync (`SellerSubmissionController` → `SyncAdapter` →
`LeadInboxView`) was already fully implemented from prior UOWs; this UOW added the missing
QR-pairing session lifecycle on top of it.

**Implementation:**
- `SessionStashService.js`: added `createPairingSession()` (stashes a `PENDING`/`PAIRING`
  entry), `connectPairingSession(pairingSessionId)` (flips it to `CONNECTED` and posts a
  `PAIRING_CONNECTED` broadcast message), and `subscribeToPairingConnected(...)` (filtered
  channel listener, mirroring the existing `subscribe`/`resolveBySubmissionId` pattern for the
  approval flow). Generalized `generateSessionId(prefix)` to share id generation between the
  `stash-` (submission approval) and `pair-` (QR pairing) id families.
- `LeadInboxController.js`: added `createPairingSession({ baseUrl })`, which asks
  `sessionStashService` for a pairing id and returns `{ pairingSessionId, url }` (throws if no
  `sessionStashService` is configured), and `subscribeToPairingConnected(...)` delegating
  through to the service (safe no-op without one).
- `LeadInboxView.js`: new "Pair Mobile Device" card rendering a QR code (via
  `qrEncoder.encodeQrMatrix` + `renderQrSvg`) for the pairing URL, with live status text that
  flips from "Waiting for a mobile device to scan..." to "Device connected!" on the
  `PAIRING_CONNECTED` broadcast.
- `SellerSubmissionController.js`: added `bindPairingSession(pairingSessionId)`, delegating to
  `sessionStashService.connectPairingSession` (no-op without an id or a configured service).
- `SellerSubmissionView.js`: on render, parses `?sessionId=...` from `window.location.search`
  and calls `controller.bindPairingSession(...)` once, binding the mobile session to the
  desktop-generated pairing id from the scanned QR code.

**Edge cases handled:** no `sessionStashService` configured (both controllers), missing/absent
`sessionId` query param, scanning a pairing QR whose entry has already expired/been reused
(non-`PAIRING`-type or unknown id → `connectPairingSession` returns `null`), unsubscribe
correctly stops delivery after a re-generated pairing code.

**Files touched:** `src/services/SessionStashService.js`, `src/ui/LeadInboxController.js`,
`src/ui/LeadInboxView.js`, `src/ui/SellerSubmissionController.js`,
`src/ui/SellerSubmissionView.js`, plus new unit tests in `tests/sessionStashService.test.js`,
`tests/ui.leadInboxController.test.js`, `tests/ui.sellerSubmissionController.test.js`.

**Verification:** `npm test` → 488/488 passing (476 existing + 12 new, zero regressions).
Coverage on modified services/controllers: `SessionStashService.js` 97.97%/97.37%
(line/branch), `LeadInboxController.js` 100%/97.37%, `SellerSubmissionController.js`
100%/100% — all well above the 80% gate. View files (`LeadInboxView.js`,
`SellerSubmissionView.js`) are untested at the DOM level, consistent with the project-wide
convention (no jsdom harness; all View files are thin DOM glue over tested
controllers/services, per the UOW-23 audit). Manually verified `qrEncoder` round-trips a
realistic pairing URL into a valid SVG matrix without hitting the version-10 capacity ceiling.


## [UOW-26] Policy Versioning & Immutable Cryptographic Audit Ledger — 2026-09-02

**Summary:** Closed the last flagged Epic 2 gap: `SpreadConfigService.saveConfig()` previously
overwrote `localStorage` with no history. It now assigns semantic policy versions (`v1.0.0`,
`v1.1.0`, ...) and appends every mutation to a new hash-chained, append-only audit ledger.

**Implementation:**
- `src/services/AuditLedgerService.js` (new): append-only, hash-chained ledger keyed per
  tenant (`carboyz:auditLedger:<tenantId>`). Each block records `sequence`, `timestamp`,
  `authorId`, `previousConfigHash`, `newConfigHash`, `diffPayload` (per-competitor,
  per-tier-index change list from `diffConfigs()`), `previousBlockHash`, and `blockHash`
  (hash of the rest of the block, chaining to the prior block). `verifyChainIntegrity()`
  walks the chain recomputing hashes to detect tampering.
  Hashing uses a hand-written, dependency-free, **synchronous** SHA-256 (`sha256Hex`),
  verified byte-for-byte against Node's `crypto.createHash('sha256')` on multiple vectors
  (empty string, `'abc'`, 1000-char string, JSON, NIST-style pangram) before use. Chose this
  over `crypto.subtle.digest` (which is Promise-only) specifically to avoid making
  `saveConfig()` async — the UI's `SpreadConfigView.js` save/reset handlers do synchronous
  `try/catch` validation-error handling that an async boundary would have silently broken.
  `canonicalize()` sorts object keys before hashing so hash equality doesn't depend on key
  insertion order.
- `src/models/PolicySnapshot.js` (new): immutable point-in-time capture of a tenant's active
  `policyVersionId` + `tiersByCompetitor` + `configHash`, defensively cloned on construction.
- `src/services/SpreadConfigService.js`: constructor now builds (or accepts an injected)
  `AuditLedgerService`. `saveConfig(nextConfig, { authorId = 'system' } = {})` and
  `resetToDefault(authorId = 'system')` both route through a new shared `applyConfig()` that
  bumps the policy version (`bumpPolicyVersion()`: increments minor, resets patch — new
  tenants start at `v1.0.0`) and records the mutation on the ledger before persisting. Added
  `getActivePolicyVersionId()` and `getActivePolicySnapshot()`. `authorId` is optional and
  additive, so every pre-existing `saveConfig({...})` call site keeps working unchanged.
- `src/services/SpreadService.js`: `calculateSpread()` takes an optional `policyVersionId`
  (default `null`) and echoes it straight back onto the result, on both the priced and
  `NO_DATA` return paths — mirrors the existing `matchedTier` pass-through pattern.
- `src/services/DispatchService.js`: `evaluate()` now calls
  `spreadConfigService.getActivePolicyVersionId()` and passes it into `calculateSpread()`;
  `dispatch()` writes `spreadResult.policyVersionId` onto the `Submission` via
  `updateFields()` on both the auto-dispatch and manual-approval branches, pinning the policy
  version active at the moment of pricing.
- `src/models/Submission.js`: added optional `policyVersionId` (string or null; validated,
  defaults to `null`). `LeadInboxController.approveAndSend()`'s later `updateFields()` call
  doesn't touch it, so the version pinned at intake survives manual approval untouched (it
  spreads the existing `Submission` instance's own properties before applying the patch).

**Edge cases handled:** malformed/missing `previousConfig` on the ledger chains to the genesis
hash (`'0'.repeat(64)`) rather than throwing; `bumpPolicyVersion()` falls back to
`v1.0.0` for missing/malformed version strings; tampering with any prior block is detectable
via `verifyChainIntegrity()`; two tenants keep fully separate ledgers and policy versions in
shared storage; an injected `auditLedgerService` (e.g. a test double) is honored instead of the
default.

**Files touched:** `src/services/AuditLedgerService.js` (new), `src/models/PolicySnapshot.js`
(new), `src/services/SpreadConfigService.js`, `src/services/SpreadService.js`,
`src/services/DispatchService.js`, `src/models/Submission.js`, plus new/extended tests in
`tests/auditLedgerService.test.js` (new), `tests/policySnapshot.test.js` (new),
`tests/spreadConfigService.test.js`, `tests/spreadService.test.js`, `tests/dispatchService.test.js`,
`tests/submission.test.js`.

**Verification:** `npm test` → 541/541 passing (506 existing + 35 new, zero regressions).
Coverage on new/modified services and models (`node --test --experimental-test-coverage`):
`AuditLedgerService.js` 97.82%/91.67% (line/branch), `PolicySnapshot.js` 100%/94.74%,
`SpreadConfigService.js` 94.77%/91.23%, `SpreadService.js` 100%/93.10%, `DispatchService.js`
100%/97.06%, `Submission.js` 100%/100% — all clear the 80% line/branch gate.

## UOW-27: Synthetic Submission Generator & Time-Series Historical Policy State Seeder

**Files touched:** `src/ui/TestHarnessView.js`, `src/ui/App.js`, `tests/ui.testHarnessView.test.js`.
`src/utils/seedInventory.js` and `src/services/AuditLedgerService.js` were left unmodified —
the generator/seeder logic fits the existing pure-function tier already established in
`TestHarnessView.js` (`buildMockAppraisal`, `buildHistoricalSubmissionPatch`,
`seedHistoricalLeads`), and the timeline seeder reuses `AuditLedgerService`/`SpreadConfigService`
as-is rather than adding new surface area to either.

**Implementation:**
- `buildSyntheticSubmission(seedIndex, config)` / `buildSyntheticSubmissions(count, config)` —
  deterministic generator producing schema-valid `Submission` payloads across a selectable
  `daysBack` date range, a selectable `makes` filter (falls back to the full pool if the filter
  matches nothing), and `competitorSources` (`CarMax`, `Carvana`, `Hendrick`). `Hendrick` isn't in
  the `Submission` model's fixed `COMPETITORS` enum, so it maps to `competitor: 'Other'` +
  `competitorDealerName: 'Hendrick'`, mirroring how a real seller reports an unlisted competitor.
- `seedHistoricalPolicyTimeline(...)` — seeds a sequential `v1.0.0 -> v1.1.0 -> v1.2.0` chain into
  `AuditLedgerService` via `SpreadConfigService`, backdating each mutation across `daysBack` by
  temporarily overriding `auditLedgerService.now` per entry (restored in a `finally`). Returns
  `segments` (`{ policyVersionId, daysAgo }`), each the version active from `daysAgo` days ago up
  to the next segment.
- `resolveActivePolicyVersion(segments, daysAgo)` — pure lookup used to tag each generated
  submission with the policy version that was actually active at its own timestamp.
- `seedHistoricalSubmissionPool(...)` — the one-click orchestrator: seeds the policy timeline,
  generates `count` synthetic submissions across the same window, and submits each one tagged
  with its resolved `policyVersionId`.
- Test Harness UI: three new "Seed {30,60,90}-Day Pool" buttons wired to
  `seedHistoricalSubmissionPool`. `renderTestHarnessView` now also accepts an optional
  `spreadConfigService` so pool seeding mutates the tenant's real audit ledger (visible in the
  Spread Config / Analytics views) instead of a disconnected instance; `App.js` now passes
  `state.spreadConfigService` through at the call site.

**Verification:** `npm test` → 550/550 passing (541 existing + 9 new, zero regressions).
`node --test --experimental-test-coverage`: all new business logic in `TestHarnessView.js` is
covered (only the pre-existing, already-untested DOM-rendering `renderTestHarnessView`/
`renderAppraisalPreview` functions are uncovered, unchanged from before this UOW — same
untested-by-convention tier as `App.js`/`renderLeadInboxView`).

## UOW-28: Analytics Policy Version Pinning, Dynamic Filters & Responsive Layout

**Files touched:** `src/services/AnalyticsService.js`, `src/ui/AnalyticsController.js`,
`src/ui/AnalyticsView.js`, `src/ui/styles.css`, `src/ui/App.js`, `tests/analyticsService.test.js`,
`tests/ui.analyticsController.test.js`.

**Implementation:**
- `AnalyticsService.js`:
  - `DATE_RANGE_PRESETS` gains `LAST_60_DAYS`/`LAST_90_DAYS` (additive — `LAST_7_DAYS`/
    `LAST_30_DAYS`/`ALL_TIME` untouched) with matching `resolveSinceDate()` branches.
  - `filterSubmissions()` gains `priceTier` (matched via the existing `priceTierForAmount()`) and
    `approvalType` predicates, threaded through `AnalyticsService.getMetrics()`.
  - `computeTimeSeries(submissions)` buckets by calendar day (UTC) into
    `{ date, volume, winRate, totalExpectedMargin }`, ascending — feeds the new chart. Folded into
    `computeMetrics()` as `metrics.timeSeries`.
  - `derivePolicyVersionPins(chain)` + `AnalyticsService.getPolicyVersionPins()` (new optional
    `auditLedgerService` constructor dependency, defaults to `null` → `[]`). `AuditLedgerService`'s
    ledger entries only carry config hashes, not the raw `policyVersionId`, so the version per
    entry is reconstructed by replaying `SpreadConfigService.bumpPolicyVersion()` once per entry
    starting from `INITIAL_POLICY_VERSION_ID` — mirroring exactly how `saveConfig()`/
    `resetToDefault()` already advance the version on every mutation they record. `AuditLedgerService`
    and `SpreadConfigService` were left unmodified (out of this UOW's target scope); only their
    already-exported pure helpers/getters are reused.
  - Re-exports `APPROVAL_TYPES` from `models/Submission.js` so the controller/view have one import
    surface for filter option constants (mirrors the existing `PRICE_TIERS` pattern).
- `AnalyticsController.js`: `getPriceTierOptions()`, `getApprovalTypeOptions()`,
  `getPolicyVersionPins()` (delegates), and `buildViewModel()` now threads `priceTier`/
  `approvalType` alongside the existing `dateRange`/`competitor`.
- `AnalyticsView.js`: added Price Band and Approval Type filter `<select>`s alongside the existing
  two; added a "Conversion Trend" and "Margin Trend" chart pair rendered as hand-built SVG markup
  strings set via `.innerHTML` (matching the existing `qrEncoder.js` → `renderQrSvg()` precedent in
  this codebase for SVG, since the shared `h()` DOM builder uses `document.createElement` and can't
  produce real namespaced SVG nodes). Each chart overlays dashed vertical lines + labels for every
  policy version pin, positioned on the same linear time axis as the data line.
- `styles.css`: `.analytics__filters` now wraps (`flex-wrap` + `flex: 1 1 140px` per filter) so 4
  filters reflow on narrow viewports instead of overflowing; new `.analytics__charts` grid
  (`auto-fit, minmax(280px, 1fr)`) stacks the two charts to one column on mobile automatically;
  new `.analytics-chart__*` rules style the SVG line/points/pin overlay.
- `App.js`: `AnalyticsService` now receives `spreadConfigService.auditLedgerService` — reusing the
  existing public `auditLedgerService` instance property `SpreadConfigService` already exposes
  (same access pattern `TestHarnessView.seedHistoricalPolicyTimeline()` already relies on), no new
  service instance created.

**Verification:** `npm test` → 563/563 passing (550 existing — 1 pre-existing assertion updated
for the new preset count, see below — + 13 new, zero regressions). `node --test
--experimental-test-coverage` on the three modified controller/service files:
`AnalyticsService.js` 100%/98.73% line/branch, `AnalyticsController.js` 100%/100% — both clear the
80% gate. `AnalyticsView.js` (DOM-rendering, presentational) is intentionally excluded from the
coverage gate per the UOW's own acceptance criterion wording ("controller and service logic") and
this repo's existing convention — no `*View.js` file has a dedicated unit test suite.
`tests/ui.analyticsController.test.js`'s `getDateRangePresets returns all 3 presets` test was
updated (not just added-to) to assert all 5 presets, since it exact-matches the enum by design —
extending `DATE_RANGE_PRESETS` necessarily changes that expectation.

**Manual smoke test:** started the static server (`node scripts/generate-runtime-config.js &&
node scripts/vendor-spatial-core.js && npx serve .`) and confirmed `index.html` and all three
modified modules serve without error. No headless-browser driver (`chromium-cli`, Playwright,
Puppeteer) was available in this environment, so the rendered chart/filter UI was **not**
visually verified in an actual browser — only unit-tested and code-reviewed. Flagging this

## [UOW-CARBOYZ-29] Counterfactual "What-If" Scenario Simulation Engine — 2026-09-02

**New files:** `src/services/SimulationService.js`, `src/ui/SimulationController.js`,
`src/ui/SimulationView.js`. **Modified:** `src/ui/App.js` (nav wiring), `src/ui/BottomNavView.js`
(new `simulation` tab), `src/ui/styles.css` (`.comparison-row`/`.comparison-card` for the
side-by-side KPI layout).

**Core design problem:** a historical `Submission` only records the counter offer it actually
received, not the `fairMarketValue` `SpreadService.calculateSpread()` used to derive it — and
`SpreadService.js` is out of this UOW's target scope, so it couldn't be changed to carry FMV
forward. Solved by inverting the already-established relationship
`expectedMargin = estimatedWholesaleValue - finalCounterOffer` (see `DispatchService.dispatch()` /
`LeadInboxController.approveAndSend()`) to reconstruct `fairMarketValue` from each closed
submission's own stored fields. Only WON/LOST submissions with both `expectedMargin` and
`finalCounterOffer` present are replayable (`isSimulatable()`); everything else is counted in
`excludedCount` but skipped.

**Second design problem — win-rate had to actually respond to policy changes:**
`calculateSpread()`'s `status` (GREENLIGHT/MARGINAL/PASS) is derived purely from
`fairMarketValue` and `competitorOfferAmount` — it never varies with `tierConfig`, only
`recommendedCounterOffer`/`matchedTier` do. A projection that called `calculateSpread()` once and
read `.status` off it would report a Win Rate Shift of exactly 0% for every candidate config,
which would make the whole feature look broken. Fixed by scoring viability on what's left over
*after* paying the candidate's recommended counter offer: a second `calculateSpread()` call
treats that counter offer as the amount paid out (`tierConfig: []`, `counterOfferOffset: 0`, so
nothing further stacks on top), reusing `calculateSpread()`'s own GREENLIGHT/MARGINAL/PASS
thresholds instead of duplicating the magic 1000/300 constants. A projected deal counts as "won"
when that leftover margin clears PASS. This measures projected deal profitability under the
candidate policy, not seller-acceptance odds — there's no seller-behavior model anywhere in this
codebase to project the latter, and inventing one would be well outside surgical scope. Documented
inline in `SimulationService.js` so a future reader doesn't mistake it for an acceptance-
probability model.

Auto-approval volume delta mirrors `DispatchService.evaluate()`'s live rule exactly
(`matchedTier.autoApprove && spreadResult.status === GREENLIGHT`, using the *first*, real
`calculateSpread()` call) — so it responds directly to the candidate tier's own `autoApprove` flag
per price bracket, same as production dispatch would.

**Reuse over new abstractions:** `simulateCandidatePolicy()` validates the candidate config via
`SpreadConfigService.validateConfig()` rather than duplicating tier-shape validation.
`SimulationController.buildCandidateSeed()` reads the live config off `spreadConfigService` to
seed the candidate editor, but `simulateCandidatePolicy()` never calls `saveConfig()`/
`applyConfig()` — nothing mutates active policy state. `SimulationView.js`'s tier-row form
controls are a trimmed copy of `SpreadConfigView.js`'s `renderTierRow()`/`renderCompetitorSection()`
pattern (candidate-only, no remove/add-row or persistence, since this editor is scratch space for
a single run, not a saved config).

**Acceptance criteria — "margin caps":** the UOW text mentions margin caps as a candidate lever
alongside tier offsets and auto-approval thresholds, but no margin-cap concept exists anywhere in
`SpreadConfigService`/`SpreadService` today (only flat/percent tier offsets + `autoApprove`).
Introducing a new margin-cap field would mean extending `SpreadConfigService`'s config schema,
which is out of this UOW's target scope (`SpreadService.js`/`SpreadController.js`/`SpreadView.js`
were not listed) — deferring rather than inventing a schema change unilaterally.

**Verification:** `npm test` → 574/574 passing (563 existing + 11 new, zero regressions).
`node --test --experimental-test-coverage` on the new service/controller:
`SimulationService.js` 100%/84.85% line/branch, `SimulationController.js` 100%/90.91% — both clear
the 80% gate. `SimulationView.js` is intentionally excluded from the coverage gate, matching this
repo's existing convention (no `*View.js` has a dedicated unit test suite — DOM rendering is
covered by syntax-checking + manual reasoning only, not `document`-dependent unit tests, since the
test runner has no DOM available).

**Not done:** no headless-browser driver was available in this environment, so the new Simulation
tab's rendered UI (tier-row inputs, Run Simulation button, side-by-side comparison cards) was
**not** visually verified in an actual browser — only unit-tested (service/controller) and
syntax-checked (`node --check` on all four touched/new files).
explicitly per the UI-testing guideline rather than claiming a browser check that didn't happen.

## [UOW-CARBOYZ-30] QR Code Rendering Hotfix — 2026-09-02

**Files touched:** `src/utils/qrEncoder.js`, `src/ui/styles.css`, `tests/qrEncoder.test.js`
(`src/ui/LeadInboxView.js` needed no JS change — its existing `.pairing-card__qr` class picked up
the new CSS below).

**Root cause:** `renderQrSvg()`'s `margin` option was a flat pixel value (default `4`) independent
of `cellSize`, so at the default `cellSize: 6` the quiet zone was ~0.67 modules — well under the
ISO/IEC 18004-recommended 4-module minimum — and every other call site (`TestHarnessView.js`
`margin: 8`/`cellSize: 4`, `appraisalPdfGenerator.js` `margin: 6`/`cellSize: 3`) was also under the
4-module floor (2 modules each). The dark-on-light palette itself (`#000000` modules, `#ffffff`
background) was already correct in the existing code.

**Fix:** `renderQrSvg()` now derives its default margin from `cellSize * 4` and additionally clamps
any caller-supplied `margin` up to that 4-module floor via `Math.max(margin, cellSize * 4)` — so
the mandatory quiet zone is enforced inside the encoder itself, fixing every call site
(`LeadInboxView.js`, `TestHarnessView.js`, `appraisalPdfGenerator.js`) without touching them
individually, consistent with this UOW's target scope of `qrEncoder.js` only. Also added
`shape-rendering="crispEdges"` to the root `<svg>` element and named the palette constants
(`QR_DARK_MODULE_COLOR`/`QR_LIGHT_BACKGROUND_COLOR`) for clarity.

**Container isolation:** Added a `.pairing-card__qr` rule to `styles.css` — solid white background,
bordered card, `margin-bottom: var(--spacing)` for vertical separation above the pairing status
text, and `:empty { display: none }` so the box doesn't render as a bare border before a QR is
generated. `LeadInboxView.js` already applied this class to the QR container; no JS edit needed.

**Verified no regression in the appraisal PDF:** `appraisalPdfGenerator.js`'s `renderQrBlock()`
passes `cellSize: 3`/`margin: 6`, now clamped to a 12px quiet zone (was 6px) — checked the QR block
still fits inside its allotted vertical space (`translate(..., 620)` to the "Scan to verify" label
at `y: 790`, well within `DOCUMENT_HEIGHT: 1056`) with no overlap.

**Tests:** Updated the two existing `renderQrSvg` tests whose literal margin/dimension expectations
predated the quiet-zone clamp, and added three new tests: default quiet zone + white background,
clamp-enforcement when a smaller margin is requested, and the `shape-rendering="crispEdges"`
attribute. `npm test` → 577/577 passing (574 existing + 3 new, zero regressions).

**Not done:** no browser was available to visually confirm the rendered pairing card in
`LeadInboxView.js`; verified via unit tests and `node --check` syntax checking only.

## [UOW-CARBOYZ-31] QR Code Layout Refinement & Payload Density Reduction — 2026-09-02

**Compact matrix density:** `qrEncoder.js`'s `encodeQrMatrix` already defaulted to error
correction level `'L'` — the lowest of the two supported levels (`L`/`M`) and the one with the
largest per-version data capacity, so it already selects the smallest possible matrix version for
a given payload. No algorithmic change was needed there. Made this explicit at the call site:
`LeadInboxView.js:189` now passes `{ errorCorrectionLevel: 'L' }` to `encodeQrMatrix` instead of
relying on the implicit default, with a comment explaining why. The "minimal URL path length" plan
item was out of scope — the pairing URL is built by `LeadInboxController.createPairingSession`
(`src/ui/LeadInboxController.js`), which isn't in this UOW's target scope.

**Symmetrical card layout:** `.pairing-card__qr` in `src/ui/styles.css` (note: UOW target scope
said `public/styles.css`, but the actual stylesheet lives at `src/ui/styles.css` — same file
`LeadInboxView.js`/`index.html` reference) now matches the spec exactly: `max-width: 280px`,
`aspect-ratio: 1 / 1`, `margin: 16px auto`, `padding: 16px`, `border-radius: 12px`,
`background: #FFFFFF`, keeping the existing `border` and flex-centering.

**QR matrix scaling:** `.pairing-card__qr svg` changed from `max-width: 100%; height: auto` to
`width: 100%; height: 100%`. Since the container is a fixed square (`aspect-ratio: 1/1`) and the
QR SVG's `viewBox` is also always square, this fills the padded card exactly with no stretch and
no leftover whitespace, whereas the old `height: auto` could leave vertical whitespace once the
container's height was constrained by `aspect-ratio` rather than by the SVG's own intrinsic size.

**Tests:** Added four tests to `tests/qrEncoder.test.js` — default EC level equals explicit `'L'`,
level `'L'` never producing a larger matrix than level `'M'` for the same realistic pairing URL
(and staying at or under a 41-module/version-6 low-version bound), and two tests reading
`src/ui/styles.css` directly to assert the `.pairing-card__qr` and `.pairing-card__qr svg` rules
carry the required properties. `npm test` → 581/581 passing (577 existing + 4 new, zero
regressions).

**Not done:** no browser was available to visually confirm the centered/scaled QR card; verified
via unit tests (including direct CSS-rule assertions) only.

## [UOW-CARBOYZ-32] Adopt @nemzilla/qr-core for Lead Inbox Pairing QR — 2026-09-02

**Files touched:** `package.json`, `package-lock.json` (PO-run `npm install file:../qr-core`,
verified before implementing via `node -e "import('@nemzilla/qr-core')"`), `src/ui/LeadInboxView.js`.

**Implementation:** Replaced the `encodeQrMatrix`/`renderQrSvg` import from `../utils/qrEncoder.js`
with `import { renderQrSvg as renderPairingQrSvg } from '@nemzilla/qr-core';` (aliased to avoid
collision with the unrelated `qrEncoder.js` export of the same name, which is no longer imported
in this file). The `generateBtn` click handler in `renderPairingCard` is now `async`; the matrix
step is gone entirely since `@nemzilla/qr-core`'s `renderQrSvg(text, options)` takes the URL
directly — replaced `renderQrSvg(encodeQrMatrix(url, { errorCorrectionLevel: 'L' }))` with
`await renderPairingQrSvg(url, { errorCorrectionLevel: 'L' })`. The EC-level comment was kept as-is
since it still applies (passed straight through to the underlying `qrcode` package).

**Scope discipline:** `src/utils/qrEncoder.js`, `src/ui/TestHarnessView.js`, and
`src/utils/appraisalPdfGenerator.js` were left untouched per the UOW's blast-radius analysis —
`qr-core` has no matrix-level API, no `cellSize`/`margin` controls, and is async-only, which is
incompatible with `appraisalPdfGenerator.js`'s documented sync, DOM-free contract.

**Tests:** No existing test exercises `renderPairingCard`'s click handler directly (searched
`tests/` for `renderLeadInboxView`, `generateBtn`, `Pair Mobile Device` — only
`tests/ui.leadInboxController.test.js` exists, and it tests `LeadInboxController.createPairingSession`
directly, not the DOM click flow), so no test updates were required per the UOW's conditional AC.
`npm test` → 581/581 passing (one pre-existing, unrelated 1ms timestamp flake in
`tests/ui.testHarnessView.test.js`'s `buildSyntheticSubmission` determinism test failed on first
run and passed clean on immediate re-run — confirmed unrelated to this change, not touching QR
code or `TestHarnessView.js`).

**Smoke-checked** `@nemzilla/qr-core`'s `renderQrSvg` directly via `node -e`, confirming it returns
a valid `<svg>` string for a sample pairing URL.

## UOW-CARBOYZ-33: Mobile Viewport & CSS Responsiveness Audit Across All UI Views — 2026-09-02

**Root cause identified:** `.form__row--split` (shared by the intake form's Year/Make/Model/Trim/
Mileage/ZIP pairs in `SellerSubmissionView.js`, the inventory form in `App.js`, `SpreadConfigView.js`,
and `AnalyticsView.js`'s filter bar via `analytics__filters form__row form__row--split`) laid its
children out with `display:flex; flex:1` and no `min-width:0` override. Flex items default to
`min-width:auto`, which floors their shrink at the content's intrinsic min-content size — for
`<input>`/`<select>` elements this is wide enough that two side-by-side fields overflow the ~432px
usable content width on a narrow phone viewport, producing the reported input overlap and filter
clipping.

**Fix:** converted `.form__row--split` to `display:grid; grid-template-columns:
repeat(auto-fit, minmax(140px, 1fr))`, which wraps fields onto new rows instead of overflowing, and
set `min-width:0` on its children. Removed the now-redundant `.analytics__filters` flex-basis
override (the shared grid rule already covers it). Also added `min-width:0` +
`overflow-wrap:break-word` to `.card__title` and `.kpi-card`/`.kpi-card__label` (long titles/labels
could otherwise force their flex/grid track past its bound), `overflow-x:auto` on
`.analytics__table-container` (wide data tables no longer force page-level horizontal scroll), and
`min-height:44px` + flex-centering on `.bottom-nav__button` for a touch-safe tap target.
`env(safe-area-inset-bottom)` padding on `.bottom-nav` was already present from prior work — no
change needed there. `.tier-row__field` (`SpreadConfigView.js`) already had an explicit
`min-width:100px` + `flex-wrap:wrap` on its parent, so it was already overflow-safe; left untouched.

**Scope:** CSS-only (`src/ui/styles.css`). No DOM structure, event listeners, or data-binding
attributes touched in any `.js` view/controller file, per the UOW's preserve-logic constraint.

**Tests:** `npm test` → 581/581 passing, no regressions.

## UOW-CARBOYZ-34: Competitor Offer Fixture Miner & Web Document Test Gallery — 2026-09-03

**Sibling repo (`@nemzilla/test-core`):** Added a 4th mock-offer template, `Hendrick` (Hendrick
Automotive Group), to `src/document/mock-offer.js` alongside the existing CarMax/Carvana/KBB
templates — same synthetic-document pattern, no change to `generateMockOffer`'s return shape.
Added `src/document/fixtures.js` exporting `generateFixtures(targetDir)`, which renders one seeded
(deterministic, via `generateVin({ seed })`) appraisal per competitor, writes a `<slug>-offer.txt`
(raw OCR/parser fixture) and `<slug>-offer.json` (ground-truth metadata) per vendor, and a
`manifest.json` indexing all four. Added the executable CLI `bin/mine-pdfs.js`
(`#!/usr/bin/env node`), defaulting its output to the sibling `../carboyz/public/fixtures/offers`
and accepting an optional path override argument; wired up as the `mine-pdfs` bin entry in
`package.json`. New tests: `tests/fixtures.test.js` (fixture write + reproducibility) and updated
`tests/mock-offer.test.js` (Hendrick coverage; the old "Hendrick is unsupported" throw-case now
asserts on `Unknown` instead, since Hendrick is now a real competitor). `@nemzilla/test-core`
`npm test` → 23/23 passing.

**carboyz:** Ran `node ../test-core/bin/mine-pdfs.js` to populate `public/fixtures/offers/` (4
`.txt` + 4 `.json` + `manifest.json`, committed as static fixtures — not generated at build time).
Added `offer-gallery.html` at the repo root: fetches `/public/fixtures/offers/manifest.json` and
each document's `.txt` text client-side, renders one card per vendor with a high-contrast
white-on-black monospace preview (sized for mobile camera/OCR test photography) and download links
for both the raw text and the ground-truth JSON. No build step or bundler involved, matching the
rest of the app's plain-ESM/importmap setup. Added `tests/offerGalleryFixtures.test.js`, which
reads the committed manifest and asserts every entry's text + metadata files exist, parse cleanly,
and agree with the manifest's ground truth. Refreshed `vendor/test-core/` via the existing
`scripts/vendor-test-core.js` so the browser-side importmap copy
(`@nemzilla/test-core` → `/vendor/test-core/src/index.js`) picks up the Hendrick template and the
new `generateFixtures` export.

**Verified in-browser:** served the repo root (`npx serve .`) and loaded `/offer-gallery.html` in
headless Chrome — all 4 cards render with correct vendor text, VINs, and download buttons; status
line confirms the manifest load.

**Tests:** carboyz `npm test` → 597/597 passing, zero regressions (this UOW's own contribution is
the 2 new tests in `tests/offerGalleryFixtures.test.js`; the gap from the 581 logged in
UOW-CARBOYZ-33 reflects test files added in unrelated commits since then, not this UOW).

## UOW-CARBOYZ-35 — Fix Browser CORS / node:fs Crash on @nemzilla/test-core Import (2026-09-03)

**Root cause:** `../test-core/src/index.js` (the module carboyz's importmap resolves
`@nemzilla/test-core` to) statically re-exported `generateFixtures` from
`src/document/fixtures.js`, which imports `node:fs`/`node:path`. Any browser page importing
`@nemzilla/test-core` (i.e. `index.html` → `src/ui/App.js` → `TestBedDrawer.js`) triggered a
module-resolution failure trying to load those Node built-ins client-side.

**Fix (in `../test-core`):** moved `src/document/fixtures.js` → `src/node/fixtures.js` (git mv,
history preserved) and dropped its export from `src/index.js`, which is now 100% free of Node
built-ins — it only re-exports `vin/generator.js`, `vin/nhtsa.js`, `presets/vehicle-seeds.js`, and
`document/mock-offer.js`, none of which import `node:*`. Updated `bin/mine-pdfs.js` and
`tests/fixtures.test.js` to import `generateFixtures` from the new `src/node/fixtures.js` path
directly (relative import, not through the package entry point). Committed in `test-core` as
`64a1c61`.

**Fix (in carboyz):** re-ran `node scripts/vendor-test-core.js` to refresh
`vendor/test-core/src/` — `vendor/test-core/src/document/fixtures.js` is gone,
`vendor/test-core/src/node/fixtures.js` now exists (harmless: never imported by anything the
browser loads), and `vendor/test-core/src/index.js` no longer exports `generateFixtures`. No
`index.html` importmap change was needed — `@nemzilla/test-core` already pointed at
`/vendor/test-core/src/index.js`, which is now clean.

**Verification:**
- `../test-core` `npm test` → 23/23 passing.
- `../test-core` `node bin/mine-pdfs.js <tmp-dir>` → CLI still writes fixtures correctly from its
  new import path.
- carboyz `npm test` → 597/597 passing, zero regressions.
- `npm start` (`serve .` on :8080), then `curl -sL` → `/`, `/vin-testbed`, `/offer-gallery` all
  HTTP 200 (serve redirects `*.html` → extensionless paths).
- No headless browser (puppeteer/chromium) is installed in this environment, so in place of a
  literal browser run, wrote a small ESM-module-graph crawler
  (`scripts/vendor-test-core.js`-adjacent, scratch-only, not committed) that starts at each
  entry page's `<script type="module">`, follows every `import`/`export ... from` statement,
  resolves specifiers exactly as a browser would (importmap first, else relative-only), and flags
  any bare/unresolvable specifier such as `node:fs`. Crawled all 151 modules reachable from
  `index.html` → `App.js` (the only entry point that imports `@nemzilla/test-core`); zero
  `node:*` or unresolvable specifiers found. `vin-testbed.html` and `offer-gallery.html` don't
  import `@nemzilla/test-core` at all (inline scripts / fetch-based fixture loading), so they were
  never part of the crash surface, but their HTTP 200 status was confirmed directly.

## [UOW-CARBOYZ-36] Optimize Code 39 Barcode Rendering for Mobile Camera Scanners — 2026-09-03

**Approach:** Bumped the JsBarcode config on `vin-testbed.html` (`width: 2.5`, `height: 80`,
`margin: 12`) for a wider quiet zone and taller bars, restyled `.barcode-container` with
`padding: 1.25rem` on the existing white background/rounded-corner/`max-width:100%`/
`overflow:hidden` containment, and switched `.vin-text` to a bolder monospace stack
(`ui-monospace`/Menlo/Consolas) at higher letter-spacing and full-white (`#f8fafc`) for
contrast against the `#1e293b` card background.

Also added `min-width: 0` to `.card` as a defensive guard against the classic CSS Grid item
content-blowout (a grid item's default `min-width: auto` can force its track wider than the
explicit `minmax()` track size when a replaced child, like the barcode SVG, has a large
intrinsic size) — not required by the measured behavior here (see Verification), but cheap
insurance since `.card` is a grid item hosting a wide SVG.

**Verification:**
- Live-rendered `vin-testbed.html` via a headless Chrome screenshot at both a desktop width
  (1280px) and a phone width (390px) against `npm start` (`serve .` on :8080). Visually,
  barcodes are well-spaced and non-overflowing on both; VIN text is bold, high-contrast, and
  legible.
- The 390px render initially looked clipped at the card's right edge. Instrumented the live page
  (temporary inline script, not committed) to read `document.body.scrollWidth` vs
  `document.documentElement.clientWidth` and the `getBoundingClientRect()` of `.grid`, `.card`,
  `.barcode-container`, and the barcode `<svg>`. Confirmed `scrollWidth === clientWidth` (no
  horizontal overflow anywhere in the tree) and that the SVG's rendered width (346px) was
  correctly scaled down from its intrinsic `viewBox` size (784×104) by the existing
  `max-width:100%; height:auto` rule — the "clipped" look was the barcode legitimately filling
  most of a single-column card at that width, not a layout bug.
- `npm test` → 597/597 passing, zero regressions (this UOW touches only static HTML/CSS/inline
  script in `vin-testbed.html`, not covered by the Node test suite).

## [UOW-40] Server-Side Offer Document Extraction & Auto-Population — 2026-10-06

**Files touched:**
- `src/server/offerParser.js` (new) — `parseOfferDocument({ documentBase64 })`.
- `src/server/index.js` — registered `POST /api/offers/parse`.
- `src/ui/offerAutoPopulate.js` (new) — `requestOfferParse()` (fetch wrapper) and
  `mapExtractedOfferToFormValues()` (pure mapping), the DOM-free/testable half of the client wire.
- `src/ui/SellerSubmissionView.js` — dropzone drop + file-picker `change` now funnel through a new
  `handleFileSelected()` that reads the file once, POSTs it to the parser, and applies the result
  via `applyExtractedOffer()`; the submit handler reuses the same base64 read instead of re-reading
  the file.
- `tests/offerParser.test.js`, `tests/ui.offerAutoPopulate.test.js` (new); `tests/server.test.js`
  extended with 4 integration cases for the new route.

**Approach:**
- No OCR/PDF-parsing dependency was added — `offerParser.js`'s own header comment documents why,
  echoing the identical precedent already recorded in `vinScanner.js`'s `createVinScanner` doc
  comment (zero-dependency-per-module boundary). The "document" is decoded as UTF-8 text
  (stripping a `data:<mime>;base64,` prefix if present) and scanned with regexes; a real
  photo/scan decodes to binary noise and correctly produces an empty/low-confidence `extracted`
  rather than a thrown error — this is the intended graceful-fallback path, not a gap.
- VIN extraction reuses `findValidVin`/`decodeWmiMake` from `vinScanner.js` directly rather than
  reimplementing VIN logic. Deliberately did **not** reuse `decodeModelYear` for the `year` field:
  its position-10 code repeats every 30 years, and a spot-check against this UOW's own fixtures
  (`public/fixtures/offers/*.txt`) showed it guessing the wrong decade twice (e.g. the Carvana VIN
  decodes to 2000, not 2020). `year`/`model` are instead extracted only from an explicit
  "`<year> <make> <model>`" text line (`extractVehicleLine`) when the document states it outright
  — absent for CarMax/KBB's offer sheets, so those two fixtures correctly report no `year`/`model`
  rather than a plausible-looking wrong guess.
- `competitorName` matches a fixed brand-keyword list (CarMax/Carvana/KBB/Driveway) at 0.95
  confidence, else falls back to the document's own first legible heading line at 0.4 confidence
  (the "generic dealership offer sheet" case, e.g. the Hendrick fixture) — guarded to require
  printable-ASCII + at least one letter so binary-noise documents don't produce a garbage name.
- Client-side, the parse call and the field-mapping logic are both pure/DOM-free in
  `offerAutoPopulate.js` so they get full `node --test` coverage without jsdom/happy-dom (no such
  dependency exists in this repo, and none was added). `SellerSubmissionView.js` itself stays thin
  glue, consistent with the existing precedent that View-rendering functions (`h()` →
  `document.createElement`) aren't directly unit-tested here.
- `mapExtractedOfferToFormValues` only routes a `competitorName` into the `competitor` select when
  it case-insensitively matches a real `COMPETITORS` entry; anything else (including a generic
  dealership heading) falls back to `competitor: null` + `competitorDealerName`, which
  `applyExtractedOffer()` turns into selecting "Other" and revealing the dealer-name row — the
  same path a seller typing it in manually would hit.
- Acceptance criterion "`SpreadService`/`SpreadConfigService` auto-calculate the counter offer as
  soon as the parsed `competitorOffer` populates" required no new wiring: `DispatchService.dispatch()`
  already calls `calculateSpread()` against `submission.competitorOfferAmount` at submit time
  (`src/services/DispatchService.js`), and auto-population now sets `offerAmountInput.value`
  before submit, so the existing submit-time flow picks it up unchanged.

**Verification:**
- `npm test` → 620/620 passing (597 prior + 23 new), zero regressions.
- `node --test --experimental-test-coverage`: `offerParser.js` 95.89% line / 91.49% branch;
  `offerAutoPopulate.js` 100% line / 92.86% branch; `src/server/index.js` 92.59% line / 92.86%
  branch (new route included) — all clear the 80% line/branch gate.
- Ran `parseOfferDocument` directly against all four committed fixtures
  (`public/fixtures/offers/{carmax,carvana,hendrick,kbb}-offer.txt`) and asserted VIN/offer
  amount/mileage/competitor name against their known values; Carvana and Hendrick (which embed an
  explicit "`<year> <make> <model>`" line) additionally assert on `year`/`make`/`model`.
- Confirmed malformed input never throws: non-base64 garbage, a missing `documentBase64`, and a
  non-JSON POST body each return a 200/400 JSON body instead of a 500, both at the
  `parseOfferDocument()` unit level and through `app.request()` against the live Hono app.

## [UOW-41] Unify Static and API Server Runtime — 2026-10-06

**Files touched:**
- `src/server/index.js` — mounted `@hono/node-server/serve-static` (already a transitive export
  of the existing `@hono/node-server` dependency, so this is zero new dependencies) as a catch-all
  `app.use('*', serveStatic({ root: staticRoot }))`, registered *after* every explicit API route.
  `createApp()` now accepts a `staticRoot` option (defaults to the repo root, resolved from
  `import.meta.url` via two `..` segments so it's correct regardless of process CWD) for
  testability. `DEFAULT_PORT` changed from `8787` to `8080` per the UOW's port contract.
- `package.json` — `"start"` is now `node src/server/index.js`; removed `"start:server"` (now
  redundant — `npm start` does the same thing). `"prestart"` untouched.
- `tests/server.test.js` — 5 new cases using a `withTempStaticRoot()` helper (writes fixture files
  into a throwaway `mkdtemp` dir) plus one case against the real repo-root default.

**Approach:**
- Confirmed precedence works for free rather than needing manual ordering logic: `serveStatic`'s
  own implementation (`node_modules/@hono/node-server/dist/serve-static.mjs`) calls `next()` and
  returns, without responding, on a 404 — so even if it were registered *before* the API routes it
  would still fall through to them. Registering it *last* was still the right call: it means a
  request that actually matches an API route handler never touches the filesystem at all (Hono's
  composed middleware chain short-circuits once a handler returns a response without calling
  `next()`), and it matches the UOW's literal "explicit API routes take precedence" wording.
- No MIME-type configuration was added: `hono/utils/mime`'s built-in table already maps
  `.js`/`.mjs` → `text/javascript; charset=utf-8` (a correct ES-module content type — browsers
  don't distinguish it from `application/javascript` for `<script type="module">`) and
  `.webmanifest` → `application/manifest+json`. Verified both directly against a running server.
- `staticRoot` is computed from `import.meta.url`, not `process.cwd()`, specifically so `npm test`
  (which also constructs `createApp()` without arguments in several tests) resolves the real repo
  root regardless of which directory the test runner was invoked from.

**Verification:**
- `npm test` → 625/625 passing (620 prior + 5 new), zero regressions.
- `node --test --experimental-test-coverage`: `src/server/index.js` 93.55% line / 93.10% branch —
  clears the 80% gate.
- Live smoke test: ran `npm start` for real (port 8080) and curled every acceptance-criteria path —
  `GET /` (200, the actual `index.html` shell, `text/html`), `GET /manifest.webmanifest` (200,
  `application/manifest+json`), `GET /src/ui/App.js` (200, `text/javascript`), `GET
  /public/fixtures/offers/manifest.json` (200), `GET /vendor/zod/index.js` (200), `GET
  /offer-gallery.html` (200), `GET /api/v1/health` (200 JSON), `POST /api/offers/parse` with a
  same-origin request (200 JSON, no CORS preflight needed since it's the same host:port as the
  shell), and a nonexistent path (`GET /no-such-file.txt` → 404). All matched expectations; server
  process was killed afterward.

## [UOW-HOTFIX] Wire Test Bed Preset Selection into SellerSubmissionView — 2026-10-07

**Premise check before touching anything:** the request named 4 vehicles (Honda Accord EX-L,
Toyota RAV4 XLE, Ford F-150 XLT, Chevrolet Silverado 1500) as "the test bed preset vehicles...
with invalid/missing VIN check digits." Neither that vehicle set nor any VIN-checksum bug actually
exists in this codebase: `TestBedDrawer.js`'s `VEHICLE_SEEDS` (Toyota Camry LE, Ford F-150 XLT,
Tesla Model 3 Long Range, Honda CR-V EX) comes from the sibling `@nemzilla/test-core` package and
already generates check-digit-valid VINs via `generateVin()` — verified live with `validateVin()`
against all 4 before changing anything. Flagged this mismatch to the Product Owner rather than
guessing; they confirmed: keep the existing presets as-is, and build the one thing that actually
was missing — wiring preset selection into the Sell form.

**Files touched:**
- `src/ui/SellerSubmissionView.js` — now returns `{ section, applyVehicle }` instead of a bare
  element (matching the existing `{ section, refresh }` pattern already used by
  `renderLeadInboxView`/`renderAnalyticsView`). `applyVehicle({ vin, year, make, model, trim,
  mileage })` sets each input's `.value` and dispatches both `input` and `change` events
  (`bubbles: true`) per-field via a small `setInputValue()` helper, so any listener bound to those
  inputs reacts the same as a real keystroke would.
- `src/components/dev/TestBedDrawer.js` — `renderTestBedDrawer()` takes a new
  `onApplyToSellForm` callback, invoked with the seed object only from the preset `<select>`'s
  `change` handler (not from the separate "Decode VIN" button — out of scope, wasn't asked for).
  `VEHICLE_SEEDS` entries already have exactly the `{ vin, year, make, model, trim, mileage }`
  shape `applyVehicle` expects, so no mapping was needed.
- `src/ui/App.js` — destructures `renderSellerSubmissionView`'s new return shape and passes
  `applyVehicle` through as `onApplyToSellForm` when constructing `testBedDrawer`. No other call
  site exists (`TestHarnessView.js`'s only match was a doc-comment mention, not a call).

**Verification:**
- `npm test` → 625/625 passing, zero regressions (both views are DOM-rendering functions, same
  untested-directly tier as `renderLeadInboxView`/`TestBedDrawer`'s own header comment already
  documents — the logic they wire together, `VEHICLE_SEEDS`/`validateVin`, is unit-tested
  elsewhere).
- Live browser verification (no project dependency added — installed `playwright` + a Chromium
  binary ad hoc in the session scratchpad only, same one-off-tool precedent as UOW-CARBOYZ-36's
  headless-Chrome screenshot check): booted the real `npm start` server, opened the Test Bed
  drawer, selected the "2020 Ford F-150 XLT (Truck)" preset, and read the Sell form's actual input
  values back out of the DOM — `vin: "52KT9N0K0F54M89M5"`, `year: "2020"`, `make: "Ford"`, `model:
  "F-150"`, `trim: "XLT"`, `mileage: "48000"`, all correct. One pre-existing, already-documented
  console warning appeared (Service Worker scope — see `ARCHITECT_JOURNAL.md`'s `npx serve`-era
  note), unrelated to this change.

## [UOW-HOTFIX] Clean Up Sell Form Layout, Label Spacing & Input Widths — 2026-10-07

**Files touched:** `src/ui/SellerSubmissionView.js`, `src/ui/styles.css`.

**Root cause of "inconsistent label placement":** the split-row sub-fields (Year/Make/Model/
Trim/Mileage/ZIP) were each wrapped in a bare, unclassed `<div>` holding a `<label>` + `<input>`,
with no `display`/`gap` rule applied to that wrapper — and `<label>` has no `display: block` in
this stylesheet's base `.form label` rule, so those labels were rendering inline-before-input by
default, while every *non*-split row (VIN, Competitor, Offer Document, etc.), wrapped in
`.form__row` (`display:flex; flex-direction:column; gap:4px`), stacked correctly. That's the
actual "jumping between inline and stacked" the request described. Fix: every per-field wrapper
now uses `.form__row`, so label-above-input + 4px gap is applied uniformly everywhere in this form.

**Approach — kept all new CSS scoped under `.sell-form`:**
- `.form`, `.form__row`, `.form__row--split`, `.input--large`, `.form__status` are shared base
  classes also used by `SpreadConfigView.js`, `TestHarnessView.js`, and `SimulationView.js`.
  Rather than edit those shared rules (which would have restyled every other form in the app),
  the `<form>` element picked up a new `sell-form` class, and every new rule is scoped under it
  (`.sell-form label`, `.sell-form__vehicle-grid`, `.sell-form__vin-input`, etc.) — verified by
  screenshotting the Admin tab (`SpreadConfigView`, same `.form__row--split` tier-row grid) before
  and after: pixel-identical.
- Year/Make/Model/Trim were two separate 2-up `.form__row--split` rows; merged into one grid
  (`.form__row--split sell-form__vehicle-grid`, 4 children) so the existing `auto-fit,
  minmax(140px, 1fr)` responsive behavior naturally gives a 2×2 grid on a phone width and a single
  4-up row at desktop width — no new breakpoint CSS needed, reused the shared grid mechanics.
- VIN input: `maxlength="17"`, `font-family: ui-monospace/SF Mono/Menlo/Consolas`,
  `text-transform: uppercase`, `max-width: 22ch` (visual uppercase only — doesn't mutate
  `.value`, same as every other cosmetic transform in this stylesheet).
- Year input: `max-width: 8ch`.
- Mileage/Offer Amount: new `.sell-form__unit-field` wrapper (`position:relative; display:flex`)
  holding the input plus an absolutely-positioned `.sell-form__unit` span ("mi" suffix / "$"
  prefix, `aria-hidden="true"` since the `<label>` already names the field for assistive tech).

**Bug caught during live verification, fixed before commit:** the unit-field wrapper correctly
stretched to the grid column's full width, but the `<input>` inside it kept its flexbox default
`flex: 0 1 auto` (content-based width) instead of filling the wrapper — so the "mi"/"$" label,
positioned absolutely relative to the wrapper, rendered detached from the input's actual right/
left edge. Caught via `getBoundingClientRect()`/`getComputedStyle()` against the live page (input
204px vs. wrapper 672px), fixed with `.sell-form__unit-field input { flex: 1; min-width: 0; }`,
re-screenshotted to confirm the label now sits flush against the input.

**Verification:**
- `npm test` → 625/625 passing, zero regressions (pure styling/markup-structure change to an
  already-untested-directly View, same tier as `renderLeadInboxView`).
- Live browser screenshots (Playwright, ad hoc in the session scratchpad, not a project
  dependency) at 1280×900 (desktop) and 390×844 (mobile/iPhone-width): confirmed consistent
  label-above-input stacking throughout, the VIN/Year compact sizing, the flush mi/$ unit labels,
  and the Year/Make/Model/Trim grid collapsing to 2×2 on the phone width and a single row on
  desktop. Also screenshotted the Admin tab (`SpreadConfigView`) to confirm its tier-row grid is
  pixel-unaffected by the new scoped rules.

## [UOW-42] Support Image Ingestion & Partial Estimate Offers — 2026-10-08

**Objective:** let a seller drop a screenshot of a competitor "Estimate" screen (e.g. Carvana's
instant online quote) — these deliberately omit the VIN to avoid lead spam — and have the Sell
form partially auto-populate (Year/Make/Model/Competitor/Offer) without clearing other fields or
erroring, plus surface an inline nudge toward supplying the VIN manually.

**Server (`src/server/offerParser.js`):**
- `parseOfferDocument({ documentBase64, mimeType })` now routes on `mimeType`: `image/jpeg`,
  `image/png`, and `image/heic` (`IMAGE_MIME_TYPES`) go through a new `extractFromImage()` path;
  everything else keeps the existing text/regex path, now factored out as `extractFromText()` so
  both paths share one implementation (`parseOfferDocument` no longer duplicates the extraction
  body — behavior for existing non-image callers is byte-for-byte unchanged, confirmed by the
  full pre-existing `offerParser.test.js` suite passing unmodified).
- `extractFromImage()` is a deterministic **fixture adapter**, not OCR: it SHA-256-hashes the raw
  image bytes and looks the hash up in `IMAGE_FIXTURES`, a small hardcoded table of known test/demo
  screenshots (currently just the Carvana Wrangler Unlimited estimate in
  `public/fixtures/offers/carvana-estimated-offer-screenshot.jpeg`, added this UOW). A match
  returns `{ competitorName, competitorOffer, year, make, model, isEstimate: true }` — no `vin`
  key at all (same "only present when found" convention as the text path). No match falls through
  to `extractFromText()` on the image's own bytes-as-UTF-8, so a mislabeled-but-legible payload
  (or a real photo containing a readable VIN/offer string) still gets a best-effort regex
  extraction instead of an automatic empty result — same zero-dependency precedent as the text
  path (no OCR/vision library wired in). This satisfies the UOW's "zero-crash extraction adapter
  ... deterministic regex/OCR fallback or fixture adapter" requirement without adding an external
  dependency or a speculative/unimplemented vision-API call behind an env flag that does nothing
  yet — a real vision-API integration is left as a clearly-commented future seam, not built now.
- `src/server/index.js`'s `/api/offers/parse` handler now forwards `body.mimeType` into
  `parseOfferDocument` (the UI already sent it; the parser was just ignoring it before).

**UI (`src/ui/offerAutoPopulate.js`, `src/ui/SellerSubmissionView.js`):**
- `mapExtractedOfferToFormValues()` gained an `isEstimate` field (`Boolean(extracted.isEstimate)`,
  defaults to `false`) alongside the existing vin/year/make/model/mileage/offer/competitor fields.
- `applyExtractedOffer()` in `SellerSubmissionView.js` required **no changes** to its "don't clear
  other fields" behavior — it already guarded every field write with `if (values.x) ...`/`!= null`
  checks, so a null/undefined `vin` was already a safe no-op. What it gained: a new
  `vinHelperEl` (`<p class="sell-form__vin-helper" role="status" aria-live="polite">`) rendered
  directly under the VIN input row. When `values.isEstimate && !values.vin`, it's shown with
  "Estimate detected! Enter VIN or scan barcode to beat their offer." and `vinInput.focus()` is
  called; otherwise it's hidden/cleared. The helper also auto-hides the moment the seller supplies
  a VIN themselves — on the VIN input's `input` event, in the barcode-scanner's `onVinConfirmed`
  callback, and (for free) via the existing `applyVehicle()`/test-bed-preset path, since that
  already dispatches a synthetic `input` event through `setInputValue()`.
- `src/ui/styles.css`: one new rule, `.sell-form__vin-helper` (amber `--color-fair`, matches the
  existing warning-tier color already used elsewhere for "needs attention" states).

**Downstream safety (SpreadService / submission flow):** no code change was needed here —
`Submission`'s constructor (`src/models/Submission.js`) already throws without a `vin`, and the
VIN `<input>` already carries `required`, so a seller can't reach `controller.submitSubmission()`
with a partial estimate's null VIN; the wholesale-tier computation was already correctly gated
behind requiring a real VIN before this UOW, for unrelated pre-existing reasons.

**Testing:**
- `tests/offerParser.test.js`: new tests cover the recognized-fixture image (full field
  assertions against the real Carvana JPEG fixture, `vin` absent, `isEstimate: true`), an
  unrecognized image (random JPEG-header bytes → empty `extracted`, `success: true`), and the
  regex-fallback path for an image-labeled payload that happens to decode to legible offer text.
- `tests/server.test.js`: new integration test posts the real fixture JPEG as base64 to
  `POST /api/offers/parse` with `mimeType: 'image/jpeg'` and asserts the full partial-estimate
  response shape.
- `tests/ui.offerAutoPopulate.test.js`: updated the "defaults to null" test to include
  `isEstimate: false`, and added a test asserting `mapExtractedOfferToFormValues` passes through a
  VIN-less estimate's fields (including `isEstimate: true`) without fabricating a VIN.
- Live Playwright verification (ad hoc scratchpad script, 390×844 viewport): dropped the real
  fixture JPEG into the Sell form's file input, confirmed Year/Make/Model/Competitor/Offer Amount
  populate, VIN stays empty, the amber helper text renders with the exact copy, and the VIN input
  receives focus (`document.activeElement === vinInput`) — screenshotted for visual confirmation.
  Also re-verified a normal VIN-bearing text document via `curl` to confirm the non-image path is
  unaffected.
- `npm test` → 630/630 passing (5 new tests added on top of the prior 625; the single pre-existing
  1ms-timestamp flake in `ui.testHarnessView.test.js` — unrelated to this UOW, present before any
  change here — did not reproduce on this run).

## [UOW-43] Offer Provenance (Estimate vs Firm), Margin Analytics & Conditional Counters — 2026-10-08

**Objective:** persist UOW-42's `isEstimate` signal through the lead lifecycle — intake,
dispatch, Lead Inbox, and the generated appraisal sheet — so dealers can see at a glance whether a
counter was built off a VIN-less competitor "Estimate" screen or a firm written offer, and get
basic margin/price-tier analytics on each lead record.

**Key design resolution — when does `offerSourceType` get set, and when does it change?**
The UOW's literal wording ("if it has a confirmed VIN ... set offerSourceType = FIRM_OFFER") reads
ambiguously as "flip to FIRM_OFFER whenever the VIN field gets filled in." That can't be what's
meant: the VIN `<input>` is `required` on the Sell form, so every submission — estimate-sourced or
not — has a VIN by the time it's submitted. If filling in the (required) VIN flipped the type,
`offerSourceType: 'ESTIMATE'` could never actually reach a persisted lead, which would silently
gut objectives 2 and 3. Resolved this as: `offerSourceType` tracks where the *competitor's offer
number* came from (a VIN-less Estimate screenshot vs. a firm written offer document or manual
entry), not whether the VIN field happens to be filled in — a seller supplying their own VIN
doesn't retroactively make Carvana's estimate a firm offer. So only `applyExtractedOffer()` in
`SellerSubmissionView.js` ever sets it (`ESTIMATE` when `extracted.isEstimate && !vin`, else
`FIRM_OFFER`); the VIN scanner/manual-entry paths only clear the helper text, never touch
`offerSourceType`. Caught this by walking through the live flow during verification (first
implementation had the VIN-input listener flip it back to FIRM_OFFER, which was wrong) rather than
by reasoning about it statically — worth remembering as a lesson for provenance-style fields that
interact with required-field validation.

**`src/models/Submission.js`:** added `OFFER_SOURCE_TYPES = ['ESTIMATE', 'FIRM_OFFER']` and four
new constructor fields — `offerSourceType` (defaults to `'FIRM_OFFER'`, validated against the
enum), `isAutoApproved` (boolean|null), `priceTierBucket` (string|null), `projectedMargin`
(number|null, negative allowed, same `validateOptionalNumber` helper as `expectedMargin`).
`projectedMargin` is intentionally a literal duplicate of the existing `expectedMargin` field
(same formula: wholesale value − counter offer) — the UOW's Lead Record Schema names it
explicitly, and renaming/removing `expectedMargin` would touch `AnalyticsService.js`'s
`computeMarginTotals()`/`computeCompetitorMatrix()`/`computeTimeSeries()` and every test that
reads it, which is out of this UOW's surgical scope. Documented the duplication in both files so a
future reader isn't confused into thinking they diverge.

**`src/services/DispatchService.js`:** added `computePriceTierBucket(competitorAmount)` — a fixed
four-bucket scale (`<10k`, `10k-20k`, `20k-30k`, `30k+`) per the UOW's literal boundaries. This is
deliberately a *separate* concept from `AnalyticsService.js`'s existing `PRICE_TIERS`/
`priceTierForAmount()` (`$0–$15k`/`$15k–$30k`/`$30k+`, used for the Analytics dashboard's filter
dropdown) — different boundaries, different purpose (coarse dealer-reporting bucket persisted once
at dispatch time vs. a configurable analytics-time filter), kept intentionally un-unified rather
than guessing the Lead Architect wants the two systems merged. `dispatch()` now also persists
`isAutoApproved` (`true` on the auto-dispatch branch, `false` on the manual/pending branch — "was
the sent counter accepted automatically or does it still need a rep's sign-off/possible
adjustment") and `projectedMargin` (mirrors `expectedMargin`) in both branches.

**`src/ui/LeadInboxController.js`:** `approveAndSend()` (the rep-adjusts-and-sends path) now also
sets `isAutoApproved: false` (explicit, even though `dispatch()` already set it false on that
submission — keeps the invariant `isAutoApproved === (approvalType === 'AUTO_DISPATCH')` true via
explicit writes at every mutation site rather than relying on an unwritten field just carrying
over) and `projectedMargin` alongside the existing `expectedMargin` write. `buildLeadViewModels()`
now surfaces `offerSourceType` onto each lead view model.

**`src/ui/LeadInboxView.js`:** added `OFFER_SOURCE_BADGES` (`ESTIMATE` → amber `[ESTIMATE
COUNTER]`, `FIRM_OFFER` → green `[FIRM COUNTER]`, literal bracketed label text per the UOW) and
exported `offerSourceBadge(offerSourceType)` as a pure lookup — same pattern as `pwaInstallPromptView.js`'s
exported pure helpers, so it's directly unit-testable without jsdom (this repo has no DOM-testing
dependency; Views stay in the "verify live in browser" tier, but pure badge/label *selection*
logic extracted this way is fully unit-testable). `renderLeadCard()` renders a third badge in
`.card__top` when `offerSourceBadge()` returns non-null.

**`src/utils/appraisalPdfGenerator.js`:** `buildAppraisalPayload()`'s `title` field (rendered as
the document subtitle under the dealer name/logo) is now `OFFER_SOURCE_TITLES[submission.offerSourceType]`
— `'Conditional Counter-Offer (Pending Vehicle Inspection & VIN Verification)'` for `ESTIMATE`,
`'Guaranteed Competitor Beat Offer'` for `FIRM_OFFER` (and the default when `offerSourceType` is
absent, e.g. on fixtures/submissions predating this UOW). The root `<svg>`'s `aria-label` stays the
static, generic `"Official Counter-Offer Appraisal"` — that's a document-type accessibility label,
not the business-facing subtitle, so it intentionally doesn't vary.

**CSS bug caught and fixed during live verification:** `.card__top` (`display: flex; justify-content:
space-between`) had no `flex-wrap`, and `.card__title` already carried `min-width: 0; overflow-wrap:
break-word` for exactly this reason. Adding a third badge narrowed the title's available flex-basis
below single-word width at a 390px mobile viewport, so the vehicle title wrapped one character per
line. Fixed with `flex-wrap: wrap` on `.card__top` (only two call sites in the whole codebase —
this lead card and `App.js`'s single-child generic card tab panel — so safe with no scoping
needed), re-verified via screenshot that the title renders normally and badges wrap to their own
line when they don't fit.

**Testing:**
- `tests/submission.test.js`: `offerSourceType` default/enum validation; `isAutoApproved`/
  `priceTierBucket`/`projectedMargin` default-to-null + type validation.
- `tests/dispatchService.test.js`: `computePriceTierBucket()` boundary tests for all four buckets;
  both dispatch branches assert `isAutoApproved`, `priceTierBucket`, and
  `projectedMargin === expectedMargin`.
- `tests/ui.leadInboxController.test.js`: `buildLeadViewModels()` surfaces `offerSourceType`
  (default and `ESTIMATE`); `approveAndSend()` sets `isAutoApproved: false` and mirrors
  `projectedMargin`.
- `tests/ui.leadInboxView.test.js` (new file): `offerSourceBadge()` for `ESTIMATE`, `FIRM_OFFER`,
  and an unrecognized/unset value (returns `null`, so a pre-UOW-43 lead renders no stray badge).
- `tests/appraisalPdfGenerator.test.js`: conditional `payload.title` for both source types and the
  unset default; `renderAppraisalSvg` embeds the (XML-escaped) conditional label text.
- Live Playwright verification (ad hoc scratchpad scripts): dropped the real Carvana estimate
  fixture into the Sell form, filled in the VIN/mileage/ZIP it can't supply, submitted, then
  submitted a second normal VIN-first manual offer; confirmed in the Lead Inbox that the first
  lead renders `[ESTIMATE COUNTER]` (amber) and the second renders `[FIRM COUNTER]` (green) —
  screenshotted both before and after the `.card__top` flex-wrap fix. `buildAppraisalPayload`'s
  conditional title is covered by direct unit tests (above); a live download-trigger check hit an
  unrelated headless-Chromium blob-URL/download-event quirk in the ad hoc verification script
  (not a product bug — `triggerAppraisalDownload` already has dedicated passing unit tests against
  a fake `document`), so that last link in the chain was verified at the unit level instead.
- `npm test` → 643/643 passing (13 new tests on top of the prior 630).

## [UOW-44] Full-Pipeline Golden Test (Image Fixture -> Parse -> Spread Math -> Persisted Lead & SVG) — 2026-10-08

**Objective:** a single end-to-end integration test proving the whole chain works together for the
real Carvana estimate fixture — HTTP parse route → `Submission` intake → `DispatchService`
spread/margin math (double-checked independently against the live `SpreadConfigService` config,
not just re-invoking `calculateSpread`) → the UOW-43 conditional appraisal SVG.

**Fixture path correction:** the spec named
`public/fixtures/offers/55DF9D5E-0F8B-42A2-A048-1EE712D43F48` (HEIC/JPEG), which doesn't exist in
this repo — almost certainly the raw iPhone Photos-library filename before UOW-42 ingested and
renamed the screenshot. The file matching the UOW's own described scenario byte-for-byte (Carvana,
$13,100, 2020 Jeep Wrangler Unlimited estimate, no VIN) already exists as
`carvana-estimated-offer-screenshot.jpeg` and is the exact fixture hashed into
`offerParser.js`'s `IMAGE_FIXTURES` table in UOW-42 — used it directly rather than blocking on the
filename mismatch, and noted the substitution in the new test file's own comments.

**New file:** `tests/integration/estimateGoldenPipeline.test.js` (new `tests/integration/`
directory — `node --test`'s default recursive discovery picks it up with no `package.json`
change, same as the pre-existing `tests/ui/` subdirectory).

**Phase 1 — parse, through the real route:** `createApp()` + `app.request('/api/offers/parse', ...)`
(not calling `parseOfferDocument` directly), matching the "send it through the parse handler /
route" instruction. Asserts against the field names the contract actually uses —
`extracted.competitorName`/`competitorOffer` rather than the UOW prose's `competitor`/
`offerAmount` — and asserts `extracted.vin === undefined` rather than `null`, since UOW-42
established "only present when found" as the extraction contract (an absent key, not an explicit
null); `mapExtractedOfferToFormValues()` is what turns that into `null` for the UI layer, and this
test is asserting the raw API response.

**Phase 2 — spread math, independently re-derived:** the test does *not* just call
`calculateSpread()` again and compare the result to itself (that would be tautological). It reads
`spreadConfigService.getTiersForCompetitor('Carvana')` — the live, currently-configured tiers, not
a hardcoded assumption — and reimplements the tier-match + flat/percent-markup formula from raw
tier data in a small test-local `computeExpectedMarkup()` helper, mirroring (but not importing)
`SpreadService.js`'s `matchTier`/`evaluateTierOffset`. Also independently recomputes the expected
wholesale value (`fairMarketValue * 0.88`, `SpreadService.WHOLESALE_FACTOR`) from
`telemetryService.getMarketStats()` on the ingested comp. With the default config and a single
$18,000 comp for a 2020 Jeep Wrangler Unlimited: $13,100 lands in the default 0–$15k tier
(`flatAmount: 300, percent: 0.02, strategy: MAX` → `max(300, 262) = 300`), so the expected counter
is $13,400, wholesale $15,840, projected margin $2,440, spread $2,740 (≥ $1,000 → GREENLIGHT, and
the 0–$15k tier is `autoApprove: true` → auto-dispatched). Asserts
`dispatched.priceTierBucket === '10k-20k'` (DispatchService's own fixed dealer-reporting bucket
for $13,100 — a different, intentionally separate scale from the $0–15k SpreadConfigService tier
that happened to match the markup, per UOW-43's design note) and
`dispatched.offerSourceType === 'ESTIMATE'`.

**Phase 3 — appraisal artifact:** asserts the dispatch outcome is `AUTO_COUNTER_SENT` first
(explicit, so a future default-config change that pushes this fixture onto the manual-approval
path — which would leave `finalCounterOffer` unset until a rep acts — fails loudly here rather
than opaquely inside `generateAppraisalDocument`), then asserts the generated SVG contains both
the UOW-43 conditional-counter label and the exact formatted dollar string for the independently
computed counter amount.

**Verification:** `npm test` → 644/644 passing (1 new test on top of the prior 643).

## [UOW-45] Multi-Fixture Snapshot Manifest & Config Re-baseline Harness — 2026-10-08

**Objective:** generalize UOW-44's single-fixture golden test into a data-driven harness that runs
the full parse → spread math → appraisal-SVG pipeline for *every* raw offer document in
`public/fixtures/offers/`, driven by a structured ground-truth manifest, plus a CLI command to
re-baseline that manifest's extraction snapshot after an intentional `offerParser.js` change.

**Premise correction:** the UOW's framing ("expanding the offer test catalog... with multiple
real-world formats: Carvana screenshots, CarMax PDFs, dealer trade slips") describes fixtures that
don't exist in this repo — there are no PDFs and no additional screenshots, only the 5 raw offer
documents already present: 4 text fixtures (`carmax-offer.txt`, `carvana-offer.txt`,
`hendrick-offer.txt`, `kbb-offer.txt`) and the 1 real JPEG (`carvana-estimated-offer-screenshot.jpeg`,
UOW-42). Built the harness/manifest against what's actually in the repo rather than inventing
fixtures to match the description — the directory-driven coverage test (below) is exactly the
mechanism that will force the manifest to grow the moment a real new fixture (a PDF, another
screenshot) actually gets added.

**`tests/fixtures/manifest.json` (new, centralized — not the pre-existing
`public/fixtures/offers/manifest.json`, which is a different artifact: the UOW-CARBOYZ-34 fixture-
miner's own index/metadata-companion format, still used unmodified by
`tests/offerGalleryFixtures.test.js`).** One entry per raw fixture:
`{ filename, mimeType, competitor, offerSourceType, expectedAmount, expectedExtraction, vehicle }`.
Two ground-truth tiers per entry, deliberately kept separate:
- `expectedExtraction` — exactly what `parseOfferDocument()` *actually* produces for this specific
  file today (verified by literally running the parser against each fixture before writing this
  file). Several fixtures don't extract every field — e.g. `carmax-offer.txt` has no
  `year`/`make`/`model` vehicle-line text, so extraction never finds them, and the harness must not
  assert otherwise.
- `vehicle` — the real, full ground-truth vehicle (year/make/model/vin/mileage), reused directly
  from the pre-existing `public/fixtures/offers/manifest.json` groundTruth for the 4 text fixtures.
  Used to complete the `Submission` payload for Stage 2 when extraction itself came back partial
  (`mapExtractedOfferToFormValues(extracted).field ?? entry.vehicle.field`) — generalizing the
  UOW's own "seed VIN for estimate fixtures lacking visible VINs" idea to every vehicle field, not
  just VIN.

**VIN correction:** the UOW's example seed VIN for the Jeep Wrangler estimate,
`1C4HJXDG2LW123456`, fails ISO 3779 checksum validation (`validateVin()` → false; the correct
check digit for that WMI/VDS/year combination is `7`, not `2`). Used `1C4HJXDG7LW123456` instead
(`validateVin()` → true) — `Submission` itself doesn't enforce VIN checksums so the invalid one
would have "worked," but a ground-truth fixture manifest asserting correctness should itself be
correct.

**`tests/integration/fixtureHarness.test.js` (new):** loops `manifest.json`'s `entries` and emits
one `test()` per fixture (`node --test` reports each individually), plus one coverage test
asserting the manifest's filenames exactly match every non-`.json` file in
`public/fixtures/offers/` (so a newly added fixture fails loudly here instead of silently never
being exercised). Per fixture:
- **Stage 1 (extraction):** POSTs the real file bytes through `/api/offers/parse` (the actual
  route, same as UOW-44). Asserts every key in `EXTRACTABLE_KEYS` (`vin`, `year`, `make`, `model`,
  `mileage`, `competitorOffer`, `competitorName`, `isEstimate`) either exact-matches
  `expectedExtraction` or is confirmed absent — catches drift in both directions (extraction
  finding *less* than the manifest expects, or silently finding *more*), not just regressions.
- **Stage 2 (valuation math):** reuses the real `mapExtractedOfferToFormValues()` (the same
  function `SellerSubmissionView.js` calls) to turn `extracted` into submission-shaped values,
  including the "Other" competitor fallback — `hendrick-offer.txt`'s extracted competitor name
  ("HENDRICK AUTOMOTIVE GROUP - APPRAISAL OFFER") doesn't match any `COMPETITORS` enum value, so it
  resolves to `competitor: 'Other', competitorDealerName: <that string>` exactly like a real
  upload would. Ingests one market comp per fixture, priced at `expectedAmount * 1.15` (a fixed,
  fixture-agnostic rule, not per-fixture tuning) so fair market value always resolves. Then — same
  as UOW-44 — independently re-derives the expected markup from `spreadConfigService`'s *live*
  tiers (not a hardcoded number) via a small `computeExpectedMarkup()` helper that mirrors but
  doesn't call `SpreadService.js`'s matching/offset logic, and asserts the dispatched submission's
  `calculatedCounterOffer`/`finalCounterOffer`/`projectedMargin`/`offerSourceType` match exactly.
- **Stage 3 (artifact):** generates the appraisal SVG and asserts it contains the UOW-43
  conditional-vs-guaranteed banner matching the fixture's `offerSourceType`, and the exact
  formatted counter dollar string.

**Re-baseline CLI — `npm run fixtures:update` (`scripts/update-fixture-manifest.js`, new):**
re-runs `parseOfferDocument()` against every fixture's actual bytes and overwrites only each
entry's `expectedExtraction` block in `tests/fixtures/manifest.json`, leaving `filename`/
`mimeType`/`competitor`/`offerSourceType`/`expectedAmount`/`vehicle` untouched (those are business
ground truth, not parser output). Deliberately scoped to *only* the extraction snapshot: Stage 2/3
(spread math, SVG banner) are intentionally never snapshotted anywhere — per the UOW's own
requirement 2 ("derives counter-offers, margins, and SVG artifacts using *active*
SpreadConfigService settings"), they're asserted dynamically against whatever config is live on
every test run, so there is nothing in that half of the pipeline to re-baseline. Ran the script
once during development and confirmed via `git diff` that it reproduced the hand-written manifest
byte-for-byte — validates both the manifest's accuracy and the script's correctness.

**Verification:** `npm test` → 650/650 passing (6 new tests — 5 per-fixture + 1 coverage check —
on top of the prior 644).

## [UOW-46] Offer Fixture Management Onboarding Guide — 2026-10-08

**Objective:** a developer-ready `README.md` directly in `public/fixtures/offers/` walking any
contributor through adding a new competitor offer fixture — file placement/naming, the
image-hash registration step vs. the text/regex path, updating `tests/fixtures/manifest.json`
(with copy-pasteable templates for both `FIRM_OFFER` and `ESTIMATE`), and the `npm test`/
`npm run fixtures:update` maintenance commands — without needing to read UOW-42/43/45's journal
entries to reconstruct any of it.

**Accuracy checks done before writing, not assumed:** verified the `shasum -a 256` command and the
documented `validateVin()` one-liner both actually work as written (ran them); and was explicit
about a real limitation rather than implying broader support than exists — a genuine binary PDF
does not decode to usable UTF-8 text through the current text/regex path (no PDF-parsing library
is wired in), so the guide tells contributors to write a `.txt` stand-in for a PDF-shaped fixture
today, instead of silently implying PDF uploads already work end-to-end. Also called out, in its
own callout box, that `public/fixtures/offers/manifest.json` (the pre-existing UOW-CARBOYZ-34
fixture-miner index) and `tests/fixtures/manifest.json` (the UOW-45 harness manifest this guide is
actually about) are two unrelated artifacts that happen to share a filename — this was flagged as
a real source of confusion in UOW-45's own `ARCHITECT_JOURNAL.md` entry, so the guide makes the
distinction explicit up front rather than letting a reader conflate them.

**Fix required by the doc's own placement:** `tests/integration/fixtureHarness.test.js`'s coverage
guardrail (UOW-45) only excluded `.json` files when listing "raw fixture files" in the directory —
adding `README.md` directly into `public/fixtures/offers/` (exactly where this UOW asked for it)
tripped that guardrail, since a `.md` file isn't a `.json` file. Fixed the filter to also exclude
`.md`, and updated the one sentence in the README itself that described the old (now-incorrect)
`.json`-only exclusion rule, so the two stay in sync.

**Verification:** `npm test` → 650/650 passing (no new tests — this UOW is documentation plus a
one-line fix to keep an existing test's guardrail accurate after that documentation landed where
it was asked to).

## [UOW-47] Two-Tier Counter Offers: No-VIN Conditional vs. Verified-VIN Guaranteed — 2026-10-13

**Objective:** let a seller submit a VIN-less Carvana-style "Estimate" screenshot without blocking
on VIN entry — a conservative, no-VIN "preliminary" counter is now computable and dispatchable,
with the full tier-based counter unlocked the moment a VIN (typed, scanned, or pasted) is present.

**Design decision requiring a PO call before implementation:** UOW-47's spec gave fixed dollar
ranges for both tiers (no-VIN: +$250-$300, verified-VIN: +$500-$1000), but the existing UOW-44
golden pipeline test (`tests/integration/estimateGoldenPipeline.test.js`) already exercises this
exact Carvana/Jeep fixture *with* a seed VIN and asserts the standard per-competitor/price-tier
bump (~$300, auto-dispatched). Replacing the verified-VIN bump with a new flat $500-1000 value
would have silently changed that golden test's numbers. Per PO direction: **verified-VIN (and
FIRM_OFFER) submissions keep today's tier-based bump completely unchanged** — the UOW-44 golden
test was neither touched nor its outcome altered. Only the no-VIN case is new: a flat, conservative
`NO_VIN_ESTIMATE_BEAT_BUMP` (275, the midpoint of the $250-$300 range) that bypasses the
competitor/price tier ladder entirely.

**Files touched:**
- `src/models/Submission.js` — `vin` is now required unless `offerSourceType === 'ESTIMATE'`;
  stored as `null` rather than throwing when omitted on an estimate.
- `src/services/SpreadConfigService.js` — new exported `NO_VIN_ESTIMATE_BEAT_BUMP = 275` constant.
- `src/services/SpreadService.js` — `calculateSpread()` takes optional `offerSourceType`/`vin`;
  when `offerSourceType === 'ESTIMATE' && !vin`, it uses the flat conservative bump and returns
  `matchedTier: null` instead of resolving the per-competitor tier. Every other combination
  (verified ESTIMATE, FIRM_OFFER, or no `offerSourceType`/`vin` passed at all) is byte-for-byte
  unchanged from before this UOW.
- `src/services/DispatchService.js` — `evaluate()` now forwards `submission.offerSourceType`/
  `submission.vin` into `calculateSpread()`. Side effect (intentional, not incidental): since a
  no-VIN estimate's `matchedTier` is always `null`, `autoApprove` is always `false`, so a no-VIN
  estimate can never auto-dispatch — it always lands on `PENDING_APPROVAL` for a human to confirm,
  regardless of how high the competitor offer is. This wasn't separately specified but follows
  directly from bypassing the tier ladder (which is the only source of `autoApprove: true`).
- `src/ui/LeadInboxController.js` — same `offerSourceType`/`vin` forwarding in both
  `calculateSpread()` call sites (`buildLeadViewModels`, `approveAndSend`); lead view models now
  also carry `vin` so the view can distinguish the no-VIN vs. verified badge.
- `src/ui/LeadInboxView.js` — `offerSourceBadge(offerSourceType, vin)` gained a second, optional
  `vin` parameter: an ESTIMATE with no vin now resolves to a new `NO_VIN_ESTIMATE` badge
  (`[PRELIMINARY - NO VIN]`, amber outline) instead of the solid `[ESTIMATE COUNTER]` badge, which
  is now reserved for a VIN-verified estimate. **Contract change, not additive:** calling
  `offerSourceBadge('ESTIMATE')` with no second argument now returns the no-VIN badge rather than
  the verified one — `tests/ui.leadInboxView.test.js` was updated to match (not a silent
  regression; the old 1-arg call simply had no way to express the new third state).
- `src/ui/styles.css` — new `.badge--preliminary-no-vin` (transparent background, amber border +
  text) alongside the existing solid amber/green badges.
- `src/ui/SellerSubmissionView.js` — `vinInput.required` is now computed dynamically
  (`updateVinRequirement()`) instead of a static HTML `required` attribute: `true` unless
  `offerSourceType === 'ESTIMATE'`. The VIN helper copy for a detected no-VIN estimate now reads
  as an "Unlock Maximum Offer" CTA. No live pre-submit price preview was added — this view has no
  existing hook into `SpreadService`/`TelemetryService` pre-submit (pricing has always happened
  server/controller-side in `DispatchService.dispatch()` after submit), so "dynamic upgrade" is
  realized by the existing data flow: whatever VIN is in the field at submit time flows straight
  through to `Submission`/`calculateSpread()`, which is what actually selects the tier.
- `src/utils/appraisalPdfGenerator.js` — a no-VIN estimate's appraisal sheet no longer renders a
  broken `-appraisal-null.svg` filename or a blank VIN line: `buildAppraisalFilename` falls back to
  `'pending-vin'`, and the VIN row in the SVG falls back to `'Pending Verification'`. This wasn't
  explicitly requested but is a direct, necessary consequence of making `vin` optional — an
  approved no-VIN estimate (status still transitions through `AUTO_COUNTER_SENT` after manual
  approval) can reach the appraisal generator with `vin: null`.

**New tests:** `tests/submission.test.js`, `tests/spreadConfigService.test.js`,
`tests/spreadService.test.js`, `tests/dispatchService.test.js`, `tests/ui.leadInboxController.test.js`,
`tests/ui.leadInboxView.test.js`, `tests/appraisalPdfGenerator.test.js`, plus a new
`tests/integration/twoTierEstimateCounters.test.js` (per UOW-47's explicit ask) that runs the same
Carvana/Jeep "Estimate" screenshot fixture as UOW-44's golden test twice — once with no VIN
(asserts `PENDING_APPROVAL` + the conservative bump) and once with a seed VIN (asserts
`AUTO_COUNTER_SENT` + the unchanged tier-based bump) — through the real `/api/offers/parse` route.

**Verification:** `npm test` → 663/663 passing (13 new tests on top of the prior 650; the UOW-44
golden pipeline test file was not modified and its asserted numbers/outcome are unchanged).
Coverage spot-checked via `node --test --experimental-test-coverage`: `Submission.js` 100/100/100,
`DispatchService.js` 100/94.87/100, `SpreadService.js` 100/94.44/100, `SpreadConfigService.js`
96.07/93.33/100, `LeadInboxController.js` 100/97.37/100 — all well above the 80% line/branch gate.

## [UOW-48] Role Route Separation, Admin PIN Lockout, and Dealer Profile Roster UI — 2026-10-15

**Checkup discrepancy first:** `hydrate checkup` reported UOW-48 as "complete but unarchived"
before any implementation existed. Root cause: `countOpenTasks()` in the `hydrate` CLI only counts
literal `- [ ]` lines, and this UOW's payload was prose/bullets with no checklist syntax, so it
read as 0 open tasks. Verified against the tree (no `AdminView.js`, `adminPin`, etc. existed
anywhere) before proceeding with real implementation — flagged to the Product Owner, who confirmed
to proceed.

**New files:**
- `src/config/viewResolution.js` — pure `resolveActiveView({ search, pathname })`, mirroring the
  existing `tenantResolution.js` precedent. `?view=seller|dealer` wins over the path, `/dealer`
  (with or without trailing slash) resolves dealer when there's no query override, anything else
  defaults to `seller`.
- `src/services/DealerProfileService.js` — tenant-scoped team roster CRUD (`carboyz:dealerProfile:
  {tenantId}` in `storage`), following the `SpreadConfigService`/`SubmissionService` read/write +
  sequence-id pattern. Seeds one default `MANAGER` member ("CarBoyZ Front Desk") when storage is
  empty. `normalizePhone()` accepts a bare 10-digit US number (formatted to `(XXX) XXX-XXXX`) or
  E.164 (`+<digits>`), throws on anything else.
- `src/ui/AdminController.js` — PIN gate + roster delegate. `isUnlocked()`/`attemptUnlock(pin)`/
  `lock()` persist the unlock flag to an injected `storage` (wired to `window.sessionStorage` in
  `App.js`, so it clears on tab close but survives a reload within the session) under
  `carboyz:adminUnlocked:{tenantId}`. `attemptUnlock` checks against `tenantConfig.adminPin`.
- `src/ui/AdminView.js` — renders the 4-digit PIN challenge (auto-advance per digit, auto-submit on
  the 4th, error + reset on mismatch) when locked; when unlocked, renders the team roster form/list
  plus a "Lock Admin" button, and nests the existing `renderSpreadConfigView` pricing-tier UI below
  it (its returned section's `id` is stripped and its `<h2>` retitled to "Pricing Tiers" via direct
  DOM mutation, so there's no duplicate `#view-admin` id or duplicate "Admin" heading — chosen over
  editing `SpreadConfigView.js` itself since nothing else needed to change there).

**Modified:**
- `src/config/tenantConfig.js` — `DEFAULT_TENANT_CONFIG.adminPin = '1234'` (exported as
  `DEFAULT_ADMIN_PIN`), flows to every tenant preset through `TenantRegistry.register()`'s existing
  `createTenantConfig(preset)` call.
- `src/ui/App.js` — `mountApp()` now resolves `activeView` once at mount from
  `window.location.search`/`pathname`. `render()` branches early for `VIEWS.SELLER`: only the
  branding header, offline banner, the Sell form, and the PWA install prompt are composed (no tab
  bar, no bottom nav, no dev Test Bed drawer). The dealer-portal branch replaces the old direct
  `renderSpreadConfigView(spreadConfigController)` call with
  `AdminController` + `renderAdminView(...)`, and gets a subtle `<a class="app__seller-link"
  href="?view=seller">` footer link per the spec ("toggle... to view the public seller intake
  without cluttering the operational nav") — seller view intentionally has no link back, since
  public sellers shouldn't see dealer-only chrome at all.
- `src/server/index.js` — added `app.get('/dealer', ...)` serving the same `index.html` shell as
  `/`, since Hono's `serveStatic` has no history-API fallback and a bare `/dealer` navigation would
  otherwise 404. (Product Owner explicitly chose query-param + server-side path routing over
  query-param-only, after being asked since it touches a file outside the UOW's named scope.)
- `src/ui/styles.css` — themed `.pin-challenge`/`.pin-challenge__digit` (was using unstyled browser
  default white inputs against the dark CarBoyZ theme until caught in the browser pass below),
  `.team-roster`, `.view__header-row`, `.app__seller-link`.

**New tests:** `tests/viewResolution.test.js`, `tests/dealerProfileService.test.js`,
`tests/ui.adminController.test.js`, plus additions to `tests/tenantConfig.test.js` (adminPin
default/override) and `tests/server.test.js` (`GET /dealer` serves the shell). No DOM-rendering
tests were added for `AdminView.js`/`App.js` — consistent with the existing repo precedent (`App.js`,
`BottomNavView.js`, `SpreadConfigView.js` have no dedicated unit tests either); all PIN/roster
*logic* lives in the tested `AdminController`/`DealerProfileService` instead.

**Verification:** `npm test` → 691/691 passing (28 new tests on top of the prior 663). Also drove
the real app end-to-end with Playwright (chromium, headless) against `node src/server/index.js`:
`/` shows only the header + intake form with no tab bar; `/dealer` shows the full tab bar; the
Admin tab PIN-gates with a visible error on a wrong PIN and unlocks on `1234`; adding a team member
through the roster form round-trips through `DealerProfileService` and renders with the normalized
phone; "Lock Admin" re-locks; the seller-view footer link is present on the dealer portal.
Screenshots reviewed, caught and fixed the unstyled-PIN-input and duplicate-"Admin"-heading issues
noted above before considering this done.

## [UOW-49] Desk Actions, Title Disclaimers, SMS Dispatch Hook & Hono Dealer BasicAuth — 2026-10-15

**Path mapping:** The UOW spec's file paths assumed a `src/client/` vs `src/server/` split that
doesn't exist in this repo — services/models/UI all live flat under `src/services`, `src/models`,
`src/ui`. Mapped surgically onto the real tree instead of creating a parallel structure:
`src/models/Submission.js`, `src/ui/LeadInboxController.js`/`LeadInboxView.js`,
`src/utils/appraisalPdfGenerator.js`, `src/services/DispatchService.js` (already existed), and the
new `src/services/NotificationService.js` (not `src/server/services/...` — see below).

**Task 1 — Hono basicAuth (`src/server/index.js`):** Added `basicAuth` from `hono/basic-auth` on
`app.use('/dealer', ...)` and `app.use('/dealer/*', ...)`, registered before the existing
`app.get('/dealer', ...)` SPA-shell route and before the catch-all `serveStatic`. Credentials read
from `process.env.DEALER_USER`/`DEALER_PASSWORD`, defaulting to `admin`/`carboyz2026` for a fresh
checkout. `/`, static assets, and `/api/offers/*` are untouched and stay public.

**Task 2 — Submission model (`src/models/Submission.js`):** Added `'REJECTED'` to
`SUBMISSION_STATUSES` and a new `REJECTION_REASONS` enum (5 values incl. `OTHER`) plus nullable
`rejectionReason`/`rejectionNotes` fields. `rejectionReason` is required when `status ===
'REJECTED'` and, when present, must be one of the enum keys; `rejectionNotes` is free-text and
optional. Enforced in the constructor alongside the existing validation precedent.

**Task 3 — Desk Pass/Reject (`src/ui/LeadInboxController.js` + `LeadInboxView.js`):** Controller
gained `rejectLead(id, { rejectionReason, rejectionNotes })`, a thin wrapper over the existing
generic `submissionService.updateFields` (same pattern as `markWinLoss`/`approveAndSend`), and
`buildLeadViewModels()` now surfaces `rejectionReason`/`rejectionNotes`. View adds a "Pass /
Reject" button beside "Approve & Send" on `PENDING_APPROVAL` cards, a reusable rejection modal
(reason `<select>` + optional notes `<textarea>`, mirroring the existing `renderDocumentModal`
singleton-overlay pattern), a muted-gray `[PASSED]` badge + disabled counter actions for
`REJECTED` leads (new exported pure helper `isPassedLead(status)`, consistent with the existing
`offerSourceBadge` pure-helper testing precedent), and an "Active Leads" / "Passed / Closed Leads"
filter toggle that filters the already-fetched lead list client-side.

**Task 4 — Title/theft disclaimers (`src/utils/appraisalPdfGenerator.js`):** Added two disclaimer
strings (conditional-on-physical-title-inspection; NMVTIS/CARFAX/AutoCheck branding + lien release
+ NICB theft records) to `buildAppraisalPayload`'s `disclaimers` array (3 → 5). Since the existing
`renderDisclaimers` rendered each disclaimer as one fixed-position `<text>` line with no wrapping,
longer disclaimer text would have overflowed/truncated past the document's right margin as the UOW
explicitly warned against — added a small greedy `wrapText()` word-wrapper (92-char budget sized to
the printable width) and made the footer position float below the wrapped content instead of a
fixed offset, so it never collides.

**Task 5 — NotificationService SMS dispatch (`src/services/NotificationService.js`):** Built as a
browser-safe module (not server-only) with `ConsoleSmsAdapter` (dev/test default, logs to stdout)
and `TwilioSmsAdapter` (calls Twilio's REST API directly via `fetch` + HTTP Basic Auth — no SDK
dependency added, keeping the zero-dependency precedent) selected by `createSmsAdapterFromEnv(env)`
when `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`FROM_NUMBER` are all set. `NotificationService.notify()`
matches `DispatchService`'s existing `notifier.notify(notification)` contract, so it plugs straight
into the `notifier` DI slot already in `DispatchService.dispatch()`'s `PENDING_APPROVAL` branch;
extended `buildApprovalNotification()` to carry the full `submission` object (additive — existing
`target`/`title`/`body`/`submissionId` assertions in `dispatchService.test.js` are unaffected) so
the notifier can read `year`/`make`/`model`/`competitor`/`amount` for the SMS template.
`notifyPendingApproval()` filters `dealerProfileService.listMembers()` strictly to
`notifyOnPending === true` before sending.

**Security note (deviation from the literal UOW path):** The UOW named
`src/server/services/NotificationService.js`, implying server-side dispatch, but `DispatchService`
— the thing that actually triggers `PENDING_APPROVAL` — only ever runs client-side today (no
server route for it exists). Rather than invent a new unrequested server endpoint, wired
`NotificationService` into `App.js`'s existing `createDistroNotifier()` with its
`ConsoleSmsAdapter` default only. Real Twilio credentials are never read into the browser bundle —
`createSmsAdapterFromEnv` reads `process.env` and is only meaningfully exercised in Node (tests);
the browser wiring documents this tradeoff inline rather than shipping a secrets-in-the-client
vulnerability. Flagged to the Product Owner in the session summary rather than silently assumed.

**New tests:** `tests/notificationService.test.js` (new — adapters, template, roster filtering,
`notify()` delegation), plus additions to `tests/submission.test.js` (REJECTED/rejectionReason
validation), `tests/ui.leadInboxController.test.js` (`rejectLead`), `tests/ui.leadInboxView.test.js`
(`isPassedLead`), `tests/appraisalPdfGenerator.test.js` (new disclaimer content + word-wrap/no-
overflow check), `tests/dispatchService.test.js` (NotificationService wired as the real notifier),
and `tests/server.test.js` (401 without creds, 200 with creds, `/dealer/*` sub-paths, env-var
override, `/` and `/api/offers/*` stay public). No DOM-rendering tests for the new
modal/filter-toggle UI in `LeadInboxView.js` — consistent with this repo's existing precedent that
View files are exercised only through their exported pure helpers (`offerSourceBadge`,
`isPassedLead`), with the actual logic covered in the tested `LeadInboxController`.

**Verification:** `npm test` → 720/720 passing (29 new tests on top of the prior 691).
`node --test --experimental-test-coverage` confirms every modified core domain model/service clears
the 80% line+branch gate: `Submission.js` 100/100, `DispatchService.js` 100/94.87,
`NotificationService.js` 100/100, `LeadInboxController.js` 100/97.44. Did **not** drive this one
through a real browser session (no UI-automation tool available in this session) — the new
Pass/Reject modal, filter toggle, and badge wiring in `LeadInboxView.js` are unverified beyond unit
tests on their pure helpers and the controller logic underneath; flagged to the Product Owner as a
follow-up before next live test-drive.

## [UOW-50] Desk Unreviewed Lead Escalation Nags & Operating Quiet Hours — 2026-10-15

**Path mapping:** The UOW spec again assumed `src/client/models/TenantConfig.js` and
`src/client/services/...`, which don't exist in this repo's flat `src/config`/`src/services`/`src/ui`
layout. Mapped onto the real files: `src/config/tenantConfig.js` (the actual tenant-config model —
plain factory functions, not a class), `src/services/TenantConfigService.js`,
`src/models/Submission.js`, `src/services/NotificationService.js`, the new
`src/services/LeadEscalationService.js`, and `src/ui/LeadInboxController.js`/`LeadInboxView.js`.

**Task 1 — Operating schedule (`src/config/tenantConfig.js` + `TenantConfigService.js`):** Added
`DEFAULT_OPERATING_SCHEDULE` (`enabled`, `openHourLocal: 8`, `closeHourLocal: 21`,
`timeZone: 'America/New_York'`, `nagIntervalMinutes: 15`) to `DEFAULT_TENANT_CONFIG`, merged in
`createTenantConfig` the same way `themeColors`/`contact` already are. Added the pure helper
`isWithinOperatingHours(date, schedule)`: resolves the hour via `Intl.DateTimeFormat` in
`schedule.timeZone` (not the runtime's own zone), supports an overnight window that wraps past
midnight (close hour <= open hour), and treats a disabled schedule as always-open.
`TenantConfigService` had no notion of "the active tenant" before this UOW (`applyTenant()` only
ever touched the DOM); it now also stores `this.activeTenantConfig` and exposes
`getOperatingSchedule()` so `LeadEscalationService` can read the live schedule without reaching
into a second service.

**Task 2/3 — `LeadEscalationService` (new):** `evaluatePendingLeads({ now })` scans
`submissionService.getSubmissions()` for `status === 'PENDING_APPROVAL'` with no `nagSentAt` that
have waited past `nagIntervalMinutes`; inside operating hours it calls
`notificationService.notifyEscalation({ submission, elapsedMinutes })` and stamps `nagSentAt`,
otherwise it flags `queuedForMorningDigest: true` and sends nothing. `evaluateMorningDigest({ now
})` is a no-op during quiet hours; once open, it rolls every `queuedForMorningDigest` lead into one
`notificationService.notifyMorningDigest({ count })` call and clears the flag (stamping
`digestSentAt`) so a later sweep in the same open period doesn't re-fire — this data-driven
idempotency stands in for an explicit "closed→open transition" state machine, since nothing else in
this app persists a server-side clock tick to detect that edge.

**Model fields (`src/models/Submission.js`):** The UOW only called out `TenantConfig.js` for field
additions, but Tasks 2/3 patch `nagSentAt`/`queuedForMorningDigest`/`digestSentAt` through
`submissionService.updateFields()`, which rebuilds a `Submission` from named constructor params —
any field not in that whitelist would silently vanish on every patch. Added all three (with the
same validate-in-the-constructor precedent as every other field) as a required data-contract fix,
not scope creep.

**`NotificationService` additions:** `formatEscalationSms`/`formatMorningDigestSms` match the UOW's
literal templates. `notifyEscalation` reuses the existing `notifyOnPending === true` roster gate
(same audience as a fresh pending-approval alert). `notifyMorningDigest` filters to
`role === TEAM_MEMBER_ROLES.MANAGER` instead, since the template text explicitly addresses "desk
managers," not the full roster — imported `TEAM_MEMBER_ROLES` from `DealerProfileService.js`.

**Task 4 — Lead Inbox badges (`LeadInboxController.js` + `LeadInboxView.js`):** Controller's
`buildLeadViewModels()` now also surfaces `timestamp` and `nagSentAt` (needed by the view, previously
dropped). View adds two pure, directly-tested helpers: `needsReviewBadge(status, elapsedMinutes)`
→ `[NEEDS REVIEW - 15m+]` only for a `PENDING_APPROVAL` lead past the 15-minute threshold, and
`formatEscalatedAtLabel(nagSentAt)` → `"Escalated to desk at HH:MM"` or `null`. Wired into
`renderLeadCard` alongside the existing badge row/meta row. New `.badge--needs-review` CSS class
pulses between red and amber via a `@keyframes` animation for the "high-visibility" requirement.

**Not wired into `App.js`:** The UOW's five tasks stop at "implement and test the service" / "wire
the badges" — there's no task asking for a polling loop (`setInterval`) to actually call
`evaluatePendingLeads`/`evaluateMorningDigest` on a timer. Left that wiring out rather than
inventing an unrequested scheduler; flagged to the Product Owner as the obvious next step before
this feature does anything live.

**New tests:** `tests/leadEscalationService.test.js` (new — constructor guards, escalate-during-
open-hours, queue-during-quiet-hours, interval/already-nagged/non-pending exclusions, digest
dispatch + flag-clearing, digest no-ops), plus additions to `tests/tenantConfig.test.js`
(`isWithinOperatingHours` daytime/midnight/overnight-wrap/timezone-boundary/disabled cases),
`tests/tenantConfigService.test.js` (`getOperatingSchedule`), `tests/submission.test.js` (new field
defaults/validation), `tests/notificationService.test.js` (new templates + `notifyEscalation`/
`notifyMorningDigest` roster filtering), `tests/ui.leadInboxView.test.js` (`needsReviewBadge`,
`formatEscalatedAtLabel`), and `tests/ui.leadInboxController.test.js` (view-model passthrough).

**Verification:** `npm test` → 744/744 passing (24 new tests on top of the prior 720).
`node --test --experimental-test-coverage` confirms every modified core domain model/service clears
the 80% line+branch gate: `Submission.js` 100/100, `LeadEscalationService.js` 100/95.83,
`NotificationService.js` 100/100, `TenantConfigService.js` 94.89/95.35, `tenantConfig.js` 97.47/92.31,
`LeadInboxController.js` 100/97.44. `LeadInboxView.js`'s DOM-rendering code stays outside the gate,
consistent with UOW-49's precedent and this repo's established pattern of testing that file only
through its exported pure helpers. Did not drive this through a live browser session — no
UI-automation tool available in this session; flagged above as a follow-up alongside the missing
`App.js` polling wire-up.

## [UOW-51] Streamlined 3-Pillar Customer Intake (VIN, Mileage, Offer Doc) — 2026-10-15

**Paths:** as with prior UOWs, the spec named `src/client/...` paths that don't exist here —
mapped onto the real `src/models/Submission.js`, `src/ui/SellerSubmissionView.js`,
`src/ui/SellerSubmissionController.js`.

**Three scope conflicts surfaced and resolved with the Product Owner before implementation** (all
three follow the same shape: the UOW's literal text would have broken a battle-tested, already-
shipped capability used by other pipelines, so enforcement was pushed to the customer-facing
seller form instead of the shared domain layer):

1. **VIN decode source.** `resolveVehicleFromVin()` named in the UOW only existed in the dev Test
   Bed (`src/components/dev/TestBedDrawer.js`), importing `@nemzilla/test-core` — a package
   explicitly described as a "developer test-bed toolkit." PO authorized promoting a standalone,
   zero-dependency production decoder: new `src/services/nhtsaVinDecoder.js`, calling NHTSA's
   public vPIC endpoint directly with a fetch timeout (`AbortController`), never importing
   `@nemzilla/test-core`. Never throws — any failure degrades to a `manual-fallback` shape.
2. **The UOW-47 no-VIN "ESTIMATE" preliminary-counter path.** Making `vin` unconditionally required
   on `Submission` would have broken `DispatchService`, `SpreadService`,
   `SpreadConfigService.NO_VIN_ESTIMATE_BEAT_BUMP`, the Lead Inbox `[PRELIMINARY - NO VIN]` badge,
   the appraisal PDF's conditional label, and `tests/integration/twoTierEstimateCounters.test.js`.
   PO decision: keep the model/service-layer exception exactly as-is (`vin` still optional only
   when `offerSourceType === 'ESTIMATE'`); the live seller form just always requires VIN input, so
   that no-VIN path is simply never reached from this UI anymore — it stays intact for other
   intake channels.
3. **`offerDocument` as a hard-required field.** `src/ui/TestHarnessView.js`'s synthetic-data
   generator (`buildMockAppraisal`, `decodeAppraisalFromUrlParam` — the completed Analytics/
   Simulation epic's seeding pipeline) always constructs submissions with `offerDocument: null`,
   and `tests/ui.testHarnessView.test.js` asserts the model accepts that shape. By the same
   precedent as #2, `offerDocument` stays optional/nullable on `Submission.js` and in
   `SellerSubmissionController.js` — the "always require it" rule is enforced only in
   `SellerSubmissionView.js`'s submit-button gating (see below). Flagging this explicitly in case
   the PO actually wanted a hard model-layer throw; that would require reworking the synthetic
   seeding pipeline as a separate, deliberately-scoped follow-up.

**`src/models/Submission.js`:** `zipCode`/`year`/`make`/`model` relaxed to optional/nullable (same
treatment as `trim`), with type validation when present. `mileage` tightened from a falsy-check to
an explicit positive-number check (`typeof === 'number' && > 0`) — closes a prior gap where a
negative mileage passed validation. `vin`'s existing UOW-47 conditional requirement is unchanged.

**`src/services/nhtsaVinDecoder.js` (new):** zero-dependency `resolveVehicleFromVin(vin,
{ fetchImpl, timeoutMs })`, mirroring `@nemzilla/test-core`'s NHTSA normalization shape but
decoupled from it, with an `AbortController`-based timeout. Never throws.

**`src/ui/SellerSubmissionView.js`:** Year/Make/Model/Trim manual inputs moved out of the default
form into a new collapsible `<details class="sell-form__details-drawer">` ("Extracted Offer
Details") that also now houses Competitor/Dealer Name/Offer Amount — hidden until a document is
uploaded, then auto-expanded and still editable. Dropzone moved to the top of the form and
relabeled; VIN input is now unconditionally `required`; mileage/zip rows relabeled "Current
Mileage" / "ZIP Code (Optional)" (zip's `required` attr removed). VIN now triggers an async
`nhtsaVinDecoder.resolveVehicleFromVin()` lookup (on scan, on a completed valid typed VIN, or on an
OCR-extracted VIN) that fills year/make/model/trim only where still empty, never overwriting an
OCR- or user-supplied value. New `hasThreePillars()`/`updateSubmitState()` disable the submit
button (with a `pillarHintEl` warning) until VIN + positive mileage + an attached document are all
present; fixed a bug caught during this work where the submit handler's `finally` block
unconditionally re-enabled the button after a successful submit, which would have let a seller
tap Submit again on a now-empty, mid-reset form.

**`src/ui/SellerSubmissionController.js`:** unchanged — see conflict #3 above. Pillar enforcement
for VIN/mileage already happens via `Submission`'s constructor (called before
`dispatchService.dispatch()`); the document pillar is UI-gated only.

**New tests:** `tests/nhtsaVinDecoder.test.js` (new — malformed VIN, happy path, "Not
Applicable"/null NHTSA fields, non-OK status, empty result set, network failure, timeout,
non-string input, messageless thrown error). `tests/ui.sellerSubmissionView.test.js` (new — first
dedicated test file for this view; added a minimal hand-rolled DOM shim at
`tests/helpers/fakeDom.js`, no jsdom dependency, since `h()` in `App.js` needs a real
`document.createElement`). `tests/submission.test.js` updated for the relaxed/tightened fields.

**Verification:** `npm test` → 762/762 passing (16 new tests on top of the prior 746; zero
regressions, including every UOW-47 ESTIMATE/no-VIN fixture across
`dispatchService`/`spreadService`/`spreadConfigService`/`appraisalPdfGenerator`/
`ui.leadInboxView`/`ui.leadInboxController`/`integration/twoTierEstimateCounters`).
`node --test --experimental-test-coverage`: `Submission.js` 100/100/100,
`nhtsaVinDecoder.js` 100/95.83/80 (both clear the 80% gate; the `AbortController`-missing
defensive branch was removed rather than left uncovered, since every supported Node/browser target
has it). `SellerSubmissionView.js` sits at ~50% line / 19% function coverage from the new layout
tests alone — left outside the 80% gate like every other View file in this repo
(`PwaInstallPromptView.js` 52%, `SimulationView.js` 10%), since the gate's own wording scopes to
"core domain models and business logic services," not presentation code. Did not drive this
through a live browser session — no UI-automation tool available in this session.

## UOW-52 — Acquisition Radar (Carto Dark Matter Map), Unlocated Leads Queue & Escalation Heartbeat — 2026-10-15

**Task 1 — Escalation heartbeat.** `LeadEscalationService.js` already had `evaluatePendingLeads`/
`evaluateMorningDigest` from UOW-50 but no interval wiring. Added `startEscalationTicker(service,
{ intervalMs = 60000, now })` / `stopEscalationTicker(handle)` (plain exported functions, not
class methods — `service` only needs to duck-type the two evaluate methods). `App.js`'s
`mountApp()` starts the ticker once, only when `resolveActiveView(...) === VIEWS.DEALER`, passing
an indirection object whose methods always resolve `getTenantState(activeTenantConfig.tenantId)`
fresh on every tick — so a `switchTenant()` call after the ticker started still ticks the
currently-active tenant, not whichever tenant was active at mount. Cleared via
`window.addEventListener('beforeunload', ...)`. Each per-tenant `getTenantState()` now also builds
a `LeadEscalationService` (added to the per-tenant `state` object) wired to that tenant's
`submissionService`/`notificationService` and the single app-level `tenantConfigService`.

**Task 2/3 — `src/services/radarLayerBuilder.js` (new).** Pure, DOM-free GeoJSON builders, same
split carboyzAdapter.js established for the dealer/vehicle map: `buildHqAnchorFeature`,
`buildRangeRingFeature(s)` (10/25/50mi circle polygons via a destination-point/great-circle
formula — `toRadians`/`toDegrees`/`EARTH_RADIUS_MILES` promoted to exports in `src/utils/geo.js`
for reuse), `resolveSubmissionCoordinates` (explicit `submission.lat/lng` wins, else
`resolveZipOffline(submission.zipCode)`), `classifyLeadPinStatus`, and
`buildLeadOriginFeatureCollection` (splits into a mapped `FeatureCollection` + an `unlocated`
array). Added `Submission.lat`/`Submission.lng` (optional, must be present/absent together,
`allowNegative: true`). Added `resolveZipOffline(zipCode)` to `locationAdapter.js` — a
synchronous, network-free 5-digit-exact-match wrapper around the existing offline gazetteer, since
`resolveLocationQuery()` is async (tries Google/OSM first) and radarLayerBuilder needs a
synchronous resolution path. Added `dealershipCoordinates` to `TenantConfig`
(`DEFAULT_DEALERSHIP_COORDINATES = { lat: 34.2526, lng: -78.0383 }`, the literal HQ anchor the UOW
spec names — note this doesn't match the "Leland Motors" dealer coordinates used elsewhere in the
codebase, `{ lat: 34.2388, lng: -78.0145 }`; kept them separate since the UOW spec gave an explicit
literal default for this new field).

**Status→pin-color mapping (judgment call, not explicit in the model).** The spec's three buckets
(PENDING_APPROVAL=amber / AUTO_COUNTER_SENT+ACCEPTED+WON=green / REJECTED+PASSED+LOST=gray)
reference `ACCEPTED`/`WON`/`PASSED`/`LOST` as if they were `Submission.status` values, but the real
`SUBMISSION_STATUSES` enum has no such values — `WON`/`LOST`/`MANUAL_APPROVED`/etc. live on the
separate `winLossStatus` field. `classifyLeadPinStatus()` checks `status` first
(`REJECTED`→CLOSED, `AUTO_COUNTER_SENT`→ACTIVE), falls back to `winLossStatus`
(`WON`/`MANUAL_APPROVED`→ACTIVE, `LOST`/`EXPIRED`/`DECLINED`→CLOSED), and buckets every other open
status (`NEW`/`IN_REVIEW`/`OFFER_BEATEN`/`DECLINED`) as PENDING, since those still need desk
attention. Flagging this mapping explicitly in case the PO wants a different bucketing once seen
live.

**Task 4 — `src/ui/RadarMapView.js` (new), replaces `MapView.js` on the "map" tab.** Same
`{ section, mount, update }` contract as the old `MapView.js` (which stays in the tree, unused, in
case the dealer/vehicle inventory map is wanted back later — nothing else imports it except its
now-exported `resolveMapStyleUrl`/`CARTO_DARK_MATTER_STYLE_URL`, reused here). Renders directly via
MapLibre's native GeoJSON source/layer API (`circle`/`line`/`fill`/`symbol` layers +
`match`/`filter` expressions) rather than spatial-core's `renderTopicLayer` — that abstraction is
built around the dealer/vehicle "topic" shape and doesn't fit polygons + a `pinStatus`-keyed color
match well. Pulsing PENDING halo: a second `circle` layer filtered to `pinStatus === 'PENDING'`,
with a `setInterval` toggling its `circle-opacity`/`circle-radius` paint properties every 650ms
(cleared on `beforeunload`) — simpler and more testable-by-inspection than a MapLibre paint-
expression animation. Inspection drawer and "Open in Lead Inbox" button reuse the same
`showInspectionDrawer(properties)` path for both a map-pin click and an Unlocated-dock item click.
App.js wires `onOpenLeadInbox` through a late-bound `goToLeadsTab` closure (set once `render()`
defines `handleTabSelect`), since the shared `mapView` instance is constructed once in `mountApp()`
before `render()`/`handleTabSelect` exist. Also found and fixed a second, pre-existing staleness
gap while live-testing (see below): `handleTabSelect('map')` now re-pushes
`mapView.update(state.submissionService.getSubmissions(), activeTenantConfig)` on every tab entry,
not just on the last app-level `render()` — same reason `leads`/`analytics` already call their own
explicit refresh on tab select (the Test Harness's "Seed N Historical Leads" button, and any other
out-of-band `submissionService` write, doesn't itself trigger `render()`).

Tab button relabeled "Map" → "Acquisition Radar" (`mapBtn`/`mapView` variable names left as-is —
only the UI-facing text changed, to keep the diff surgical). Added `.radar-metric-pill`,
`.radar-unlocated-dock*`, `.radar-pin-badge` to `styles.css`, reusing the existing
`.map-drawer`/`.map-view__canvas` classes for the inspection drawer and canvas.

**Live-browser bug found & fixed:** `renderLayers()` originally guarded on
`map.isStyleLoaded()`, called synchronously from inside the map's own `'load'` event handler right
after `initLayers()` added the GeoJSON sources — but `isStyleLoaded()` also waits on those
just-added sources finishing their own load, which isn't true in that same synchronous tick, so
the very first render silently no-op'd (empty metric pill, no HQ pin/rings/lead pins visible).
Replaced with an explicit `styleReady` flag set `true` inside the `'load'` handler itself. Caught
via a real `npm start` + Playwright session (dealer basic-auth `admin`/`carboyz2026`, seeded 50
historical leads via the Test Harness tab) — confirmed visually afterward: HQ pin + labeled
10/25/50mi rings, status-colored lead pins, a live `"Active Leads within 25mi: 38 | Awaiting
Review: 0 | Unlocated: 0"` metric pill, clicking a pin opened the inspection drawer with correct
vehicle/competitor/counter/distance data, and "Open in Lead Inbox" switched tabs to a Lead Inbox
showing that same lead.

**Files touched:** `src/config/tenantConfig.js`, `src/models/Submission.js`,
`src/adapters/locationAdapter.js`, `src/utils/geo.js`, `src/services/radarLayerBuilder.js` (new),
`src/services/LeadEscalationService.js`, `src/ui/App.js`, `src/ui/RadarMapView.js` (new),
`src/ui/MapView.js` (two consts exported, no behavior change), `src/ui/styles.css`.

**Tests:** `tests/radarLayerBuilder.test.js` (new — HQ anchor, ring-polygon geometry via
haversine-distance-from-center assertions, coordinate resolution precedence, pin-status
classification, located/unlocated split), `tests/leadEscalationService.test.js` (ticker
start/interval/stop via `node:test`'s `t.mock.timers`), plus coverage additions to
`tests/tenantConfig.test.js`, `tests/submission.test.js`, `tests/locationAdapter.test.js`.
`npm test` → 785/785 passing (23 new on top of the prior 762; zero regressions). No coverage tool
is configured in this repo (`"test": "node --test"`, no c8/nyc) — spot-checked
`radarLayerBuilder.js` and the `LeadEscalationService.js` ticker additions by test-case coverage
inspection instead (every branch of `classifyLeadPinStatus`, both ring/HQ geometry paths, and both
ticker start/stop paths have a dedicated assertion). `RadarMapView.js` itself has no dedicated unit
test file, consistent with `docs/TEST_PLAN.md`'s existing "UI Views: Manual / Browser Smoke Drive"
gate (the same treatment `MapView.js` already had) — verified instead via the live Playwright
session described above.

## [UOW-HOTFIX] Radar inspection drawer polish — 2026-10-15

Found during a live `npm start` + Playwright QA pass against UOW-52 (checklist: clean tree, HQ
pin/rings/metric pill, pin + Unlocated-dock drawer interaction, 60s escalation ticker). Two bugs
in `src/ui/RadarMapView.js`, both in `showInspectionDrawer()`:

1. **Literal `"null"` text in the drawer.** `drawerBody.append(...)` is native `Element.append()`,
   which stringifies a non-Node argument instead of skipping it like this codebase's own
   `h()`/`el()` helpers do — so the conditional `properties.distanceFromHqMiles != null ? el(...) :
   null` entries rendered a literal `"null"` text node whenever a lead had no HQ distance (every
   Unlocated Leads dock item, since those have no resolved coordinates to measure from).
   Reproduced live: clicking the dock's one unlocated lead showed `"...Counter offer:
   $10,100nullOpen in Lead Inbox"`. Fixed by `.filter(Boolean)`-ing the element array before
   spreading it into `.append(...)`.
2. **No background-click-to-dismiss.** The old `MapView.js` closed its drawer on
   `onMapBackgroundClick`; `RadarMapView.js` only closed it via the drawer's own Close button,
   so returning to the Radar tab with the drawer left open from an earlier click intercepted
   pointer events on the Unlocated Leads dock underneath it (also caught live, via the QA
   script's attempted dock-item click). Added a generic `map.on('click', ...)` handler that
   `queryRenderedFeatures` at the click point and hides the drawer when the click didn't land on
   a `radar-lead-origin-pins` feature.

Re-verified live after the fix: the Unlocated dock item's drawer now reads cleanly (no stray
`"null"`), and clicking empty map background dismisses the drawer. `npm test` → 785/785, no
regressions.

## [UOW-HOTFIX] Standardize Leland HQ storefront coordinates + SMS relay decision — 2026-10-15

**Item: standardize the Leland HQ storefront coordinates.** Audit found three different numbers
all claiming to represent the CarBoyZ Leland, NC storefront, drifted by up to ~10 miles apart:
`seedInventory.js`'s `SEED_ANCHOR` (`{34.35, -77.8}`, comment incorrectly said "Rocky Point, NC"
despite being tagged with Leland's own ZIP 28451), `tenantConfig.js`'s
`DEFAULT_DEALERSHIP_COORDINATES` (`{34.2526, -78.0383}`, UOW-52's literal spec value), and the
already-cross-referenced pair of `LOCAL_DEALERS`' "Leland Motors" dealer +
`locationAdapter.js`'s `KNOWN_LOCATIONS` ZIP 28451 gazetteer entry (`{34.2388, -78.0145}` — also
already asserted as "the Leland fallback location" in `tests/seedInventory.test.js`). Standardized
on the last one, since it was the most independently cross-referenced/verified value already in
the codebase, and fixed `SEED_ANCHOR`'s mislabeled comment. Also found that `summit-auto` and
`harbor-motors` in `App.js`'s `TENANT_PRESETS` had no `dealershipCoordinates` override at all —
both would have silently inherited the Leland default for their own Acquisition Radar HQ anchor
(a real tenant-isolation bug for any non-CarBoyZ tenant). Gave each an explicit override matching
its own dealer cluster (`summit-central` for Summit, `harbor-pier` for Harbor). Verified live:
CarBoyZ's radar still centers correctly near Leland/Navassa, and switching to Summit Auto Group
now correctly re-centers the radar on Denver ("Summit Auto Group HQ") instead of leaking Leland,
NC — this was the actual bug the live check surfaced. `npm test` → 785/785 (updated
`tests/tenantConfig.test.js` and `tests/radarLayerBuilder.test.js`'s hardcoded expectations for
the new default value; no other test depended on the exact old literal).

**Item: server-side Twilio SMS relay — decision.** `NotificationService.js` already has a fully
built `TwilioSmsAdapter` (real Twilio REST API call via `fetch`, HTTP Basic Auth) and
`createSmsAdapterFromEnv(env)` (picks it when `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_FROM_NUMBER` are set), but neither is wired to anything — `createSmsAdapterFromEnv` is
dead code today. `App.js` always constructs `NotificationService` with its default
`ConsoleSmsAdapter`, by design (its own comment: the browser bundle never has access to
server-side Twilio secrets). There is no server endpoint in `src/server/index.js` the browser
could call to relay through a server-side `TwilioSmsAdapter` either.

**Decision: keep the console logger for the initial dealer walkthrough.** Rationale (see the
Architecture Journal's Decision Log for this entry): building the relay is non-trivial new scope
(a new authenticated API endpoint to prevent an open SMS-relay abuse vector, real Twilio account
credentials/costs, A2P 10DLC compliance for US SMS, retry/error handling) with no indication the
walkthrough itself needs real SMS delivery — the console log already demonstrates the full
notification content/logic end-to-end for review. `TwilioSmsAdapter`/`createSmsAdapterFromEnv`
are already built and unit-tested in isolation, so wiring the relay later is a bounded, scoped
addition whenever actually needed, not a from-scratch effort. Flagged to the Product Owner in the
session response in case this call should go the other way before the walkthrough.

## UOW-53 — Dealer Offer & Counter Grid View with Inline Adjustment Engine (2026-10-15)

**Summary:** New `src/ui/OfferCounterTableView.js` tabular desk workspace — every submission in
one sortable grid (newest first), replacing per-lead card scrolling for high-volume desk review.

**Files touched:**
- `src/ui/OfferCounterTableView.js` (new) — the grid: summary KPI chips (Total Bids, Pending
  Review, Aggregate Projected Margin), a quick filter bar (All / Needs Review / Counter Sent /
  Passed), the `.data-table` itself (Timestamp, Vehicle, Competitor, Market Spread/Margin Badge,
  Proposed Counter, Status, Actions), an inline stepper+live-recalculation panel for adjusting a
  PENDING_APPROVAL lead's counter (+$100/+$250/+$500 or exact entry), an "Inspect" slide-out
  detail drawer, and a reused Pass modal. Pure helpers (`sortLeadsByTimestampDesc`,
  `filterOfferGridLeads`, `computeOfferGridSummary`, `previewCounterAdjustment`) are exported
  separately from DOM rendering for direct unit testing, mirroring `LeadInboxView.js`'s existing
  split — the project's established pattern of not DOM-testing the render functions themselves.
- `src/ui/LeadInboxController.js` — added `overrideCounterOffer(id, counterOfferAmount)`: stages
  a desk-adjusted counter on a still-PENDING_APPROVAL lead (persists `finalCounterOffer` +
  `projectedMargin` + `modifiedBy`/`modifiedAt`) without dispatching, distinct from
  `approveAndSend()` which commits and sends. `buildLeadViewModels()` now also surfaces
  `finalCounterOffer`, `proposedCounterOffer` (= `finalCounterOffer ?? recommendedCounterOffer`),
  `modifiedBy`, `modifiedAt`. `approveAndSend()` now also stamps `modifiedBy: 'DESK_OVERRIDE'` /
  `modifiedAt` on every human-approved dispatch (every `approveAndSend` call is already a desk
  action, same as its existing always-set `approvalType: 'HUMAN_APPROVED'`).
- `src/services/SpreadService.js` — added pure `projectMargin({ estimatedWholesaleValue,
  counterOfferAmount })`, factored out of `approveAndSend()`'s inline margin arithmetic so the
  grid's live recalculation ticker and the controller share one tested calc.
- `src/models/Submission.js` — added nullable `modifiedBy`/`modifiedAt` string fields (same
  optional-string pattern as `nagSentAt`/`digestSentAt`).
- `src/ui/LeadInboxView.js` — exported its existing `spreadBadge()` (was module-private) for
  reuse by the new grid's Market Spread/Margin column, avoiding a duplicate `BADGE_LABELS` map.
- `src/ui/App.js` — new "Offer Grid" tab (`offers`) wired alongside Lead Inbox in both the top
  tab bar and `handleTabSelect`. Added `?view=dealer&tab=offers&sub=<id>` deep-link parsing at
  mount time (mirrors the existing `pendingPrefill` one-shot-consume pattern) that opens straight
  to the grid with the target row focused/scrolled-into-view and outlined via
  `.offer-grid__row--focused`.
- `src/ui/BottomNavView.js` — added an `offers` entry to `BOTTOM_NAV_ITEMS` for mobile parity.
- `src/ui/styles.css` — `.offer-grid__table` (horizontal scroll on mobile), `.offer-grid__row--
  focused`, `.offer-grid__adjust-panel`, `.offer-grid-drawer`/`.offer-grid-drawer__body`. Reused
  existing `.kpi-row`/`.kpi-card` (from Analytics) and `.data-table` (from Analytics) rather than
  introducing parallel styling.

**Edge cases handled:**
- A PENDING_APPROVAL lead's "Proposed Counter" cell is the only one that opens the adjustment
  popout; AUTO_COUNTER_SENT/REJECTED rows render it as a static amount (no stray Approve/Pass
  actions on terminal rows, matching `LeadInboxView.js`'s existing status-gated action rendering).
- Summary chips are always computed from the *full* lead set, not the currently-filtered one, so
  switching quick filters doesn't make the totals jump around under the desk's feet.
- `previewCounterAdjustment`/`projectMargin` return `null` cleanly for a NO_DATA lead (no market
  comps yet) instead of producing `NaN` — the ticker falls back to an amount-only readout.
- Deep-link focus (`focusSubmissionId`) is consumed once per mount (nulled out immediately after
  the first `renderOfferCounterTableView()` call), identical to the existing `pendingPrefill`
  one-shot pattern, so repeated internal re-renders don't keep re-scrolling to the same row.

**Scope note (non-blocking):** the UOW payload named Task 3's file as
`src/client/LeadInboxController.js`; no `src/client/` directory exists in this repo and the
described row-action wiring (Approve & Dispatch / Pass / Inspect) is squarely
`src/ui/LeadInboxController.js`'s existing responsibility (it already owns `approveAndSend`/
`rejectLead`/`getSubmission`), so that file was treated as the intended target.

**Testing:** `npm test` → 801/801 passing (up from 785; +16 new: `Submission` modifiedBy/
modifiedAt validation, `SpreadService.projectMargin`, `LeadInboxController.overrideCounterOffer`
+ `proposedCounterOffer`/`modifiedBy` surfacing + `approveAndSend`'s new stamp, and
`OfferCounterTableView`'s pure sort/filter/summary/preview helpers). Coverage
(`--experimental-test-coverage`) on touched business-logic modules: `Submission.js` 100%/100%,
`SpreadService.js` 100%/95.12%, `LeadInboxController.js` 100%/95.24% (lines/branches) — all above
the 80% gate. `OfferCounterTableView.js`'s DOM-rendering code is intentionally untested by the
same convention already established for `LeadInboxView.js`/`AnalyticsView.js` (21.69%/12.82% line
coverage respectively) — its pure helpers hit 100% branch coverage; the file is a UI view, not a
core domain model or business-logic service, so it falls outside that gate's stated scope.

**Manual verification:** started the dev server (`npm start`) and confirmed `/dealer` serves 200
under HTTP Basic Auth with the new `OfferCounterTableView.js` module and "Offer Grid" tab label
present in the served bundle. No browser-automation tool (Playwright/Chromium/a Claude browser
extension) was available in this sandbox to drive and screenshot the live UI, so the inline
stepper/live-ticker/focus-scroll interactions were verified by code review and the unit suite
only, not by an actual rendered click-through — flagged to the Product Owner per the "say so
explicitly" guidance rather than claimed as done.

## UOW-54 — Production Server-Side SMS Relay & Provider Dispatch (2026-10-15)

**Picks up the bounded SMS-relay addition the [UOW-HOTFIX] decision log deferred**: a new
authenticated server endpoint, `POST /api/v1/notifications/sms` (`src/server/routes/
notifications.js`, mounted in `src/server/index.js` behind the same `dealerAuth` basicAuth
middleware that already gates `/dealer`). It validates `{ to, message }`, normalizes `to` to
strict E.164 (`normalizePhoneToE164`), then dispatches via native `fetch` straight to the
provider REST API — Telnyx primary (`TELNYX_API_KEY`/`TELNYX_FROM_NUMBER`, Bearer auth, `POST
https://api.telnyx.com/v2/messages`), Twilio fallback (reusing the existing
`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` env convention, Basic auth,
form-encoded) when Telnyx isn't configured, and a `{ success: false, error: 'No SMS provider
credentials configured' }` / 500 when neither is. Responses are `{ success: true, messageId }`
(200) or `{ success: false, error }` (500), per spec.

**Client side:** `NotificationService.js` gains `FetchSmsAdapter`, which POSTs `{ to, message:
body }` to that endpoint with `credentials: 'same-origin'` and never throws — a failed request,
a non-2xx response, or `success: false` in the body all resolve to `{ success: false, ... }`
with a `console.warn`, so a dead relay or missing provider credentials can't crash the UI.
`App.js` now constructs `NotificationService` with `smsAdapter: new FetchSmsAdapter()` instead
of the `ConsoleSmsAdapter` default, closing out the decision the prior hotfix entry flagged.

**Phone-format fix (Task 3):** `notifyPendingApproval`/`notifyEscalation`/`notifyMorningDigest`
were handing the SMS adapter `member.phone` straight from the roster — `DealerProfileService`'s
`normalizePhone` stores it in **display** format (`"(910) 555-0128"`), which Telnyx/Twilio reject.
Added `DealerProfileService.toE164()` (mirrors `normalizePhone`'s parsing, strict E.164 output)
and a `dispatchToMember()` helper in `NotificationService.js` that normalizes before calling
`smsAdapter.sendSms`, catching and `console.warn`-ing (skip, don't throw) on an unformattable
record so one bad roster entry can't block the rest of the fan-out. `LeadEscalationService.js`
itself needed no change — it never touches `member.phone` directly, it only calls
`notificationService.notifyEscalation`/`notifyMorningDigest`, so the fix at the single
`NotificationService` choke point covers it; verified via `leadEscalationService.test.js`'s
existing fake-`notificationService` tests (unaffected) plus the updated real-adapter assertions
in `notificationService.test.js` and `dispatchService.test.js`.

**Scope note (non-blocking):** Task 3's UOW payload named the target file
`src/models/DealerTeam.js`; no `src/models/DealerTeam.js` or any `DealerTeam` concept exists in
this repo (confirmed via repo-wide search) — dealer team-member records live entirely in
`src/services/DealerProfileService.js` (`listMembers`/`addMember`/`normalizePhone`), which is
where the normalization-for-dispatch fix actually belongs. Treated as a stale/typo'd path rather
than a stop-and-ask ambiguity, same convention as UOW-53's `src/client/LeadInboxController.js`
note — the described behavior (clean phone formatting feeding `NotificationService`) was
unambiguous even though the named file wasn't real.

**Testing:** `npm test` → 821/821 passing (up from 801; +20 new: `normalizePhoneToE164`/
`dispatchSms`/route-level tests in `tests/server.test.js`, `toE164` in
`tests/dealerProfileService.test.js`, `FetchSmsAdapter` + the skip-on-bad-phone case in
`tests/notificationService.test.js`). Coverage (`--experimental-test-coverage`) on touched
modules: `src/server/routes/notifications.js` 97.94%/87.10%, `DealerProfileService.js`
96.67%/95.24%, `NotificationService.js` 100%/93.18% (line/branch) — all above the 80% gate.

**Not verified live:** no Telnyx/Twilio account credentials or browser-automation tool were
available in this sandbox, so the real provider HTTP call and the end-to-end browser
`FetchSmsAdapter → /api/v1/notifications/sms → provider` path were verified by the unit/mocked-
fetch suite and code review only, not an actual sent text message — flagged to the Product Owner
rather than claimed as done.

## [UOW-HOTFIX-chain, 2026-10-19] Resend transactional email dealer-alert channel

**Context:** Twilio outbound SMS was returning carrier error 30034 (A2P 10DLC campaign vetting
pending), blocking the Monday COB handoff. Product Owner requested a zero-dependency Resend
email fallback, wired into the appraisal/counter-offer notification pipeline, verified by tests —
delivered directly in chat (not a clipboard UOW payload), so logged here rather than as a
CURRENT_UOW.md task.

**Server (`src/server/routes/notifications.js`):**
- `dispatchEmail({ to, subject, html, env, fetchImpl })` — POSTs to `https://api.resend.com/emails`
  with `Authorization: Bearer`, `Content-Type: application/json`, `User-Agent: CarBoyZ/1.0`. Wraps
  a single `to` in an array; `from` defaults to `RESEND_FROM_EMAIL` or
  `CarBoyZ Alerts <onboarding@resend.dev>`. Missing `RESEND_API_KEY` returns
  `{success:false, error:'RESEND_API_KEY missing'}` without throwing; non-2xx returns
  `{success:false, error: data.message || 'HTTP <status>'}`; success returns `{success:true, id}`.
  Reuses the same `env && Object.keys(env).length > 0 ? env : process.env` fallback already fixed
  on `dispatchSms` for the identical `c.env` empty-object pitfall under `@hono/node-server`.
- New `POST /email` route on `createNotificationsRouter` — resolves the recipient from
  `DEALER_ALERT_EMAIL` server-side (client never sends or sees it, same boundary as the provider
  key); client only crosses `subject`/`html`. Gated by the same `dealerAuth` wildcard middleware
  already applied to `/api/v1/notifications/*` in `src/server/index.js` — no change needed there.

**Client (`src/services/NotificationService.js`):**
- `formatPendingApprovalEmailSubject` / `formatPendingApprovalEmailHtml` — structured HTML card
  (VIN, vehicle, mileage, competitor offer, recommended counter, `/dealer?sub=` link), mirroring
  the existing `formatPendingApprovalSms` template pattern.
- `FetchEmailAdapter` — mirrors `FetchSmsAdapter`: POSTs to `/api/v1/notifications/email`, warns
  (not throws) on a failed response or network error.
- `NotificationService` takes an optional `emailAdapter` (default `null` — email is opt-in, SMS
  keeps working unchanged without it). New `notifyPendingApprovalEmail()` sends exactly ONE email
  per event (not fanned out per roster member, unlike SMS). `notify(notification)` now threads
  `recommendedCounterOffer` through (previously dropped) and, when an emailAdapter is configured,
  fires it concurrently with the SMS fan-out via `Promise.allSettled` so a Twilio outage and a
  Resend outage can't block each other; with no emailAdapter configured it still returns the plain
  SMS results array unchanged (verified — no behavior change for existing callers/tests).
- `src/ui/App.js` wires `new FetchEmailAdapter()` into the real `NotificationService` alongside
  `FetchSmsAdapter()`.

**Design decision not in the original spec:** the spec said route the alert to
`env.DEALER_ALERT_EMAIL` "or the designated dealer email from the Admin roster" — the roster
model (`DealerProfileService`) has no `email` field on team members (phone-only), and adding one
would be a schema change outside this task's surgical scope, so only `DEALER_ALERT_EMAIL` is
implemented. Flagged to the Product Owner rather than silently adding a roster field.

**Testing:** `npm test` → 838/838 passing (up from 821; +17 new: `dispatchEmail` + `POST /email`
route tests in `tests/server.test.js`, `FetchEmailAdapter` + email-formatter + `notify()`
concurrency tests in `tests/notificationService.test.js`). Coverage on touched modules:
`src/server/routes/notifications.js` 98.73%/81.67%, `NotificationService.js` 100%/89.71%
(line/branch) — both above the 80% gate. CLI smoke probe confirmed `dispatchEmail` formats and
attempts dispatch against a mocked Resend endpoint (see chat transcript).

**Not verified live:** no real Resend API key or browser-automation tool was available in this
sandbox, so the actual Resend HTTP call and the end-to-end `FetchEmailAdapter → POST /email →
Resend` path were verified by the unit/mocked-fetch suite only, not a real delivered email —
flagged to the Product Owner rather than claimed as done.
