# Roadmap Epics & Upcoming Units of Work - CarBoyZ

---

## OPEN ROADMAP ITEMS

### Epic Auth.0
We need to be able to secure who can update the Dealer configuration and it needs captured in the audit log so we have governance over the solution. We also probably need the ability to set up security around who can approve a counter offer and who can adjust a counter offer. Standard ACLs.

### Testing
Need to be able to generate some testing tools.

* **Real VINs:** You can easily grab real, active VINs directly from public online dealer inventory listings (e.g., searching for any vehicle on A    utoTrader, CarGurus, or local dealership websites, where VINs are listed publicly on the Vehicle Details Page).



---

## ✅✅✅✅✅   COMPLETED ROADMAP ITEMS ✅✅✅✅✅ 

# ✅ Strategic Analytics & Simulation Roadmap

## Epic: Comprehensive Analytics & "What-If" Simulation Engine

### ✅ 1. Out-of-the-Box Analytics & Multi-Surface Reporting
* **Cross-Device Viewport:** Responsive desktop and mobile PWA analytics dashboards for dealer managers on the floor or at the desk[span_13](start_span)[span_13](end_span).
* **Core KPI Visualizations:** Interactive time-series charts for Win Rate %, Gross Margin Captured, Speed-to-Lead, Auto/Human Approval Ratios, and Competitor Share Breakdown[span_14](start_span)[span_14](end_span).
* **Policy Pinning Overlays:** Visual vertical timeline pins on analytics charts marking exact moments when pricing policy versions (`v1.0.0`, `v1.1.0`) were deployed[span_15](start_span)[span_15](end_span).
* **Customization & Filters:** Dynamic slice-and-dice filters by date range, competitor source, price tier, vehicle make/model, and approval status[span_16](start_span)[span_16](end_span).

### ✅ 2. Counterfactual "What-If" Scenario Simulation Engine
* **Historical Submission Replay:** Replay historical seller submissions and competitor offers against candidate pricing tiers[span_17](start_span)[span_17](end_span).
* **Interactive Tier Modeling:** Test candidate policy changes (e.g., adjusting the $20k–$30k tier from flat $500 offset to 3% margin cap) before pushing to production[span_18](start_span)[span_18](end_span).
* **Impact Projections:** Calculate projected win/loss conversion shifts, total profit margin changes, and volume vs. margin trade-off curves[span_19](start_span)[span_19](end_span).

### ✅ 3. Submission Ingestion & Data Generation Framework
* **Real Submission Pipeline:** Live customer intake via QR pairing, mobile PWA, and CSV/CRM bulk import adapters[span_20](start_span)[span_20](end_span).
* **Synthetic Data Generator:** Parameterized test harness capable of generating realistic submission datasets with realistic VINs, market comp variations, and competitor offers[span_21](start_span)[span_21](end_span).
* **Time-Series State Seeder:** Automated seeder creating historical policy version chains (`v1.0.0` $\rightarrow$ `v1.2.0`) and matching historical submission telemetry for robust offline analytics testing[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span).

## ✅✅✅✅✅   COMPLETED ROADMAP ITEMS ✅✅✅✅✅ 

### ✅ Epic 1: Physical Mobile-to-Desktop QR Session Stash Handoff (Feature Focus)
* **Goal:** Connect `qrEncoder.js` and `SessionStashService` to UI views to enable seamless mobile-to-desktop session transitions[span_0](start_span)[span_0](end_span).
* **Capabilities:**
  * Generate a cross-device session-stash QR code directly within the Lead Intake UI using `qrEncoder.js`[span_1](start_span)[span_1](end_span).
  * Mobile phone camera scan opens the active session and streams updates back to the desktop Lead Inbox in real-time via `SyncAdapter` / WebSocket relay[span_2](start_span)[span_2](end_span).
  * Provides a complete multi-device intake experience without requiring external cloud account setup[span_3](start_span)[span_3](end_span).

---

### ✅ Epic 2: Policy Versioning & Immutable Audit Ledger (Governance Focus)
* **Goal:** Upgrade `SpreadConfigService` from raw `localStorage` overwrites to a versioned, append-only cryptographic audit trail[span_4](start_span)[span_4](end_span).
* **Capabilities:**
  * Semantic policy versioning (e.g., `v1.0.0`, `v1.1.0`) tracked per tenant[span_5](start_span)[span_5](end_span).
  * Append-only event log capturing `timestamp`, `authorId`, `previousConfigHash`, `newConfigHash`, and full `diffPayload`[span_6](start_span)[span_6](end_span).
  * Lays the necessary architectural foundation for Analytics Policy Version Pinning and Counterfactual "What-If" Simulation Engines[span_7](start_span)[span_7](end_span).

---

### ✅ Epic 3: Offline PWA Service Worker & Background Sync (Reliability Focus)
* **Goal:** Implement service worker caching and background sync to enable full offline appraisal creation in low-connectivity environments[span_8](start_span)[span_8](end_span).
* **Capabilities:**
  * Workbox service worker (`sw.js`) runtime caching for static assets, map tiles, and core app bundles[span_9](start_span)[span_9](end_span).
  * Background Sync Queue buffering offline submissions and automatically syncing them upon network reconnection[span_10](start_span)[span_10](end_span).
  * Network status detection with visual offline indicators in the PWA UI[span_11](start_span)[span_11](end_span).

---

