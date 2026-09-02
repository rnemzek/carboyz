# Architect Journal — CarBoyZ

## Rebuild state - 20260902
Here is how the true architectural gaps line up and how we can proceed with UOW-CARBOYZ-24.
Key Architectural Takeaways

### 1.	Client Engine is Complete: SpreadService, SpreadConfigService, DispatchService, VIN scanner, and spatial adapters are fully functional, verified, and tested.

### 2.	Current Sync Transport: SyncAdapter handles same-origin tab syncing via BroadcastChannel and routes messages through a central Hono + WebSocket relay process (wsRelay.js).

### 3.	Primary System Gaps:
- Multi-Tenant Server Isolation: Persistent cellular backend routing per tenant (beyond in-memory WebSocket rooms).
- Mobile QR Cross-Device Handoff: Wiring qrEncoder.js to SessionStashService so a mobile phone camera scan instantly opens and syncs session state to a desktop browser.
- Offline Support: PWA Workbox service worker (sw.js) and background sync queue.
- Policy Governance: Cryptographic audit trail, policy versioning (v1.0.0), and analytics version-pinning / counterfactual "what-if" simulations.



## UOW-24 completed - 20260902
Mobile QR Cross-Device Handoff gap closed. `SessionStashService` gained a second stash
"type" (`PAIRING`, alongside the existing `SUBMISSION` approval-flow entries) with its own
lifecycle: `createPairingSession()` → `connectPairingSession()` → `PAIRING_CONNECTED`
broadcast, mirroring the existing `createPending()`/`resolveBySubmissionId()`/`RESOLVED`
pattern rather than introducing a new mechanism. `LeadInboxController.createPairingSession()`
is the desktop-side entry point (QR payload = pairing URL with `?sessionId=<pairingSessionId>`);
`SellerSubmissionController.bindPairingSession()` is the mobile-side entry point, invoked by
`SellerSubmissionView` from the scanned URL's query param on load.

No new contracts on `SyncAdapter` or the `Submission` schema — the real-time desktop-inbox
relay (`SUBMISSION_CREATED` → `SUBMISSION_SYNCED`) was already fully wired from prior UOWs and
needed no changes; this UOW only had to add the pairing handshake in front of it. Remaining
roadmap gaps unchanged: Offline Workbox PWA (Epic 3 / UOW-CARBOYZ-25) and Policy Versioning &
Audit Ledger (Epic 2 / UOW-CARBOYZ-26).

## UOW-25 completed - 20260902
Epic 3 (Offline Workbox PWA) closed. New `src/sw.js` service worker (precache app shell on
`install`, stale-while-revalidate runtime caching on `fetch`, stale-cache eviction on
`activate`) plus a new pure-logic module `src/services/OfflineCachePolicy.js` it depends on for
which URLs/requests are cacheable. No `workbox` package added — hand-rolled to preserve the
zero-dependency/ESM-first precedent; `sw.js` scope is `/` (registered via
`TenantConfigService.registerServiceWorker()`), which requires the hosting static server to
send `Service-Worker-Allowed: /` for a `src/`-nested SW file to actually claim root scope —
flagging as a known gap for whatever production static host this deploys to (`npx serve .` in
dev does not set that header, so SW registration will resolve to `null` there and the app
degrades to non-offline, same as an unsupported browser).

`SubmissionService` gained an offline-sync queue (`pendingSyncIds`, its own storage key,
`getSyncState()` PENDING_SYNC/SYNCED, `flushPendingSync(syncFn)`) rather than adding a
`PENDING_SYNC` value to `Submission.status`'s validated enum — kept `models/Submission.js`
untouched, matching this UOW's surgical file scope. `App.js` wires `window` `online`/`offline`
events to flush every tenant's queue through its `SyncAdapter` and to show a new offline banner.

Remaining roadmap gap: Policy Versioning & Audit Ledger (Epic 2 / UOW-CARBOYZ-26).

## UOW-26 completed - 20260902
Epic 2 (Policy Governance) closed. New `AuditLedgerService` is a self-contained hash-chained
ledger (own storage key per tenant, own genesis-hash/block-linking scheme) rather than being
folded into `SpreadConfigService` — keeps the crypto/chain-integrity concern testable in
isolation and reusable if another mutable config ever needs the same audit trail. Hashing is a
hand-rolled *synchronous* SHA-256, not `crypto.subtle.digest`: the existing `SpreadConfigView`
save/reset flow depends on `saveConfig()`/`resetToDefault()` staying synchronous (its error
handling is a plain `try/catch`), so an async Web Crypto call would have forced a breaking
change to that contract. Verified the implementation against Node's `crypto` module before
trusting it project-wide.

