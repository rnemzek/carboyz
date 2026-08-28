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

### UOW-16 — Analytics & Win/Loss Reporting Dashboard

**Objective**
Build a dedicated Analytics Dashboard inside the Admin Portal that leverages the telemetry data captured in UOW-14 and seeded in UOW-15. The dashboard visualizes conversion rates, margin spreads, speed-to-lead performance, and competitor win/loss breakdowns.

**Acceptance Criteria** (as given by Product Owner)
1. Analytics Service Layer (`src/services/AnalyticsService.js`) — process raw `Submission` records (including seeded historical leads) and compute: win/loss conversion rate, average speed-to-lead broken down by `AUTO_DISPATCH` vs. `HUMAN_APPROVED`, total expected margin captured across won deals, competitor win-rate matrix, and price-tier volume/conversion distribution.
2. Analytics Dashboard UI (`src/ui/AnalyticsView.js` / `AnalyticsController.js`) — dedicated "Analytics" nav tab; KPI cards (Total Volume, Win Rate %, Avg Response Time, Total Expected Margin); competitor comparison table; price-bracket distribution table; approval-method split; date-range and competitor filter controls.
3. `tests/analyticsService.test.js` covering metrics calculations, empty/null safety, and filtering logic. ≥80% line/branch coverage. Full `npm test` regression pass + Playwright/manual browser check.

### Prior UOW
UOW-15's staged content archived to `.hydrate/archive/UOW-15.md` (shipped and committed as `8c819c4`).

### Architecture (Lead Architect step)

This UOW **is** Fast-Path eligible for the service/controller layer (pure, additive, no schema or breaking-contract changes) but the UI layer adds one new nav tab, following the exact precedent set by the `harness` tab in UOW-15 — no new architectural pattern is introduced.

---

#### 1. Data Model — no changes

No changes to `Submission.js`. Every field the dashboard needs already exists on `Submission` (from UOW-14/15): `competitor`, `competitorDealerName`, `competitorOfferAmount`, `finalCounterOffer`, `expectedMargin`, `timeToCounterMs`, `winLossStatus`, `approvalType`, `timestamp`. The ticket's "$0–$15k / $15k–$30k / $30k+" price brackets are a **fixed reporting bucketing**, distinct from the stored `submission.priceBracket` string (which is derived from configurable per-competitor spread tiers, e.g. `"$4,500-$5,500"`, and isn't a stable 3-bucket scheme). Analytics buckets independently off `competitorOfferAmount` (always present, non-negative, validated at construction — see `Submission.js` — so no null-guard needed there specifically, unlike the optional telemetry fields).

---

#### 2. `src/services/AnalyticsService.js` — pure functions + thin class wrapper

Same tier/shape as `DispatchService.js`: exported pure functions (unit-testable in isolation, no DOM, no storage) plus a class that wires them to a live `submissionService`.

**Exported constants:**
- `PRICE_TIERS` — 3 entries: `{ key, label, min, max }` — `0–15000` / `15000–30000` / `30000–null` (open-ended top bucket), labels `'$0–$15k'` / `'$15k–$30k'` / `'$30k+'`.
- `DATE_RANGE_PRESETS` — `{ LAST_7_DAYS, LAST_30_DAYS, ALL_TIME }` string enum.

