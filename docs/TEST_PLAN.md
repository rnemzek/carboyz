# CarBoyZ — Master Test Plan & Execution Matrix

## 1. Executive Summary & Testing Objectives
The CarBoyZ platform is a multi-tenant Progressive Web Application (PWA) designed for real-time vehicle trade-in appraisals, automated spread calculations, approval routing, and deal analytics.

The primary objective of this test plan is to establish explicit quality gates across all six core system pillars:
1. **Core Domain Models & Spread Math:** Valuation rules, spread calculations, and state machines.
2. **Policy Engine Governance:** Semantic versioning (`v1.0.0`), hash-chained audit ledgers, and submission policy pinning.
3. **Cross-Device Session Handoff:** QR code pairing, mobile token intake, and real-time WebSocket/BroadcastChannel sync.
4. **Offline Resilience:** Workbox-style PWA service worker caching, offline queueing, and automatic reconnection flushes.
5. **Analytics & Policy Pinning:** Time-series aggregation, multi-variable filtering, and SVG chart annotations.
6. **Counterfactual Simulation Engine:** Historical submission replay against candidate spread tiers without active state mutation.

---

## 2. Test Architecture & Lifecycle Approach

┌─────────────────────────────────────────────────────────────────────────┐
│                      MANUAL & BROWSER TEST DRIVES                       │
│      (End-to-end multi-device pairing, PWA offline, layout checks)      │
├─────────────────────────────────────────────────────────────────────────┤
│                       INTEGRATION & RELAY SUITE                         │
│       (SyncAdapter, WebSocket Relay, Offline Queueing, Seeder)          │
├─────────────────────────────────────────────────────────────────────────┤
│                        UNIT SUITE (Node --test)                         │
│  (Domain Models, Spread Engine, Audit Ledger, Controllers, Generators)  │
└─────────────────────────────────────────────────────────────────────────┘


The system employs a multi-tiered verification approach:
* **Unit Level (`node --test`):** Validates deterministic business logic, value objects, mathematical services, and DOM-free controllers[span_10](start_span)[span_10](end_span).
* **Integration Level:** Verifies pub/sub messaging via `SyncAdapter`, offline submission buffering, and timeline seeder bindings[span_11](start_span)[span_11](end_span).
* **Browser / Smoke Level:** Validates DOM mounting, visual SVG chart rendering, mobile-to-desktop QR pairing, and responsive layout collapses[span_12](start_span)[span_12](end_span).

---

## 3. Test Suites & Verification Matrix

| Category | Target Module / Service | Key Test Scenarios | Quality Gate |
|---|---|---|---|
| **Domain Models** | `Dealer.js`, `Vehicle.js`, `Submission.js` | • Non-silent constructor validation on missing fields[span_13](start_span)[span_13](end_span).<br>• Correct dispatch and win/loss status transitions[span_14](start_span)[span_14](end_span). | 100% Line / Branch Coverage[span_15](start_span)[span_15](end_span) |
| **Spread Engine** | `SpreadService.js`, `SpreadConfigService.js` | • Tier offset calculation accuracy (flat/percent/max)[span_16](start_span)[span_16](end_span).<br>• Auto-approval limit evaluation & GREENLIGHT routing[span_17](start_span)[span_17](end_span).<br>• Semantic policy version bumping (`v1.0.0` $\rightarrow$ `v1.1.0`)[span_18](start_span)[span_18](end_span). | $\ge 90\%$ Line / Branch Coverage[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span) |
| **Audit Ledger** | `AuditLedgerService.js`, `PolicySnapshot.js` | • Synchronous SHA-256 hash chaining integrity[span_21](start_span)[span_21](end_span).<br>• Immutable snapshot captures on config mutations[span_22](start_span)[span_22](end_span).<br>• Non-corrupt append-only history replay[span_23](start_span)[span_23](end_span). | 100% Line / Branch Coverage[span_24](start_span)[span_24](end_span) |
| **QR Session Handoff** | `SessionStashService.js`, `qrEncoder.js` | • Zero-dependency SVG QR code generation[span_25](start_span)[span_25](end_span).<br>• `?sessionId=` URL query token parsing on mobile load[span_26](start_span)[span_26](end_span).<br>• Live WebSocket / BroadcastChannel submission relay[span_27](start_span)[span_27](end_span). | $\ge 90\%$ Line / Branch Coverage[span_28](start_span)[span_28](end_span)[span_29](start_span)[span_29](end_span) |
| **Offline Resilience** | `OfflineCachePolicy.js`, `SubmissionService.js` | • Service worker precache / runtime cache registration[span_30](start_span)[span_30](end_span).<br>• Buffering offline submissions under `PENDING_SYNC` state[span_31](start_span)[span_31](end_span).<br>• Automatic queue flush upon `window.online` event[span_32](start_span)[span_32](end_span). | $\ge 90\%$ Line / Branch Coverage[span_33](start_span)[span_33](end_span)[span_34](start_span)[span_34](end_span) |
| **Analytics Engine** | `AnalyticsService.js`, `AnalyticsController.js` | • Time-series conversion/margin metrics computation[span_35](start_span)[span_35](end_span).<br>• Multi-variable filter predicate application (30/60/90 days)[span_36](start_span)[span_36](end_span).<br>• Deriving policy version pins from `AuditLedgerService`[span_37](start_span)[span_37](end_span). | $\ge 90\%$ Line / Branch Coverage[span_38](start_span)[span_38](end_span)[span_39](start_span)[span_39](end_span) |
| **Simulation Engine** | `SimulationService.js`, `SimulationController.js` | • Historical submission replay against candidate tiers[span_40](start_span)[span_40](end_span).<br>• Secondary post-counter offer margin viability scoring[span_41](start_span)[span_41](end_span).<br>• Win Rate %, Gross Margin, and Auto-Approval delta calculations[span_42](start_span)[span_42](end_span). | $\ge 90\%$ Line / Branch Coverage[span_43](start_span)[span_43](end_span)[span_44](start_span)[span_44](end_span) |
| **UI Views** | `MapView.js`, `LeadInboxView.js`, `AnalyticsView.js`, `SimulationView.js` | • DOM mounting & event handling[span_45](start_span)[span_45](end_span).<br>• SVG chart rendering & dashed version pin overlays[span_46](start_span)[span_46](end_span).<br>• Responsive flex/grid layout collapse on mobile viewports[span_47](start_span)[span_47](end_span). | Manual / Browser Smoke Drive[span_48](start_span)[span_48](end_span) |

