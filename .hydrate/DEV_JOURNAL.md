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
explicitly per the UI-testing guideline rather than claiming a browser check that didn't happen.
