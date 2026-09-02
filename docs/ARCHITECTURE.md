```docs/ARCHITECTURE.md
# CarBoyZ Platform System Architecture

## 1. System Overview

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

## 2. Multi-Tenant Cellular Architecture

### Architectural Rationale
Instead of a single shared database with `tenant_id` columns across all tables, the platform utilizes a **Cellular Multi-Tenant Architecture**:
1. **Zero Maintenance-Window Provisioning:** New dealership tenants can be provisioned as isolated micro-containers without redeploying existing tenant runtimes.
2. **Data Isolation & Blast Radius:** Eliminates the risk of cross-tenant data leaks (a critical legal requirement in automotive dealer groups).
3. **Independent Upgrades:** Allows testing new features or custom strategy integrations on select tenant cells before rolling out globally.

---

## 3. Zero-Downtime Policy Propagation & Pub-Sub Flow

### The Problem
When Dealer X updates their spread pricing tiers, auto-approval thresholds, or margin factors, the appraisal engine must immediately evaluate incoming submissions against the new rules **without disk read overhead on every transaction**.

### The Flow

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

## 4. Governance, Analytics Pinning & Audit Logging

### Analytics Version Pinning
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

Step 3: Context Rehydration Prompt for New Session
Copy and save the block below. When you launch a fresh session in your terminal, paste this prompt directly:

Please rehydrate project context using @nemzilla/hydrate and review the existing architecture documentation.

Current state:
- Front-end / PWA engine complete through UOW-18 (intake, spread engine, white-labeling, canvas icon generator, PDF appraisal generator, camera VIN barcode scanner).
- Future roadmap and architecture artifacts are documented in `docs/FUTURE_ROADMAP_ITEMS.md` and `docs/ARCHITECTURE.md`.

Let's review the current status and plan our next move.
```

```docs/FUTURE_ROADMAP_ITEMS.md
# Future Roadmap Items & System Vision

This document tracks upcoming strategic architecture and product capabilities for the CarBoyZ / White-Label Vehicle Appraisal Platform.

---

## Epic 1: Multi-Tenant Backend API & WebSocket Sync (Cellular Architecture)
* **Goal:** Transition from local `BroadcastChannel` cross-tab syncing to a cellular cloud backend with real-time pub-sub.
* **Architecture:** Content-based routing / load balancer ingress serving isolated, micro-container backend instances per tenant cell.
* **Capabilities:** 
  * Real-time cross-device phone-to-laptop session stashing (QR scan on physical mobile phone updates desktop inbox instantly).
  * High fault isolation and zero cross-tenant data leakage risk.

## Epic 2: Offline Persistence & Service Worker Caching (Workbox PWA)
* **Goal:** Enable full offline appraisal creation and intake in areas with low cellular coverage.
* **Capabilities:**
  * Background sync queue using Workbox service workers to buffer submissions when offline.
  * Instant auto-resync upon reconnecting to network.

## Epic 3: Policy Change Governance & Immutable Audit Trail
* **Goal:** Create a cryptographically secure / immutable event ledger of all rule, tier, and pricing policy mutations per tenant.
* **Capabilities:**
  * Append-only audit log capturing `timestamp`, `userId`, `previousConfigHash`, `newConfigHash`, and `diffPayload`.
  * Verifiable ledger state to ensure compliance and audit readiness.

## Epic 4: Configuration Version History & Pinning
* **Goal:** Allow dealers to track performance metrics against specific policy versions and rollback or re-apply historical configurations.
* **Capabilities:**
  * Semantic policy versioning (`v1.0.0`, `v1.1.0`, `v1.2.0`).
  * Visual time-series chart annotations (dropping vertical pins/lines on Analytics charts indicating *"Policy v1.2 applied here"*).
  * One-click configuration rollback / restore from historical snapshots.

## Epic 5: Counterfactual "What-If" Scenario Simulation Engine
* **Goal:** Allow dealers to run simulation models against historical submission data to test prospective policy updates before deploying them live.
* **Capabilities:**
  * Replay past $N$ months of actual seller submissions and competitor offers against candidate spread tiers.
  * Calculate projected impact on Win/Loss conversion rates, overall volume, total margin captured, and bottom-line revenue.
  * Trade-off visualization: Identify scenarios where higher win rates result in lower overall profit margin (winning the battle vs. winning the war).

```