---

## 4. Quality Gates & Enforcement Rules

1. **Automated Unit Suite Execution:**
   * Run via `npm test`[span_49](start_span)[span_49](end_span).
   * All tests must pass (100% pass rate) with zero regressions[span_50](start_span)[span_50](end_span).
2. **Coverage Threshold Gate:**
   * All newly added or modified core domain models, business logic services, and adapters must achieve **$\ge 80\%$ line and branch test coverage** prior to task completion[span_51](start_span)[span_51](end_span).
3. **PWA & Offline Execution Gate:**
   * Service Worker must register gracefully without breaking runtime execution[span_52](start_span)[span_52](end_span).
   * Submissions generated in offline mode must persist in `localStorage` and transmit automatically via `SyncAdapter` upon network reconnection[span_53](start_span)[span_53](end_span).
4. **Git Tree Hygiene:**
   * Clean working tree required before session conclusion[span_54](start_span)[span_54](end_span).
   * Completed UOWs archived in `.hydrate/archive/` and logged in `.hydrate/*_JOURNAL.md` files[span_55](start_span)[span_55](end_span)[span_56](start_span)[span_56](end_span).

---

## 5. Live Browser Execution Matrix (Manual Test Drive)

### Scenario A: In-Store Desktop-to-Mobile Session Pairing
1. On Desktop: Navigate to `Lead Inbox` $\rightarrow$ Click **"Pair Mobile Device"**[span_57](start_span)[span_57](end_span).
2. Verify scan-ready SVG QR code renders alongside "Waiting for connection..." status[span_58](start_span)[span_58](end_span).
3. On Mobile: Scan QR code or open pairing URL containing `?sessionId=...`[span_59](start_span)[span_59](end_span).
4. Confirm Desktop UI status updates to "Connected[span_60](start_span)"[span_60](end_span).
5. On Mobile: Complete a seller intake with a CarMax competitor offer sheet $\rightarrow$ Click **Submit**[span_61](start_span)[span_61](end_span).
6. Confirm submission instantly pops up in the Desktop `Lead Inbox` in real-time without requiring a page refresh[span_62](start_span)[span_62](end_span).

### Scenario B: Offline Intake & Network Reconnection Flush
1. Open Developer Tools $\rightarrow$ Set Network throttle to **Offline**[span_63](start_span)[span_63](end_span).
2. Complete a seller intake submission[span_64](start_span)[span_64](end_span).
3. Confirm orange "Offline" status banner appears in the header and submission status sets to `PENDING_SYNC`[span_65](start_span)[span_65](end_span).
4. Set Network throttle back to **Online**[span_66](start_span)[span_66](end_span).
5. Confirm `SubmissionService` automatically flushes the queue, syncing the payload to the network and updating status to `SYNCED`[span_67](start_span)[span_67](end_span).

### Scenario C: Analytics Policy Version Pinning & "What-If" Simulation
1. Open `Analytics` tab $\rightarrow$ Adjust date range filter (30 / 60 / 90 days)[span_68](start_span)[span_68](end_span).
2. Confirm dashed vertical policy version pins (`v1.0.0`, `v1.1.0`, `v1.2.0`) display correctly over conversion and margin SVG trend charts[span_69](start_span)[span_69](end_span).
3. Open `Simulation` tab $\rightarrow$ Adjust candidate tier offset sliders[span_70](start_span)[span_70](end_span).
4. Confirm side-by-side KPI cards (Current vs. Candidate Policy) instantly calculate and display Win Rate %, Gross Margin, and Auto-Approval deltas[span_71](start_span)[span_71](end_span).


