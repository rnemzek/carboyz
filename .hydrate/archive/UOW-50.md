# Unit of Work: UOW-50
# Title: Desk Unreviewed Lead Escalation Nags & Operating Quiet Hours

- [ ] Task 1: Extend Tenant Configuration with Operating Hours & Nag Windows (src/client/models/TenantConfig.js & src/client/services/TenantConfigService.js)
  - Add operatingSchedule to TenantConfig defaults:
    - enabled: true
    - openHourLocal: 8 (8:00 AM)
    - closeHourLocal: 21 (9:00 PM)
    - timeZone: "America/New_York" (or browser-resolved fallback)
    - nagIntervalMinutes: 15 (escalate unreviewed leads after 15m)
  - Add helper isWithinOperatingHours(date, schedule) to evaluate whether an alert should fire immediately vs queue.

- [ ] Task 2: Implement Unreviewed Lead Escalation Evaluator (src/client/services/LeadEscalationService.js)
  - Create LeadEscalationService taking submissionService, notificationService, and tenantConfigService.
  - Implement evaluatePendingLeads({ now }):
    - Scan submissions with status === 'PENDING_APPROVAL'.
    - If now - submission.timestamp >= nagIntervalMinutes and submission has no nagSentAt:
      - If within operating hours:
        - Dispatch escalation SMS:
          "⚠️ Escalation: Lead #{Id} ({Year} {Make} {Model}) waiting {Elapsed}m without review. Review now: {Host}/dealer?sub={Id}"
        - Patch submission with nagSentAt: now.toISOString() via submissionService.
      - If outside operating hours (quiet hours):
        - Flag submission with queuedForMorningDigest: true (suppress sound/SMS).

- [ ] Task 3: Morning Digest Sweep (src/client/services/LeadEscalationService.js)
  - Implement evaluateMorningDigest({ now }):
    - When transitions from closed to open (at or just after openHourLocal, e.g. 8:00 AM):
      - Query all submissions where queuedForMorningDigest === true.
      - If count > 0:
        - Dispatch single rollup SMS to roster managers:
          "🌅 Good morning CarBoyZ desk: {Count} customer offer(s) arrived overnight waiting for review: {Host}/dealer"
        - Clear queuedForMorningDigest flag and mark digestSentAt: now.toISOString().

- [ ] Task 4: Lead Inbox UI Visual Indicators (src/client/views/LeadInboxView.js)
  - For leads where status === 'PENDING_APPROVAL':
    - If elapsed time >= 15 minutes, render an animated or high-visibility badge: [NEEDS REVIEW - 15m+] (amber/red pulse).
    - If nagSentAt is present, show a subtle timestamp: "Escalated to desk at HH:MM".

- [ ] Task 5: Testing & Quality Gates
  - Unit tests for isWithinOperatingHours() across daytime, midnight, and timezone boundary conditions.
  - Tests for evaluatePendingLeads() verifying 15-minute nag interval enforcement and nagSentAt timestamp pinning.
  - Tests verifying quiet hours suppression and morning digest dispatch count rollup.
  - Ensure all 720+ existing tests pass without regressions.
  - Append completion records to .hydrate/PROJECT_JOURNAL.md, DEV_JOURNAL.md, and ARCHITECT_JOURNAL.md.
  - Archive active spec to .hydrate/archive/UOW-50.md.
  - Commit with: "feat(leads): add unreviewed lead escalation nags and operating quiet hours"
