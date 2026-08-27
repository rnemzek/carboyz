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

### UOW-12 — Configurable Spread Tier Engine & Admin Portal

**Objective**
Replace the fixed $300 counter-offer offset from UOW-11 with a per-tenant, per-competitor tier matrix (price bracket → flat $ / percent % / strategy) that dealers can edit themselves in a new Admin tab, with sane built-in defaults so nothing breaks for tenants who never touch the screen.

**Acceptance Criteria**

1. `src/services/SpreadConfigService.js` (New) — loads, validates, and saves tier configuration matrices per tenant in `localStorage`, with built-in default tiers.
2. `src/services/SpreadService.js` (Refactor) — `calculateSpread` accepts dynamic config, matches competitor tier brackets, and applies the `MAX(flat, percent)` evaluation.
3. `src/ui/SpreadConfigView.js` / Admin Portal (New) — table/form UI in a new Admin tab where dealers edit tier thresholds (min/max price, flat $, percent %, strategy) per competitor.
4. Tests — unit suite covering tier boundary matching, fallback behavior for missing competitors/tiers, and custom configuration overrides.

### Architecture (Lead Architect step — matches existing repo conventions)

**Tier shape:** `{ minPrice: number>=0, maxPrice: number|null, flatAmount: number>=0, percent: number>=0 (fraction, e.g. 0.02 = 2%), strategy: 'MAX'|'FLAT_ONLY'|'PERCENT_ONLY' }`. Matching is `competitorOfferAmount >= minPrice && (maxPrice === null || competitorOfferAmount < maxPrice)` — same inclusive/exclusive boundary style as `SpreadService`'s existing `>=` deal-score thresholds. `maxPrice: null` means unbounded (last tier only).

**Default ladder** (applied to every value in `COMPETITORS` from `src/models/Submission.js`), continuous with UOW-11's flat $300 baseline at the bottom bracket:
- `$0–$15,000` → flat `$300`, percent `0.02`, strategy `MAX`
- `$15,000–$30,000` → flat `$500`, percent `0.02`, strategy `MAX`
- `$30,000+` (maxPrice `null`) → flat `$750`, percent `0.015`, strategy `MAX`

