# Roadmap Epics & Upcoming Units of Work - CarBoyZ

---

### Epic 1: Physical Mobile-to-Desktop QR Session Stash Handoff (Feature Focus)
* **Goal:** Connect `qrEncoder.js` and `SessionStashService` to UI views to enable seamless mobile-to-desktop session transitions[span_0](start_span)[span_0](end_span).
* **Capabilities:**
  * Generate a cross-device session-stash QR code directly within the Lead Intake UI using `qrEncoder.js`[span_1](start_span)[span_1](end_span).
  * Mobile phone camera scan opens the active session and streams updates back to the desktop Lead Inbox in real-time via `SyncAdapter` / WebSocket relay[span_2](start_span)[span_2](end_span).
  * Provides a complete multi-device intake experience without requiring external cloud account setup[span_3](start_span)[span_3](end_span).

---

### Epic 2: Policy Versioning & Immutable Audit Ledger (Governance Focus)
* **Goal:** Upgrade `SpreadConfigService` from raw `localStorage` overwrites to a versioned, append-only cryptographic audit trail[span_4](start_span)[span_4](end_span).
* **Capabilities:**
  * Semantic policy versioning (e.g., `v1.0.0`, `v1.1.0`) tracked per tenant[span_5](start_span)[span_5](end_span).
  * Append-only event log capturing `timestamp`, `authorId`, `previousConfigHash`, `newConfigHash`, and full `diffPayload`[span_6](start_span)[span_6](end_span).
  * Lays the necessary architectural foundation for Analytics Policy Version Pinning and Counterfactual "What-If" Simulation Engines[span_7](start_span)[span_7](end_span).

---

### Epic 3: Offline PWA Service Worker & Background Sync (Reliability Focus)
* **Goal:** Implement service worker caching and background sync to enable full offline appraisal creation in low-connectivity environments[span_8](start_span)[span_8](end_span).
* **Capabilities:**
  * Workbox service worker (`sw.js`) runtime caching for static assets, map tiles, and core app bundles[span_9](start_span)[span_9](end_span).
  * Background Sync Queue buffering offline submissions and automatically syncing them upon network reconnection[span_10](start_span)[span_10](end_span).
  * Network status detection with visual offline indicators in the PWA UI[span_11](start_span)[span_11](end_span).

---

