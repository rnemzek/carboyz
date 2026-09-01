# {{PROJECT_NAME}} System Documentation

## 1. Living Architecture & System Overview
<!-- System design, boundaries, and components -->

### System Overview

The CarBoyZ platform is a multi-tenant, white-label Progressive Web Application (PWA) designed for real-time vehicle trade-in appraisals, automated spread calculations, approval routing, and deal analytics.

┌─────────────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (PWA & White-Label)                    │
│   [ Intakes & Cameras ]    [ Lead Inbox ]    [ Analytics & Admin ]  │
└────────────────────────────────────┬────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INGRESS & CONTENT-BASED ROUTER                       │
│           (Subdomain matching: tenantA.app / Path: /tenantA)           │
└────────────────────────────────────┬────────────────────────────────────┘
│
┌───────────────────────────┴───────────────────────────┐
▼                                                       ▼
┌────────────────────────────────┐               ┌────────────────────────────────┐
│      TENANT CELL A RUNTIME     │               │      TENANT CELL B RUNTIME     │
│  ┌──────────────────────────┐  │               │  ┌──────────────────────────┐  │
│  │ Application Container    │  │               │  │ Application Container    │  │
│  │ (In-Memory Policy State) │  │               │  │ (In-Memory Policy State) │  │
│  └────────────┬─────────────┘  │               │  └────────────┬─────────────┘  │
│               │                │               │               │                │
│  ┌────────────▼─────────────┐  │               │  ┌────────────▼─────────────┐  │
│  │ Isolated Tenant DB/Store │  │               │  │ Isolated Tenant DB/Store │  │
│  └──────────────────────────┘  │               │  └──────────────────────────┘  │
└────────────────────────────────┘               └────────────────────────────────┘

---

### Multi-Tenant Cellular Architecture

#### Architectural Rationale
Instead of a single shared database with `tenant_id` columns across all tables, the platform utilizes a **Cellular Multi-Tenant Architecture**:
1. **Zero Maintenance-Window Provisioning:** New dealership tenants can be provisioned as isolated micro-containers without redeploying existing tenant runtimes.
2. **Data Isolation & Blast Radius:** Eliminates the risk of cross-tenant data leaks (a critical legal requirement in automotive dealer groups).
3. **Independent Upgrades:** Allows testing new features or custom strategy integrations on select tenant cells before rolling out globally.

### Zero-Downtime Policy Propagation & Pub-Sub Flow

#### The Problem
When Dealer X updates their spread pricing tiers, auto-approval thresholds, or margin factors, the appraisal engine must immediately evaluate incoming submissions against the new rules **without disk read overhead on every transaction**.

#### The Flow

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DEALER EDIT PHASE                                                        │
│    Dealer saves updated spread config via Admin Portal                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. PERSISTENCE & AUDIT PHASES                                               │
│    • DB writes new policy snapshot with incremented Policy Version ID       │
│    • Append-only Immutable Audit Log records change hash and timestamp      │
└──────────────────────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. EVENT PUBLISH PHASE                                                      │
│    Tenant Cell Pub/Sub emits POLICY_UPDATED_EVENT(tenantId, versionId)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. ATOMIC SWAP PHASE                                                        │
│    Application Container receives event, loads new policy into RAM, and     │
│    atomically updates the active memory pointer (activePolicyPointer).     │
│    • Old transactions in-flight complete using snapshot reference.          │
│    • Zero request drops, zero server restarts, 0.0001 ms evaluation time.   │
└─────────────────────────────────────────────────────────────────────────────┘

---

### Governance, Analytics Pinning & Audit Logging

#### Analytics Version Pinning
Every `Submission` telemetry record captures the immutable `policyVersionId` active at the exact moment of evaluation.

┌─────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICS REPORTING VIEW                        │
│                                                                         │
│  Win Rate %                                                             │
│    60% │         ▲                       ▲                              │
│    40% │ ────────┼───────●───────────────┼─────────●────────           │
│    20% │         │       │               │         │                    │
│     0% └─────────┴───────┴───────────────┴─────────┴─────────────> Date │
│               Feb 1             Feb 15                                  │
│                 │                 │                                     │
│                 ▼                 ▼                                     │
│          [ PIN: Config v1.1 ]   [ PIN: Config v1.2 ]                    │
│          (Changed Floor $1k)    (Updated Margin 0.88)                   │
└─────────────────────────────────────────────────────────────────────────┘

* **Impact Analysis:** Reporting graphs draw vertical timeline pins for each policy deployment, enabling direct before-and-after conversion and margin analysis.
* **Audit Trail:** Changes are logged sequentially in an append-only ledger:
  $$\text{Record}_n = H(\text{Timestamp} \mathbin{\Vert} \text{Author} \mathbin{\Vert} \text{DiffPayload} \mathbin{\Vert} \text{Record}_{n-1})$$

---

## 2. Roadmap
Roadmap & Tactical Scope (UOW Index, completed vs. active vs. queued)

