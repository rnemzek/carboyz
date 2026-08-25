# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: carboyz
Working Directory (absolute): /Users/rnemzek/Projects/personal/carboyz

⚠ SAFETY: Before executing any file edits, confirm your current working
directory and open project match the path above exactly. If they do not
match, STOP and alert the Product Owner instead of proceeding.

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Architectural & System Execution Rules
See AI_PROJECT_RULES.md at repo root (Operating Triad Contract, Quality Gates, Surgical Execution Boundaries, Fast-Path Protocol).

## Target Task Scope & Active Sprint

### UOW-11 — Offer Beater Spread Engine & Lead Inbox View

**Objective**
Convert the back-office views into a dedicated Lead Inbox for your friend. This view ingests stored seller submissions, calculates the Offer Spread (Profit Margin) against market benchmark data, and highlights high-margin leads ready to be beaten.

**Acceptance Criteria**

1. Market Valuation & Spread Engine (`src/services/SpreadService.js`)

   Spread Formula:
   - Estimated Wholesale Value = Fair Market Value * 0.88 (or use existing market scoring model if available).
   - Spread (Margin) = Estimated Wholesale Value - Competitor Offer Amount.
   - Recommended Counter Offer = Competitor Offer Amount + $300 (configurable offset).

   Deal Scoring Status:
   - GREENLIGHT (Spread >= $1,000): Strong acquisition candidate.
   - MARGINAL ($300 <= Spread < $1,000): Low margin; requires manual review.
   - PASS (Spread < $300): Competitor offer is too high; walk away.

2. Lead Inbox Dashboard UI (`src/ui/LeadInboxView.js`)

   Replace or extend the "Dealer Studio / Buyer Search" views with an Admin Lead Inbox.

   Submission Cards: Render submission cards displaying:
   - Vehicle Details (Year, Make, Model, Trim, Mileage, Zip Code).
   - Competitor Name (e.g., CarMax, Carvana, Other (Hendrick Motors)).
   - Competitor Offer vs. Recommended Counter Offer.
   - Visual Spread Badge (GREENLIGHT / MARGINAL / PASS).
   - Link/Modal trigger to view uploaded offer document (Base64 PDF/Image).

   Action Controls: Buttons to update submission status (IN_REVIEW, OFFER_BEATEN, DECLINED).

3. Testing & Verification Standard
   - Unit tests in `tests/spreadService.test.js` covering calculation edge cases, negative spreads, and deal scoring rules.
   - Maintain at least 80% line and branch coverage on new service/domain modules.
   - Regression check: Ensure `npm test` runs clean across all 225+ existing unit tests.

### Architecture (Lead Architect step — matches existing repo conventions)

**FMV data source decision:** No VIN-decode/external pricing API exists in this repo. The closest "existing market scoring model" is `TelemetryService.getMarketStats(inventory, {make, model, year})`, already used by `DealerStudioController` to compute comp averages. `LeadInboxController` will call this against the tenant's current inventory (`ingestService.getInventory()`) per submission's make/model/year and use `marketStats.average` as Fair Market Value input to `SpreadService`. When no comps exist (`average === null`), `SpreadService` returns a `NO_DATA` status — Recommended Counter Offer still computes (doesn't depend on FMV), but no spread/badge is shown as scored.

- `src/services/SpreadService.js` — pure functions, no DI (no state to hold):
  - `WHOLESALE_FACTOR = 0.88`, `DEFAULT_COUNTER_OFFSET = 300` exported constants.
  - `DealScoreStatus` enum: `GREENLIGHT`, `MARGINAL`, `PASS`, `NO_DATA`.
  - `calculateSpread({ fairMarketValue, competitorOfferAmount, counterOfferOffset = DEFAULT_COUNTER_OFFSET })` → `{ estimatedWholesaleValue, spread, recommendedCounterOffer, status }`. Throws on invalid `competitorOfferAmount` (mirrors `Submission` model's own guard). Boundary rule: spread >= 1000 GREENLIGHT, >= 300 MARGINAL, else PASS (spread < 300, including negative). Missing/invalid `fairMarketValue` → `NO_DATA`, `estimatedWholesaleValue`/`spread` null.

- `src/ui/LeadInboxController.js` — DI'd `{ submissionService, telemetryService, ingestService }`, mirrors `DealerStudioController`. `buildLeadViewModels()` maps each submission to `{ submission, spreadResult }` by resolving FMV via `telemetryService.getMarketStats` + `evaluateVehicleMarketPosition`-style comp average, then `SpreadService.calculateSpread`. `updateStatus(id, status)` delegates to `submissionService.updateStatus`.

- `src/ui/LeadInboxView.js` — new view module (pattern: exports `renderLeadInboxView(controller)` returning a DOM section, `h()` builder convention). Submission cards show vehicle details, competitor (with `(dealerName)` suffix when `Other`), competitor offer vs. recommended counter, spread badge, "View Document" button opening a modal (reuses `.modal-overlay`/`.modal` pattern from `renderProgressModal`) rendering an `<img>` for image data URLs or a link for `application/pdf` data URLs. Three status-action buttons (`IN_REVIEW`, `OFFER_BEATEN`, `DECLINED`) re-render the card list on click.

- `App.js` wiring: **Extend, not replace** — Dealer Studio and Buyer Search tabs stay (removing them would break `ui.dealerStudioController.test.js` / `ui.buyerSearchController.test.js` and violate the "npm test clean across 225+ existing tests" regression gate). Add a new "Lead Inbox" tab alongside the existing four, wired the same way as the "Sell" tab was added in UOW-10. Not the default tab (Sell Your Car stays default per UOW-10's Product Owner decision).

- Styling: add `.badge--greenlight` / `.badge--marginal` / `.badge--pass` / `.badge--no-data` to `src/ui/styles.css`, reusing existing `--color-underpriced`/`--color-fair`/`--color-overpriced`/`--color-secondary` tokens (semantically: greenlight=underpriced-green, marginal=fair-amber, pass=overpriced-red, no-data=secondary-gray) — no new tokens.

- Tests: `tests/spreadService.test.js` (calculation edge cases: exact boundaries at 1000/300, negative spread, missing/null FMV, negative competitorOfferAmount throws, configurable offset), `tests/ui.leadInboxController.test.js` (view-model building, status updates), following existing `node:test` + `assert/strict` style.

## Execution Instruction
Architecture staged above. Lead Developer (Claude Code) to proceed via `EnterPlanMode` before touching files, per repo precedent for materially new scope (new domain service + new admin UI surface).
