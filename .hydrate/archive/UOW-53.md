# Unit of Work: UOW-53
# Title: Dealer Offer & Counter Grid View with Inline Adjustment Engine

- [x] Task 1: Tabular Workspace View (src/ui/OfferCounterTableView.js)
  - Build responsive data grid displaying submissions sorted chronologically (newest first).
  - Columns: Timestamp, Vehicle (Y/M/M/Mileage), Competitor (Source + Offer), Market Spread / Margin Badge, Proposed Counter, Status, Actions.
  - Quick filter bar: [All], [Needs Review (Pending)], [Counter Sent], [Passed].
  - Summary header chips: Total Bids, Pending Review Count, Aggregate Projected Margin.

- [x] Task 2: Inline Counter Adjustment & Recalculation Modal/Popout (src/ui/OfferCounterTableView.js & src/services/SpreadService.js)
  - Allow desk managers to click proposed counter amount on PENDING_APPROVAL leads.
  - Provide quick-adjust stepper controls (+$100, +$250, +$500, or exact text input).
  - Live recalculation ticker: displays immediate impact on projected gross dealer profit margin before confirming.
  - Persist counter overrides to Submission model with modifiedBy: "DESK_OVERRIDE" and timestamp.

- [x] Task 3: Table State Actions & Dispatch Bridge (src/ui/LeadInboxController.js)
  - Wire row action buttons:
    - "Approve & Dispatch" (commits edited counter, sets status to AUTO_COUNTER_SENT, triggers dispatch).
    - "Pass" (opens rejection modal with standard reason enums).
    - "Inspect" (slides out full appraisal detail drawer).

- [x] Task 4: Navigation Integration (src/ui/App.js)
  - Add "Offer Grid" (or "Desk Workspace") tab to the /dealer navigation bar alongside Radar and Lead Inbox.
  - Ensure deep-linking (?view=dealer&tab=offers&sub=123) highlights and focuses the target lead row.

- [x] Task 5: Testing & Quality Gates
  - Unit tests for inline margin recalculation logic on manual counter overrides.
  - Controller tests verifying row approval, counter override persistence, and status updates.
  - Ensure all 801+ existing tests pass without regressions.
  - Update .hydrate journals and commit: "feat(desk): add tabular offer counter workspace with inline editing"