> High-level milestone tracking. Granular active tasks live in .hydrate/CURRENT_UOW.md.

### Core Milestones

- [x] **UOW-01:** Scaffold Repository & Core Architecture (Iterated: 0)
- [x] **UOW-02:** Core Vehicle & Competitor Telemetry Domain
- [x] **UOW-03:** Buyer Search & Dealer Ingest Engine
- [x] **UOW-04:** Mobile-First PWA Command Canvas & Dual-View Demo
- [x] **UOW-05:** White-Label Branding Engine & Multi-Vendor Discovery
- [x] **UOW-06:** CarBoyZ Flagship Preset & Zip Code Seed Engine
- [x] **UOW-07:** Structured LLM Query Parsing & Local Discovery Sync
- [x] **UOW-08:** Location Overlay: GPS Locate & ZIP/City Search
- [x] **UOW-09:** Spatial Core / Domain Overlay Contract: Google Geocoding Wire-Up
- [x] **UOW-HOTFIX:** Dark Matter Basemap & Runtime Config Injection
- [x] **UOW-REPAINT:** UI Repaint & Dense Dealer Layer Expansion
- [x] **UOW-OSM:** OpenStreetMap Geocoder Bridge & Dual-Mode Map Centering
- [x] **UOW-POLISH:** Pin Contrast, Tagline, Recenter Zoom & Drawer Collision Overhaul
- [x] **UOW-AUTOSUGGEST:** Auto-Suggest Location Picker
- [x] **UOW-PROCEDURAL:** Procedural Regional Dealer Seeding Engine

---

### Future Roadmap Items & System Vision

This document tracks upcoming strategic architecture and product capabilities for the CarBoyZ / White-Label Vehicle Appraisal Platform.

---

#### Epic 1: Multi-Tenant Backend API & WebSocket Sync (Cellular Architecture)
* **Goal:** Transition from local `BroadcastChannel` cross-tab syncing to a cellular cloud backend with real-time pub-sub.
* **Architecture:** Content-based routing / load balancer ingress serving isolated, micro-container backend instances per tenant cell.
* **Capabilities:** 
  * Real-time cross-device phone-to-laptop session stashing (QR scan on physical mobile phone updates desktop inbox instantly).
  * High fault isolation and zero cross-tenant data leakage risk.

#### Epic 2: Offline Persistence & Service Worker Caching (Workbox PWA)
* **Goal:** Enable full offline appraisal creation and intake in areas with low cellular coverage.
* **Capabilities:**
  * Background sync queue using Workbox service workers to buffer submissions when offline.
  * Instant auto-resync upon reconnecting to network.

#### Epic 3: Policy Change Governance & Immutable Audit Trail
* **Goal:** Create a cryptographically secure / immutable event ledger of all rule, tier, and pricing policy mutations per tenant.
* **Capabilities:**
  * Append-only audit log capturing `timestamp`, `userId`, `previousConfigHash`, `newConfigHash`, and `diffPayload`.
  * Verifiable ledger state to ensure compliance and audit readiness.

#### Epic 4: Configuration Version History & Pinning
* **Goal:** Allow dealers to track performance metrics against specific policy versions and rollback or re-apply historical configurations.
* **Capabilities:**
  * Semantic policy versioning (`v1.0.0`, `v1.1.0`, `v1.2.0`).
  * Visual time-series chart annotations (dropping vertical pins/lines on Analytics charts indicating *"Policy v1.2 applied here"*).
  * One-click configuration rollback / restore from historical snapshots.

#### Epic 5: Counterfactual "What-If" Scenario Simulation Engine
* **Goal:** Allow dealers to run simulation models against historical submission data to test prospective policy updates before deploying them live.
* **Capabilities:**
  * Replay past $N$ months of actual seller submissions and competitor offers against candidate spread tiers.
  * Calculate projected impact on Win/Loss conversion rates, overall volume, total margin captured, and bottom-line revenue.
  * Trade-off visualization: Identify scenarios where higher win rates result in lower overall profit margin (winning the battle vs. winning the war).

---

## 3. Architecture Decision Log
Architecture & Decision Log (Append-only history of architectural trade-offs)

# Developer Journal & Telemetry Log

## [Day Zero] — Harness Initialized
- **Date:** 8/18/2026
- **Status:** Scaffolding complete via @nemzilla/hydrate. Ready for UOW-01 execution.

## [UOW-01] — Scaffold Repository & Core Architecture
- **Date:** 8/18/2026
- **Status:** Complete. All 4 tasks done, `npm test` passing 6/6.

### Tasks completed
- **1.1:** `package.json` (`"type": "module"`, `test` script → `node --test`) and folder layout: `src/core/`, `src/config/`, `src/services/`, `tests/`.
- **1.2:** `src/core/index.js` aggregates core exports (`DEFAULT_TENANT_CONFIG`, `createTenantConfig`, `HapticsService`, `ShareService`); `src/index.js` re-exports it as the package entry point.
  - `src/config/tenantConfig.js` — tenant branding schema (`tenantId`, `name`, `logoUrl`, `themeColors`) with defaults and a merge-aware factory.
  - `src/services/HapticsService.js` — wraps `navigator.vibrate` with feature detection and a safe no-op fallback.
  - `src/services/ShareService.js` — wraps `navigator.share` with feature detection and a safe `{ shared: false }` fallback.
