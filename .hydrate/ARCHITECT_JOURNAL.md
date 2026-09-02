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