**Exported pure functions:**
- `resolveSinceDate(preset, now = new Date())` → `Date | null` (`null` for `ALL_TIME`, meaning "no lower bound").
- `priceTierForAmount(amount)` → the matching `PRICE_TIERS` entry (last bucket catches everything ≥ its `min`).
- `competitorLabel(submission)` → mirrors the existing `competitorLabel` helper duplicated in `DispatchService.js`/`LeadInboxController.js` (`Other` + `competitorDealerName` when present) — a third small duplication is consistent with this codebase's existing precedent (both of those already re-implement it locally rather than sharing an import) rather than introducing a new shared-utils indirection unrequested by this UOW.
- `filterSubmissions(submissions, { since = null, competitor = null } = {})` → filters by `timestamp >= since` (when `since` is non-null) and by `competitorLabel(submission) === competitor` (when `competitor` is non-null/non-empty).
- `computeConversionMetrics(submissions)` → `{ total, won, lost, winRate }`; `winRate = won / (won + lost)`, `0` when no closed deals (empty-safe, no `NaN`).
- `computeSpeedToLead(submissions)` → `{ overallAvgMs, autoDispatchAvgMs, humanApprovedAvgMs }`, each averaged over submissions with a non-null numeric `timeToCounterMs` (sliced further by `approvalType` for the two breakdown fields); `null` (not `0`/`NaN`) when the relevant slice is empty — "no data" must be visually distinct from "0ms" in the UI.
- `computeMarginTotals(submissions)` → `{ totalExpectedMargin }`, summing `expectedMargin` only over `winLossStatus === 'WON'` submissions with a non-null numeric `expectedMargin` (margin is only actually "captured" on a won deal).
- `computeCompetitorMatrix(submissions)` → one row per distinct `competitorLabel` present in the input, each `{ competitor, volume, avgCounterOffer, winRate, totalMargin }` (`avgCounterOffer` over non-null `finalCounterOffer`; `winRate`/`totalMargin` reuse the two functions above scoped to that competitor's slice).
- `computePriceTierDistribution(submissions)` → one row per `PRICE_TIERS` entry (all 3 always present, even at `volume: 0`, so the UI table never collapses a bucket), each `{ tier, label, volume, winRate }`.
- `computeApprovalSplit(submissions)` → `{ autoDispatchCount, humanApprovedCount, autoDispatchPct, humanApprovedPct }`, scoped to submissions with a non-null `approvalType` (undispatched submissions don't count toward either side); percentages `0` when no dispatched submissions exist.
- `computeMetrics(submissions)` → single aggregate object combining all of the above, shaped exactly as the KPI-card/table props the view consumes: `{ totalVolume, winRate, won, lost, avgResponseTimeMs, speedToLead, totalExpectedMargin, competitorMatrix, priceTierDistribution, approvalSplit }`.

**Class:**
```
export class AnalyticsService {
  constructor({ submissionService } = {}) // throws 'AnalyticsService requires a submissionService' if missing
  getMetrics({ since = null, competitor = null } = {})   // filters live submissions, returns computeMetrics(...)
  getCompetitorLabels()                                   // distinct competitorLabel(...) values present, sorted — powers the filter <select>
}
```

---

#### 3. `src/ui/AnalyticsController.js`

Same thin shape as `SpreadConfigController.js`:
```
export class AnalyticsController {
  constructor({ analyticsService }) // throws if missing
  getDateRangePresets()             // Object.values(DATE_RANGE_PRESETS)
  getCompetitorOptions()            // analyticsService.getCompetitorLabels()
  buildViewModel({ dateRange = DATE_RANGE_PRESETS.ALL_TIME, competitor = null } = {})
    // → analyticsService.getMetrics({ since: resolveSinceDate(dateRange), competitor })
}
```

---

#### 4. `src/ui/AnalyticsView.js` — `renderAnalyticsView(controller)` → `{ section, refresh }`

Untested DOM-rendering tier (same precedent as `renderLeadInboxView`/`renderSpreadConfigView` — only the controller and pure service functions are unit-tested).

- **Filter row**: date-range `<select>` (3 `DATE_RANGE_PRESETS` options) + competitor `<select>` (`'All Competitors'` + `controller.getCompetitorOptions()`), both re-invoking `renderMetrics()` on `change`.
- **KPI row** (`.kpi-row` of `.kpi-card`): Total Volume, Win Rate % (`winRate * 100`, 1 decimal), Avg Response Time (`avgResponseTimeMs / 1000`, rounded seconds, "—" when `null`), Total Expected Margin (currency-formatted).
- **Competitor Comparison table** (`.data-table`): Competitor | Volume | Avg Counter | Win Rate % | Total Margin, one row per `competitorMatrix` entry, win-rate cell rendered with a CSS data-bar (`.data-bar` wrapping a `.data-bar__fill` sized by inline `style.width`, matching the `--pct` pattern already established for spread-tier visuals... — see `styles.css` addition below) — empty state row when `competitorMatrix` is empty.
- **Price Bracket Distribution table**: Bracket | Volume | Win Rate %, one row per `priceTierDistribution` entry (always 3 rows).
- **Approval Method Split**: single horizontal two-segment bar (`Auto-Dispatched` vs. `Human-Approved`, from `approvalSplit.autoDispatchPct`/`humanApprovedPct`) plus a text readout under it.

`refresh()` re-reads filter `<select>` values, calls `controller.buildViewModel(...)`, and re-renders all of the above in place (same `list.replaceChildren()` + rebuild pattern as `renderLeadInboxView`/`renderSpreadConfigView`'s `renderSections`).

---

#### 5. `App.js` wiring

- Import `AnalyticsService`, `AnalyticsController`, `renderAnalyticsView`.
- `getTenantState()`: instantiate `new AnalyticsService({ submissionService })` per tenant alongside the other tenant-scoped services (no storage dependency of its own — it only reads through `submissionService`).
- 8th nav tab, `'analytics'` → **"Analytics"**, added after `'admin'` and before `'harness'`, following the exact `renderTabs` button/`aria-selected`/visibility-toggle pattern used for all existing tabs (no new gating concept).
- `render()`: `new AnalyticsController({ analyticsService: state.analyticsService })`, `renderAnalyticsView(analyticsController)`, wire `.hidden` toggling + call `refresh()` on tab-select (same as `leads`' `refreshLeadsView()` today) so switching into the tab always reflects the latest submissions/seeded data.

---

#### 6. `src/ui/styles.css` additions

`.kpi-row` / `.kpi-card` (flex/grid row of stat tiles), `.data-table` (reuse existing table conventions if any, else minimal border-collapse styling), `.data-bar` / `.data-bar__fill` (simple CSS width-percentage bar, no new dependency), `.approval-split-bar` (two-segment flex bar). Theme-consistent with existing `styles.css` custom properties — no hardcoded colors outside the existing palette variables.

---

### Testing Summary (new)
- `tests/analyticsService.test.js` (new): `resolveSinceDate` for all 3 presets; `priceTierForAmount` boundary values (14999/15000/29999/30000/100000); `filterSubmissions` by `since` and by `competitor` (including `Other`+dealer-name label matching); `computeConversionMetrics`/`computeSpeedToLead`/`computeMarginTotals`/`computeApprovalSplit` empty-array safety (no `NaN`, `null` vs `0` distinction per spec above); `computeCompetitorMatrix` and `computePriceTierDistribution` against a small fixture set with known expected aggregates; `computeMetrics` end-to-end shape check; `AnalyticsService` class — constructor throws without `submissionService`, `getMetrics` filtering delegates correctly, `getCompetitorLabels` dedupes/sorts.
- Regression: full `npm test` must stay green (pre-existing `locationAdapter.test.js` env flakes remain the only expected failures, per every prior UOW's journal entry).
- Coverage: 80% line/branch standard applies to `AnalyticsService.js` and `AnalyticsController.js`.

### Other file touches
- `src/ui/styles.css` — additive only (§6).
- No changes to `Submission.js`, `SubmissionService.js`, `DispatchService.js`, `TestHarnessView.js`, or any other existing service/controller — this UOW is read-only over submission data.
- No changes to `index.html`/`package.json` (no new dependency).

## Execution Instruction
Architecture fully specified above. Lead Developer (Claude Code) to proceed directly with implementation and verification per Fast-Path Protocol §3 (One-Shot Context Transition) — no secondary plan-approval cycle required before writing code.
