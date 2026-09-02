# Unit of Work Payload: UOW-CARBOYZ-24

**Title:** Mobile QR Session Stash & Live Desktop Inbox Relay Handoff
**Target Scope:** `src/services/SessionStashService.js`, `src/services/SyncAdapter.js`, `src/ui/LeadInboxView.js`, `src/ui/SellerSubmissionView.js`, `src/controllers/LeadInboxController.js`

---

## 1. Context & Objective
Wire the zero-dependency QR code generator (`qrEncoder.js`) and `SessionStashService` into the Lead Inbox UI and Mobile Intake views[span_0](start_span)[span_0](end_span). Allow dealership staff on a desktop screen to display a session pairing QR code that a customer scans on their mobile device[span_1](start_span)[span_1](end_span). When scanned, the customer's phone binds to the active session and streams competitor appraisal submissions live to the desktop Lead Inbox via `SyncAdapter` (WebSocket relay / BroadcastChannel)[span_2](start_span)[span_2](end_span).

---

## 2. Acceptance Criteria
- [ ] **QR Pairing Generator Widget:** `LeadInboxView.js` / `LeadInboxController.js` presents a "Pair Mobile Device" modal/card that uses `qrEncoder.js` to render a scan-ready SVG/data-URI QR code containing a unique session pairing URL[span_3](start_span)[span_3](end_span).
- [ ] **Mobile Session Ingestion:** `SellerSubmissionView.js` detects session pairing tokens from URL query parameters (`?sessionId=...`) and binds `SessionStashService` state on load[span_4](start_span)[span_4](end_span).
- [ ] **Real-Time Desktop Handoff Stream:** Submissions completed on the mobile device emit `SUBMISSION_CREATED` events through `SessionStashService` $\rightarrow$ `SyncAdapter`, instantly popping up in the connected desktop `LeadInboxView` without requiring page reloads[span_5](start_span)[span_5](end_span).
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% of existing 476 tests and new unit tests covering session pairing logic[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span). Line and branch coverage for modified services/controllers remains $\ge 80\%$[span_8](start_span)[span_8](end_span).

---

## 3. Surgical Implementation Plan
1. **Controller Handoff Binding:** Update `LeadInboxController.js` to generate session pairing URLs and listen for stash events[span_9](start_span)[span_9](end_span).
2. **Inbox QR View Integration:** Add pairing UI rendering in `LeadInboxView.js` using `qrEncoder.generateQRCodeSVG()`[span_10](start_span)[span_10](end_span).
3. **Seller View Auto-Pairing:** Update `SellerSubmissionView.js` to parse URL params and configure `SessionStashService`[span_11](start_span)[span_11](end_span).
4. **Unit Verification:** Write test suites in `tests/services/SessionStashService.test.js` or `tests/controllers/` verifying end-to-end payload emission and parsing[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span).
