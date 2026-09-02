# Unit of Work Payload: UOW-CARBOYZ-25

**Title:** Offline Workbox PWA Service Worker & Background Sync Queue
**Target Scope:** `src/sw.js`, `src/services/TenantConfigService.js`, `src/services/SubmissionService.js`, `src/ui/App.js`

---

## 1. Context & Objective
Implement a Workbox-powered PWA Service Worker (`sw.js`) and background submission sync queue[span_3](start_span)[span_3](end_span)[span_4](start_span)[span_4](end_span). Enable full offline appraisal intake and submission creation in areas with low or zero cellular connectivity[span_5](start_span)[span_5](end_span)[span_6](start_span)[span_6](end_span). Submissions created while offline will buffer locally and auto-sync to the backend/SyncAdapter upon network reconnection[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span).

---

## 2. Acceptance Criteria
- [ ] **Service Worker Registration & Caching:** Register `sw.js` in `App.js` / `TenantConfigService.js` supporting offline runtime caching of core app assets, stylesheets, and PWA manifests[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).
- [ ] **Offline Background Sync Queue:** Create an offline submission queue in `SubmissionService.js` that catches network failures during seller intake submission and buffers payloads locally[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span).
- [ ] **Auto-Resync on Reconnect:** Listens to browser `online` window events and automatically flushes buffered offline submissions through `SyncAdapter` / `receiveExternalSubmission`[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span).
- [ ] **Offline Status Indicator UI:** Expose connection state in `App.js` or header views so users receive a clear visual indicator when operating in offline mode[span_15](start_span)[span_15](end_span)[span_16](start_span)[span_16](end_span).
- [ ] **Quality Gate & Zero Regression:** Maintain 100% test pass rate on `npm test` and achieve $\ge 80\%$ test coverage on new service worker helper and sync queue modules[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span).

---

## 3. Surgical Implementation Plan
1. **Service Worker Bootstrap:** Add `src/sw.js` with offline precaching and runtime caching rules for PWA assets[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span).
2. **Offline Submission Buffer:** Enhance `SubmissionService.js` with an offline queue state machine (PENDING_SYNC) stored in localStorage / IndexedDB[span_21](start_span)[span_21](end_span).
3. **Reconnection Listener:** Wire `online` event handlers in `SyncAdapter.js` or `SubmissionService.js` to trigger automatic batch replay[span_22](start_span)[span_22](end_span).
4. **Unit Verification:** Write unit tests in `tests/services/SubmissionService.test.js` validating offline queue buffering and online replay behavior[span_23](start_span)[span_23](end_span)[span_24](start_span)[span_24](end_span).
