# Unit of Work: UOW-49
# Title: Desk Actions, Title Disclaimers, SMS Dispatch Hook & Hono Dealer BasicAuth

- [ ] Task 1: Server Route Protection with Hono basicAuth (src/server/index.js)
  - Import `basicAuth` from `hono/basic-auth`.
  - Protect the `/dealer` and `/dealer/*` route paths with `basicAuth`.
  - Read credentials from `process.env.DEALER_USER` (default: 'admin') and `process.env.DEALER_PASSWORD` (default fallback for dev/test: 'carboyz2026').
  - Ensure unauthenticated requests receive a 401 challenge, while public routes (`/`, static assets, `/api/offers/*`) remain open.

- [ ] Task 2: Extend Submission Model & Enum States (src/client/models/Submission.js)
  - Add REJECTED (or PASSED) to allowed submission statuses alongside NEW, PENDING_APPROVAL, and AUTO_COUNTER_SENT.
  - Add rejectionReason field (nullable string) with allowed values:
    - "COMPETITOR_OVER_RETAIL" ("Competitor offer exceeds market retail")
    - "TITLE_OR_CONDITION_ISSUE" ("Title brand, NMVTIS, or physical condition risk")
    - "INVENTORY_SATURATION" ("Dealership overstocked on this make/model")
    - "CUSTOMER_UNRESPONSIVE" ("Unable to contact seller")
    - "OTHER" ("Other reason")
  - Add rejectionNotes field (nullable string) for optional desk manager commentary.

- [ ] Task 3: Implement Desk "Pass / Reject Lead" Workflow (src/client/LeadInboxController.js & src/client/views/LeadInboxView.js)
  - Add a distinct "Pass / Reject" action button next to "Approve & Send" on pending lead cards.
  - Trigger a concise rejection modal prompting the user to select a rejectionReason and optional note.
  - On confirm, update submission status to REJECTED and persist rejection metadata.
  - In LeadInboxView, render passed/rejected leads with a muted gray badge [PASSED] and disable counter actions.
  - Add a toggle/filter in the Lead Inbox to view "Active Leads" vs. "Passed / Closed Leads".

- [ ] Task 4: Hardened Legal Title Verification Disclaimers (src/client/services/appraisalPdfGenerator.js)
  - Update generated SVG appraisal payload with explicit title and theft disclaimers:
    - State clearly that counter-offers are strictly conditional on physical title inspection.
    - Reference verification against NMVTIS, CARFAX/AutoCheck title branding (salvage, flood, lemon), lien release, and NICB theft records prior to vehicle purchase.
  - Ensure disclaimer renders cleanly within the printable SVG certificate footer without overflowing or truncating.

- [ ] Task 5: Pluggable Notification Dispatch Service (src/server/services/NotificationService.js & src/client/services/DispatchService.js)
  - Create a lightweight NotificationService interface with an SMS provider adapter pattern.
  - Implement a ConsoleSmsAdapter (logs formatted SMS payload to stdout in dev/test) and allow clean plugging of Twilio via env config (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).
  - When DispatchService marks a lead as PENDING_APPROVAL:
    - Query active team members from the dealer roster where notifyOnPending === true.
    - Dispatch SMS notification to each matching number:
      "🔥 CarBoyZ Lead Alert: {Year} {Make} {Model} (Comp: {Competitor} ${Amount}). Review pending counter at: {Host}/dealer?sub={Id}"

- [ ] Task 6: Testing & Quality Gates
  - Test Hono basicAuth: verify 401 without credentials and 200 with credentials on `/dealer`, while `/` stays public.
  - Unit tests for Submission model rejection status and reason validation.
  - Controller tests verifying rejectLead() status transitions and payload persistence.
  - Tests asserting appraisal SVG includes required legal title/NMVTIS verification text.
  - Mock dispatch tests verifying NotificationService triggers notifications strictly for roster members with notifyOnPending: true.
  - Ensure all 691+ existing tests pass without regressions.
  - Append completion records to .hydrate/PROJECT_JOURNAL.md, DEV_JOURNAL.md, and ARCHITECT_JOURNAL.md.
  - Archive active spec to .hydrate/archive/UOW-49.md.
  - Commit with: "feat(leads): add basicAuth gate, desk reject actions, title disclaimers, and sms dispatch hook"