- `src/services/SpreadConfigService.js` (new) — no DI beyond `{ tenantId, storage }`, mirrors `SubmissionService`'s storage pattern under key `carboyz:spreadConfig:<tenantId>` (try/catch read returns defaults on missing/corrupt data, try/catch write swallows quota/unavailable-storage errors, same comment style as `tenantResolution.js`/`SubmissionService.js`).
  - Exports `TIER_STRATEGIES = { MAX, FLAT_ONLY, PERCENT_ONLY }` and `DEFAULT_TIERS` (the 3-bracket ladder above, frozen).
  - `buildDefaultConfig(tenantId)` → `{ tenantId, tiersByCompetitor: Object.fromEntries(COMPETITORS.map(c => [c, structuredClone-equivalent of DEFAULT_TIERS])) }`.
  - `validateConfig(config)` (exported for reuse in tests) — throws `Error` with a descriptive message on: missing `tiersByCompetitor` object; per tier — non-numeric or negative `minPrice`; `maxPrice` not `null` and not a number greater than `minPrice`; non-numeric or negative `flatAmount`/`percent`; `strategy` not one of `TIER_STRATEGIES` (default to `MAX` when a tier omits `strategy` entirely, rather than throwing — keeps hand-authored configs terse). Does NOT require every entry in `COMPETITORS` to be present, and does NOT enforce non-overlapping/sorted brackets (out of scope — not requested and adds validation complexity the ticket doesn't ask for).
  - `class SpreadConfigService { constructor({tenantId, storage=null}); getConfig(); getTiersForCompetitor(competitor); saveConfig(nextConfig); resetToDefault(); }`. `getTiersForCompetitor` returns `[]` for a competitor key absent from the stored/default config (the "missing competitor" fallback case) — `SpreadService` treats an empty/no-match tier list as "use the flat default", never as an error.

- `src/services/SpreadService.js` (refactor, backward-compatible) — `calculateSpread({ fairMarketValue, competitorOfferAmount, tierConfig, counterOfferOffset = DEFAULT_COUNTER_OFFSET })`. New optional `tierConfig` (array of tier objects, or `undefined`). Internal helpers `matchTier(tiers, amount)` and `evaluateTierOffset(tier, amount)` (flat vs `amount * percent`, `Math.max` for the default/`MAX` strategy). When `tierConfig` is `undefined` or no bracket matches the `competitorOfferAmount`, falls back to the existing flat `counterOfferOffset` — this is the exact pre-UOW-12 code path, so all 12 existing tests in `tests/spreadService.test.js` keep passing unmodified with zero call-site changes required elsewhere that don't opt in.

- `src/ui/SpreadConfigController.js` (new) — mirrors `DealerStudioController`/`SellerSubmissionController`'s thin-DI-wrapper pattern: `constructor({ spreadConfigService })` throws if missing. `getCompetitors()` returns `COMPETITORS` (import from `Submission.js`, keeps the Admin form's competitor list in lockstep with the Sell/Lead Inbox forms). `buildViewModel()` → `{ competitors: [{ competitor, tiers }] }` via `spreadConfigService.getTiersForCompetitor`. `saveTiers(tiersByCompetitor)` → `spreadConfigService.saveConfig({ tiersByCompetitor })` (lets validation errors propagate — the view catches and displays them, same as `SellerSubmissionView`'s try/catch around `controller.submitSubmission`). `resetToDefault()` → `spreadConfigService.resetToDefault()`.

- `src/ui/SpreadConfigView.js` (new) — `renderSpreadConfigView(controller)` pattern (returns a `section`, no `refresh` needed since it owns its own re-render on save/reset like `SellerSubmissionView`). One `<fieldset>`-style block per competitor from `controller.getCompetitors()`, each rendering its tiers as repeatable rows (`h()` builder convention from `App.js`) with inputs: Min Price, Max Price (blank = unbounded), Flat $, Percent % (UI displays/accepts a whole-number percent, e.g. `2`, converted `/100` on save and `*100` on load — internal storage stays a 0–1 fraction), Strategy `<select>` (`MAX`/`FLAT_ONLY`/`PERCENT_ONLY`), and a "Remove Tier" button; an "Add Tier" button appends a blank row per competitor section. Global "Save Configuration" and "Reset to Defaults" buttons plus a `.form__status`/`.form__status--error` message element (exact pattern from `SellerSubmissionView`). Save reads all rows into a `tiersByCompetitor` object and calls `controller.saveTiers(...)`; Reset calls `controller.resetToDefault()` and re-renders the form from the fresh config.

- `src/ui/LeadInboxController.js` (small update, backward-compatible) — constructor gains an **optional** 4th param: `constructor({ submissionService, telemetryService, ingestService, spreadConfigService = null })`. The 3 existing required-dep throws are unchanged (existing `ui.leadInboxController.test.js` assertions keep passing as-is). In `buildLeadViewModels()`, resolve `const tierConfig = this.spreadConfigService?.getTiersForCompetitor(submission.competitor)` and pass `tierConfig` into `calculateSpread(...)`. With no `spreadConfigService` supplied, `tierConfig` is `undefined` and `calculateSpread` takes the flat-default path exactly as before — existing Lead Inbox tests are unaffected; only a new test needs to cover the tiered path.

- `App.js` wiring: **Extend, not replace** — same precedent as UOW-10/UOW-11 (removing an existing tab would break its controller test and violate the regression gate). `getTenantState()` gains `spreadConfigService: new SpreadConfigService({ tenantId, storage: window.localStorage })`. `render()` builds `spreadConfigController` and `renderSpreadConfigView(...)`, passes `state.spreadConfigService` into the existing `LeadInboxController` construction, and adds a 6th tab — "Admin" — wired identically to how "Lead Inbox" was added in UOW-11 (tab button, `hidden`/`aria-selected` toggling, appended to the `app` children list). Not the default tab; `'sell'` remains default per UOW-10's Product Owner decision.

- Styling: add a small, scoped set of classes to `src/ui/styles.css` for the tier editor — `.tier-section` (wraps one competitor's block, spacing via existing `--spacing` token), `.tier-row`/`.tier-row__field` (a `form__row--split`-style flex row for the 5 tier inputs), `.tier-row__remove` (reuses `.button.button--secondary` sizing). No new color tokens — reuse `--color-surface`/`--color-border`/`--radius` already defined. Keep this minimal per the ticket's "Simple table/form UI" framing.

- Tests:
  - `tests/spreadConfigService.test.js` (new): default config seeds every `COMPETITORS` entry with the 3-bracket ladder; `getTiersForCompetitor` on an unknown competitor string returns `[]` (missing-competitor fallback); `saveConfig` persists and a fresh `SpreadConfigService` instance sharing the same fake storage + `tenantId` picks up the saved tiers; two different `tenantId`s stay isolated in the same storage; `validateConfig`/`saveConfig` throws on negative `minPrice`, on `maxPrice <= minPrice`, on negative `flatAmount`/`percent`, and on an unrecognized `strategy` string; a tier omitting `strategy` defaults to `MAX`; `resetToDefault()` restores the built-in ladder after a custom save.
  - `tests/spreadService.test.js` (extend — do not remove/modify the 12 existing tests): tier boundary matching at exact `minPrice`/`maxPrice` edges; `MAX` strategy picks the larger of flat vs. percent-of-offer; `FLAT_ONLY`/`PERCENT_ONLY` override the comparison; a `tierConfig` with no bracket covering the given `competitorOfferAmount` falls back to the flat `counterOfferOffset` default (missing-tier fallback case) rather than throwing.
  - `tests/ui.spreadConfigController.test.js` (new): constructor requires `spreadConfigService`; `buildViewModel()` shape; `saveTiers`/`resetToDefault` round-trip through a real `SpreadConfigService`.
  - `tests/ui.leadInboxController.test.js` (extend, don't touch existing cases): one new test constructing `LeadInboxController` with a `spreadConfigService` holding custom tiers and asserting `recommendedCounterOffer`/`status` reflect the tiered evaluation instead of the flat $300 default.
  - Regression: `npm test` must stay green across all existing tests (241 as of UOW-11, 3 pre-existing unrelated `locationAdapter.test.js` env flakes noted in the dev journal — confirm those are still the only pre-existing failures, don't chase them).
  - Coverage: `node --test --experimental-test-coverage` on `SpreadConfigService.js`, the refactored `SpreadService.js`, and `SpreadConfigController.js` must clear the repo's 80% line/branch standard.

## Execution Instruction
Architecture staged above. Lead Developer (Claude Code) to proceed via `EnterPlanMode` before touching files, per repo precedent for materially new scope (new domain service + new admin UI surface + a public API change to an existing service function's signature).