`policyVersionId` is semantic-versioned (`vMAJOR.MINOR.0`) and monotonically increasing —
`resetToDefault()` bumps the version forward rather than reverting to `v1.0.0`, so the ledger
and any pinned `Submission.policyVersionId` never appear to go "backwards" even when the tier
values themselves are reset to the built-in ladder.

`PolicySnapshot` is new: an immutable point-in-time capture of `(policyVersionId,
tiersByCompetitor, configHash)`, returned by `SpreadConfigService.getActivePolicySnapshot()`.
`SpreadService.calculateSpread()` only needed a much smaller contract change to satisfy the
"Submission Version Pinning" criterion, though — an optional `policyVersionId` parameter that
it echoes back on its result object (same pattern as the existing `matchedTier` pass-through),
which `DispatchService.dispatch()` then writes onto the `Submission` record. `PolicySnapshot`
remains available for a future consumer that needs the full tier ladder alongside the version
id (e.g. a what-if/counterfactual simulator), which is the one Epic 2 item still on the
roadmap.

No breaking changes to `SpreadConfigService.saveConfig()`'s existing single-argument call
shape — `authorId` is an additive, defaulted second-argument option (`{ authorId = 'system' }`).

Roadmap: Epic 2 (Policy Governance) and Epic 3 (Offline Support) are both now closed. Remaining
gap per the UOW-23 audit is analytics version-pinning / counterfactual "what-if" simulation
against the new `PolicySnapshot`/audit ledger — no UOW opened yet.

## UOW-27: Synthetic Submission Generator & Time-Series Historical Policy State Seeder

New pub/sub-free contract in `TestHarnessView.js`: a policy timeline is represented as an array
of `{ policyVersionId, daysAgo }` segments (oldest-to-newest by construction, `daysAgo` = days
before now the version became active), produced by `seedHistoricalPolicyTimeline()` and consumed
by `resolveActivePolicyVersion(segments, daysAgo)`. This is the same shape the UOW-23-flagged
counterfactual/what-if simulator would need to walk "what was the active policy at time T" —
no new abstraction was introduced there, this reuses `PolicySnapshot`/`AuditLedgerService`
as-is and only adds the segment-lookup convention on top.

Backdating ledger entries required temporarily reassigning `auditLedgerService.now` (a plain
instance property holding the timestamp-provider closure) around each `recordMutation` call,
restored via `finally`. No change to `AuditLedgerService`'s constructor contract — `now` was
already designed as an injectable/overridable function, just not previously mutated
post-construction.

`renderTestHarnessView` now takes an optional `spreadConfigService` so harness-seeded policy
history lands in the tenant's real audit ledger (visible to `SpreadConfigController`/analytics)
rather than a disconnected instance — additive, defaults to `null` (lazily constructs its own).

## UOW-28: Analytics Policy Version Pinning, Dynamic Filters & Responsive Layout

Closes the analytics-version-pinning gap the UOW-23 audit and UOW-27 both flagged as open.
`AnalyticsService` gains an optional `auditLedgerService` constructor dependency (`null`-safe,
mirrors the `submissionService` required-dependency pattern already in place) and a new
`getPolicyVersionPins()` contract returning `{ policyVersionId, timestamp, sequence }[]`.

Deliberate boundary decision: `AuditLedgerService` and `SpreadConfigService` were **not**
modified, even though the ledger's `recordMutation()` entries don't carry the raw
`policyVersionId` string (only hashes of the full config, which embeds it). Adding that field to
the ledger schema would be the architecturally cleaner fix, but it's outside this UOW's target
scope (`AnalyticsView.js`/`AnalyticsController.js`/`AnalyticsService.js` only). Instead,
`derivePolicyVersionPins()` reconstructs each entry's version by replaying
`SpreadConfigService.bumpPolicyVersion()` once per ledger entry in sequence, starting from
`INITIAL_POLICY_VERSION_ID` — a faithful model of `saveConfig()`/`resetToDefault()`'s real
behavior, with one known edge case: `TestHarnessView.seedHistoricalPolicyTimeline()`'s first
entry calls `applyConfig()` directly to record the *unchanged* starting version (no bump), which
this replay can't distinguish from a real bump. Flagging for whoever picks up the ledger schema
next: the durable fix is to have `AuditLedgerService.recordMutation()` accept and store the
new `policyVersionId` alongside `newConfigHash`, which would make pin derivation exact instead of
replayed. Same rationale applies to `AnalyticsService` importing `INITIAL_POLICY_VERSION_ID`/
`bumpPolicyVersion` from `SpreadConfigService.js` — a new cross-service dependency, but read-only
against already-exported pure functions, not a schema/contract change.

