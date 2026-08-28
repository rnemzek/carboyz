# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: carboyz
Working Directory (absolute): /Users/rnemzek/Projects/personal/carboyz

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Target Task Scope

### UOW-21 — Multi-Tenant Mobile Intake & Desktop Inbox Sync UI Integration (Epic 1 Phase 2)

**Objective**
Wire the `SyncAdapter` service built in UOW-20 into the CarBoyZ PWA UI layers (SolidJS/ESM modules), connecting real-time submission creation on mobile phone intake views to live inbox state updates on desktop lead management dashboards.

**Acceptance Criteria**
1. **SyncAdapter UI Binding**:
   - Instantiate and initialize `SyncAdapter` inside main application bootstrap (`src/ui/App.js` or core controller).
   - Ensure tenant routing key (`tenantId`) is resolved from URL parameters (`?tenant=X`), subdomain context, or localized store settings.
2. **Real-Time Intake Emission**:
   - Updating vehicle appraisal or lead submission forms in mobile view triggers `SyncAdapter.broadcast('SUBMISSION_CREATED', payload)`.
   - Form submission operates seamlessly offline via `BroadcastChannel` local fallback when socket connectivity drops.
3. **Desktop Lead Inbox Real-Time Refresh**:
   - Desktop lead inbox component listens for `SUBMISSION_SYNCED` events and updates the lead stream reactivity without requiring a full manual page refresh.
   - Show an subtle inline UI toast/indicator ("New lead received in cell") upon remote event reception.
4. **Testing & Quality Gates**:
   - Unit/component tests covering `SyncAdapter` UI event handling in `tests/ui/syncIntegration.test.js`.
   - Maintain ≥80% line and branch test coverage on new UI controller code.
   - All existing test suites pass (`npm test`).
5. **Log Completion**:
   - Append execution summary directly to `docs/SYSTEM.md` (Section 4: Decision & Execution Log).