- **1.3:** Native Node test runner (`node --test`), suites in `tests/tenantConfig.test.js`, `tests/services.test.js`, `tests/index.test.js`.
- **1.4:** `npm test` verified passing.

## [UOW-02] — Core Vehicle & Competitor Telemetry Domain
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 23/23. Overall coverage 97.91% lines / 90.91% branches (quality gate: 80%).

## [UOW-03] — Buyer Search & Dealer Ingest Engine
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 48/48. Overall coverage 98.28% lines / 91.77% branches (quality gate: 80%).

## [UOW-04] — Mobile-First PWA Command Canvas & Dual-View Demo
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 70/70. Overall coverage 98.19% lines / 93.07% branches / 98.44% funcs.

## [UOW-05] — White-Label Branding Engine & Dynamic Presets / Multi-Vendor Integration
- **Date:** 8/18/2026
- **Status:** Complete. All tasks done, `npm test` passing 111/111. Overall coverage 98.40% lines / 93.36% branches.

## [UOW-06] — CarBoyZ Flagship Preset & Zip Code Seed Engine
- **Date:** 2026-08-19
- **Status:** Complete. All 4 tasks done, `npm test` passing 122/122. Overall coverage 98.59% lines / 93.52% branches.

## [UOW-07] — Structured LLM Query Parsing & Local Discovery Sync
- **Date:** 2026-08-20
- **Status:** Complete. All 5 tasks done, `npm test` passing 167/167.

## [UOW-08] — Location Overlay: GPS Locate & ZIP/City Search
- **Date:** 2026-08-20
- **Status:** Complete. All 7 tasks done, `npm test` passing 175/175. `locationAdapter.js` at 100.00% line coverage.

## [Spatial Core / Domain Overlay Contract Refactor]
- **Date:** 2026-08-20
- **Status:** Complete. Cross-repo refactor across `@nemzilla/spatial-core` and `carboyz`. `spatial-core` tests: 24/24 passing. `carboyz` tests: 180/180 passing.

## [UOW-09] — Spatial Core / Domain Overlay Contract: Google Geocoding Wire-Up
- **Date:** 2026-08-21
- **Status:** Complete. `npm test` passing 184/184. `locationAdapter.js` at 100.00% line / 84.09% branch coverage.

## [Fix] Dark Matter Basemap Default & Runtime Config Injection
- **Date:** 2026-08-21
- **Status:** Complete. `npm test` 184/184 passing in carboyz; spatial-core at 41/41. Replaced light-green demo tiles with CARTO Dark Matter basemap. Bound detached `fetch` calls across adapters to fix `TypeError: Illegal invocation`. Added gitignored `runtime-config.js` generator for runtime static serving injection.

## [UOW] UI Repaint & Dense Dealer Layer
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 185/185 (+2). Aligned application theme with StreamZilla dark/gold palette (`#FBBF24` primary on `#020617` slate-950). Expanded Leland/Wilmington local dealer network from 2 to 12 real regional locations within the 25-mile search radius.

## [Feature] OpenStreetMap Geocoder Bridge & Dual-Mode Map Centering
- **Date:** 2026-08-25
- **Status:** Complete. `npm test`: spatial-core 51/51 (+10), carboyz 190/190 (+5). Implemented `OpenStreetMapGeocoder` (Nominatim) in `@nemzilla/spatial-core` as a zero-cost fallback bridge tier for location resolution.

## [UOW-HOTFIX] Surgical UI Polish: Brand Badge, Popup Theming, Default Map Tab, Drawer Overlap, Tagline
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 190/190. Fixed map drawer overlay z-index bug (`z-index: 25`). Theme-colored brand badge initials, applied explicit dark slate popup styles, updated tagline, and set initial default view to Map tab.

## [UOW-HOTFIX] Pin Contrast, Tagline, Recenter Zoom
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 190/190. Updated dart pin SVG inner stroke and dot contrast (`#0F172A`), set default map recenter zoom level to `11`, updated flagship tagline.

## [Feature] Auto-Suggest Location Picker
- **Date:** 2026-08-25
- **Status:** Complete. `npm test`: spatial-core 60/60 (+9), carboyz 199/199 (+9). Extended geocoders with `resolveMany(query, limit)` in spatial-core. Added debounced auto-suggest location picker dropdown to `MapView` search modal.

## [Feature] Procedural Regional Dealer Seeding Engine
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 209/209 (+10). Added procedural regional dealer generator (`generateRegionalDealers`) to dynamically scatter regional dealers and vehicles when searching or panning outside seeded coverage areas.