`AnalyticsService.filterSubmissions()`'s new `priceTier`/`approvalType` predicates and
`DATE_RANGE_PRESETS.LAST_60_DAYS`/`LAST_90_DAYS` are both purely additive to existing contracts —
no caller of the old 2-argument filter shape or the 3-preset enum breaks.

`AnalyticsView.js`'s time-series charts are hand-built SVG markup strings assigned via
`.innerHTML`, following the `qrEncoder.js`/`renderQrSvg()` precedent already established in this
codebase — the shared `h()` helper builds via `document.createElement`, which cannot produce
namespaced SVG elements, so this project's convention for any SVG content is markup-string + 
`.innerHTML`, not `h()`. Worth a template-level note if a second/third chart type gets added
later: consider a small shared SVG-string builder rather than duplicating the axis/scale math per
chart.

## UOW-CARBOYZ-29: Counterfactual "What-If" Scenario Simulation Engine

Closes the "counterfactual/what-if simulator" gap flagged as open back in the UOW-23 audit and
referenced again in UOW-27's `TestHarnessView` policy-timeline note. New `SimulationService.js`
exports `simulateCandidatePolicy(historicalSubmissions, candidateConfig)` (pure function) plus a
thin `SimulationService` class wrapping it against a `submissionService`. Contract:

```
simulateCandidatePolicy(historicalSubmissions, candidateConfig) -> {
  sampleSize: number,        // replayed (closed + FMV-derivable) submissions
  excludedCount: number,     // pool.length - sampleSize
  current:   { volume, wonCount, winRate, totalGrossMargin, avgMarginPerWonDeal, autoApprovalVolume },
  candidate: { volume, wonCount, winRate, totalGrossMargin, avgMarginPerWonDeal, autoApprovalVolume },
  delta:     { winRate, totalGrossMargin, avgMarginPerWonDeal, autoApprovalVolume },  // candidate - current
  projections: { submissionId, spreadResult, won, autoApprove, expectedMargin }[],
}
```

`candidateConfig` is validated via `SpreadConfigService.validateConfig()` (reused, not
duplicated) so it's the same `{ tenantId?, tiersByCompetitor }` shape the Admin tier editor
already produces — a candidate config is structurally just an unsaved `SpreadConfigService`
config, never written back via `saveConfig()`/`applyConfig()`.

**Architectural trade-off worth flagging for whoever touches `SpreadService.js` next:**
`calculateSpread()`'s `DealScoreStatus` is a function of `fairMarketValue` and
`competitorOfferAmount` only — `tierConfig` never influences it, only the recommended counter
offer and matched tier do. That makes a naive "was the raw status GREENLIGHT/MARGINAL" win
projection completely policy-invariant, which defeats the point of a policy simulator. Worked
around without touching `SpreadService.js` (out of scope) by calling `calculateSpread()` a second
time per submission, feeding the candidate's own `recommendedCounterOffer` back in as the
"competitor offer" with `tierConfig: []`/`counterOfferOffset: 0` — this reuses
`calculateSpread()`'s internal GREENLIGHT/MARGINAL/PASS scoring to grade the *post-counter-offer*
margin instead of the pre-offset spread, which does vary with `tierConfig`. If `SpreadService.js`
ever exposes its `scoreSpread()`/threshold constants directly, `SimulationService.projectSubmission()`
should switch to calling that instead of the double-`calculateSpread()` trick — same result, one
fewer indirection.

**Also flagged, not built:** the UOW's acceptance text mentions "margin caps" as a candidate lever
alongside tier offsets and auto-approval thresholds. No margin-cap concept exists in
`SpreadConfigService`'s tier schema (only `flatAmount`/`percent`/`strategy`/`autoApprove`).
Adding one is a `SpreadConfigService`/`SpreadService` schema change — out of this UOW's target
scope — so `SimulationService` only models what the existing tier schema already supports.
Candidate for a future UOW if margin-cap policy levers are actually wanted.

`App.js` gained a `simulation` tab (between Analytics and Test Harness in the top nav, in the
bottom nav after Analytics) and a per-tenant `SimulationService` instance alongside the existing
`analyticsService`/`spreadConfigService` — no new cross-tenant state, follows the existing
`getTenantState()` per-tenant-singleton pattern exactly.
