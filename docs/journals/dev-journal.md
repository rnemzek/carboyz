# Developer Journal & Telemetry Log

## [Day Zero] — Harness Initialized
- **Date:** 8/18/2026
- **Status:** Scaffolding complete via @nemzilla/hydrate. Ready for UOW-01 execution.

## [UOW-01] — Scaffold Repository & Core Architecture
- **Date:** 8/18/2026
- **Status:** Complete. All 4 tasks done, `npm test` passing 6/6.

### Tasks completed
- **1.1:** `package.json` (`"type": "module"`, `test` script → `node --test`) and folder layout: `src/core/`, `src/config/`, `src/services/`, `tests/`.
- **1.2:** `src/core/index.js` aggregates core exports (`DEFAULT_TENANT_CONFIG`, `createTenantConfig`, `HapticsService`, `ShareService`); `src/index.js` re-exports it as the package entry point.
  - `src/config/tenantConfig.js` — tenant branding schema (`tenantId`, `name`, `logoUrl`, `themeColors`) with defaults and a merge-aware factory.
  - `src/services/HapticsService.js` — wraps `navigator.vibrate` with feature detection and a safe no-op fallback.
  - `src/services/ShareService.js` — wraps `navigator.share` with feature detection and a safe `{ shared: false }` fallback.
- **1.3:** Native Node test runner (`node --test`), suites in `tests/tenantConfig.test.js`, `tests/services.test.js`, `tests/index.test.js`.
- **1.4:** `npm test` verified passing.

### Files added/modified
- `package.json` (new)
- `src/index.js` (new)
- `src/core/index.js` (new)
- `src/config/tenantConfig.js` (new)
- `src/services/HapticsService.js` (new)
- `src/services/ShareService.js` (new)
- `tests/tenantConfig.test.js` (new)
- `tests/services.test.js` (new)
- `tests/index.test.js` (new)
- `.hydrate/CURRENT_UOW.md` (checkboxes updated)

### Test output
```
✔ core module exports all expected members (0.232375ms)
✔ HapticsService reports unsupported and no-ops safely without navigator.vibrate (0.41225ms)
✔ ShareService reports unsupported and resolves safely without navigator.share (0.7085ms)
✔ createTenantConfig falls back to defaults when called with no overrides (0.901084ms)
✔ createTenantConfig merges partial overrides on top of defaults (0.068167ms)
✔ createTenantConfig merges themeColors instead of replacing them wholesale (0.045459ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## [UOW-02] — Core Vehicle & Competitor Telemetry Domain
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 23/23. Overall coverage 97.91% lines / 90.91% branches (quality gate: 80%).

### Tasks completed
- **2.1:** `src/models/Dealer.js` and `src/models/Vehicle.js` — both require `tenantId` at construction and expose `belongsToTenant(tenantId)` for tenant isolation; `Vehicle` also exposes `matches({ make, model, year })` for market filtering.
- **2.2:** `src/utils/geo.js` — `haversineDistanceMiles(pointA, pointB)` using Earth radius 3958.8 mi.
- **2.3:** `src/services/TelemetryService.js`:
  - `filterByRadius(vehicles, targetDealer, maxRadiusMiles)` — tenant-isolated, resolves each vehicle's location (its own lat/lng or its dealer's via a `dealerId` lookup map) and filters by Haversine distance.
  - `getMarketStats(vehicles, { make, model, year })` — returns `{ count, average, min, max, median, priceSpread, standardDeviation }`; returns all-null stats when no vehicles match.
  - `evaluateMarketPosition(vehicle, marketStats)` — z-score based (±0.5σ band) classification into `MarketPosition.UNDERPRICED | FAIR | OVERPRICED`; falls back to direct average comparison when standard deviation is 0.
- **2.4:** New suites `tests/geo.test.js`, `tests/models.test.js`, `tests/telemetryService.test.js`; `tests/index.test.js` extended to cover the new core exports.
- **2.5:** `npm test` passing 23/23; coverage verified via `node --test --experimental-test-coverage`.

### Files added/modified
- `src/models/Dealer.js` (new)
- `src/models/Vehicle.js` (new)
- `src/utils/geo.js` (new)
- `src/services/TelemetryService.js` (new)
- `src/core/index.js` (modified — exports new models/service/util)
- `tests/geo.test.js` (new)
- `tests/models.test.js` (new)
- `tests/telemetryService.test.js` (new)
- `tests/index.test.js` (modified — asserts new exports)
- `AI_PROJECT_RULES.md` (Quality Gate: 80% coverage on domain models/services — added externally prior to this session picking up the task)
- `.hydrate/CURRENT_UOW.md` (UOW-01 finalized, UOW-02 checkboxes updated)

### Test output
```
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                  | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------
ℹ  config/tenantConfig.js | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js          | 100.00 |   100.00 |  100.00 |
ℹ  index.js               | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js       | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js      | 100.00 |    86.96 |  100.00 |
ℹ  services/HapticsService.js   |  93.75 |    80.00 |  100.00 | 14
ℹ  services/ShareService.js     |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js |  97.85 |    94.59 |  100.00 | 18-19
ℹ  utils/geo.js           | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------
ℹ all files              |  97.91 |    90.91 |  100.00 |
```

## [UOW-03] — Buyer Search & Dealer Ingest Engine
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 48/48. Overall coverage 98.28% lines / 91.77% branches (quality gate: 80%).

### Tasks completed
- **3.1:** `src/services/SearchService.js` — `search(vehicles, criteria)` filters by `tenantId`, `maxPrice`, `maxMileage`, `bodyStyle`, and `make`/`model`/`year` (via `Vehicle.matches`), plus radius filtering against an `origin` point or a `originDealerId` resolved through a dealer lookup map. Added an optional `bodyStyle` field to `Vehicle` (`src/models/Vehicle.js`) to support category filtering.
- **3.2:** Sorting via a `sortBy` criterion — `price_asc`, `mileage_asc`, `distance_asc` (throws if no origin is supplied), and `best_value` (a price + mileage-weighted score, `price + mileage * 0.05`). Unrecognized `sortBy` values leave results in filtered order. Results are returned as `{ vehicle, distanceMiles }` entries so distance is available to callers without a second lookup.
- **3.3:** `src/services/IngestService.js` — `intake(vehicleData)` constructs a `Vehicle`, force-tags it with the service's configured `tenantId` (overriding any `tenantId` in the payload), auto-generates a sequential `vehicleId` (`${tenantId}-veh-${n}`) when omitted, and instantly evaluates it against the service's running inventory via `TelemetryService.getMarketStats` + `evaluateMarketPosition` (returns `marketPosition: null` when no comparables exist yet). Maintains an internal inventory array (optionally seeded via `marketVehicles`), exposed as a defensive copy via `getInventory()`.
- **3.4:** New suites `tests/searchService.test.js`, `tests/ingestService.test.js`; `tests/models.test.js` extended for `bodyStyle`; `tests/index.test.js` extended for the new core exports.
- **3.5:** `npm test` passing 48/48; coverage verified via `node --test --experimental-test-coverage`.

### Files added/modified
- `src/services/SearchService.js` (new)
- `src/services/IngestService.js` (new)
- `src/models/Vehicle.js` (modified — added `bodyStyle` field)
- `src/core/index.js` (modified — exports `SearchService`, `IngestService`)
- `tests/searchService.test.js` (new)
- `tests/ingestService.test.js` (new)
- `tests/models.test.js` (modified — `bodyStyle` coverage)
- `tests/index.test.js` (modified — asserts new exports)
- `.hydrate/CURRENT_UOW.md` (UOW-02 finalized, UOW-03 checkboxes updated)

### Test output
```
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                  | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------
ℹ  config/tenantConfig.js | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js          | 100.00 |   100.00 |  100.00 |
ℹ  index.js               | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js       | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js      | 100.00 |   100.00 |  100.00 |
ℹ  services/HapticsService.js   |  93.75 |    80.00 |  100.00 | 14
ℹ  services/IngestService.js    | 100.00 |   100.00 |  100.00 |
ℹ  services/SearchService.js    |  98.08 |    85.96 |  100.00 | 23-24
ℹ  services/ShareService.js     |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js |  97.85 |    94.59 |  100.00 | 18-19
ℹ  utils/geo.js           | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------
ℹ all files              |  98.28 |    91.77 |  100.00 |
```

## [UOW-04] — Mobile-First PWA Command Canvas & Dual-View Demo
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 70/70. Overall coverage 98.19% lines / 93.07% branches / 98.44% funcs (quality gate: 80%).
- **Caveat:** No browser-automation tool is available in this environment, so the UI was not visually verified in an actual browser. All DOM-independent logic (theming, badges, card view-models, and the two view controllers) is unit tested; `src/ui/App.js` (the DOM-wiring layer) is syntax-checked (`node --check`) and its static assets were smoke-tested over a local HTTP server (200 responses for `index.html`, `styles.css`, `App.js`), but its actual rendering/interactivity has not been visually confirmed — please sanity-check in a browser using the launch instructions below.

### Tasks completed
- **4.1:** Mobile-first UI shell under `src/ui/`, served via root `index.html` (`<div id="app-root">` + `<script type="module" src="/src/ui/App.js">`). `src/ui/styles.css` is written mobile-first (single-column, max-width app frame, `@media (min-width: 600px)` widening) and themed entirely through CSS custom properties (`--color-primary`, `--color-secondary`, `--color-background`, `--color-text`, plus badge/surface tokens). `src/ui/theme.js` exports `themeToCssVariables(themeColors)` (pure mapping, DOM-free) and `applyTenantTheme(tenantConfig, target)` (sets the custom properties on a target — defaults to `document.documentElement` in a browser, safe no-op in Node), so any `TenantConfig` re-skins the app at runtime.
- **4.2:** Dealer Studio View (`src/ui/DealerStudioController.js`, wired into the DOM by `renderDealerStudioView` in `src/ui/App.js`):
  - `submitIntake(vehicleData)` calls `IngestService.intake`, fires `HapticsService.vibrate()` on success, and returns a ready-to-render card.
  - `buildInventoryViewModels()` recomputes market position **live** for every vehicle in inventory against the *current* full inventory (not the stale value captured at intake time), via `TelemetryService.getMarketStats` + `evaluateMarketPosition`, rendered as `UNDERPRICED`/`FAIR`/`OVERPRICED` badges (`src/ui/marketBadge.js`).
  - `notifyPriceChange()` fires a haptic pulse; wired to the price `<input>`'s `change` event in `App.js` for live price-update feedback.
- **4.3:** Buyer Search View (`src/ui/BuyerSearchController.js`, wired by `renderBuyerSearchView`): a filter form (max price, max mileage, radius + origin dealer, body style, sort) posts criteria straight to `SearchService.search`; results render as vehicle cards showing distance, price, mileage, and body style via the shared `buildVehicleCardViewModel` (`src/ui/vehicleCard.js`).
- **4.4:** Both Dealer Studio inventory cards and Buyer Search result cards render a "Share" button wired to `ShareService.share(card.shareData)` (directly in Dealer Studio; through `BuyerSearchController.shareVehicle` in Buyer Search), with graceful `{ shared: false, reason: 'unsupported' }` fallback on non-PWA browsers.
- **4.5:** `npm test` passing 70/70; coverage verified via `node --test --experimental-test-coverage`. `App.js` (DOM-only) is intentionally excluded from unit tests — it isn't imported by any test file, so it neither breaks `npm test` nor drags down the coverage numbers; its logic-bearing collaborators (`theme.js`, `marketBadge.js`, `vehicleCard.js`, `DealerStudioController.js`, `BuyerSearchController.js`) are fully unit tested instead.

### Web app launch instructions
The app is static ES modules + CSS with no build step. Serve the **repository root** (so `/src/ui/...` absolute paths resolve) with any static file server, then open the printed URL in a browser:

```bash
# Option A — Python (no install required)
python3 -m http.server 8080
# then open http://localhost:8080/index.html

# Option B — Node (via npx, nothing added to package.json)
npx serve .
```

Opening `index.html` directly via `file://` will **not** work — browsers block `type="module"` script loads from the `file://` origin, so a local HTTP server is required.

### Files added/modified
- `index.html` (new)
- `src/ui/App.js` (new — DOM wiring, browser-only entry, mounted via `mountApp(root)`)
- `src/ui/styles.css` (new)
- `src/ui/theme.js` (new)
- `src/ui/marketBadge.js` (new)
- `src/ui/vehicleCard.js` (new)
- `src/ui/DealerStudioController.js` (new)
- `src/ui/BuyerSearchController.js` (new)
- `tests/ui.theme.test.js` (new)
- `tests/ui.marketBadge.test.js` (new)
- `tests/ui.vehicleCard.test.js` (new)
- `tests/ui.dealerStudioController.test.js` (new)
- `tests/ui.buyerSearchController.test.js` (new)
- `.hydrate/CURRENT_UOW.md` (UOW-03 finalized, UOW-04 checkboxes updated)

### Test output
```
ℹ tests 70
ℹ suites 0
ℹ pass 70
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                        | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------------
ℹ  config/tenantConfig.js      | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js               | 100.00 |   100.00 |  100.00 |
ℹ  index.js                    | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js            | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js           | 100.00 |   100.00 |  100.00 |
ℹ  services/HapticsService.js  |  93.75 |    80.00 |  100.00 | 14
ℹ  services/IngestService.js   | 100.00 |   100.00 |  100.00 |
ℹ  services/SearchService.js   |  98.08 |    85.96 |  100.00 | 23-24
ℹ  services/ShareService.js    |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js|  97.85 |    94.87 |  100.00 | 18-19
ℹ  ui/BuyerSearchController.js | 100.00 |   100.00 |  100.00 |
ℹ  ui/DealerStudioController.js| 100.00 |    92.86 |  100.00 |
ℹ  ui/marketBadge.js           | 100.00 |   100.00 |  100.00 |
ℹ  ui/theme.js                 |  89.29 |   100.00 |   80.00 | 16-18
ℹ  ui/vehicleCard.js           | 100.00 |   100.00 |  100.00 |
ℹ  utils/geo.js                | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------------
ℹ all files                    |  98.19 |    93.07 |   98.44 |
```

## [UOW-05] — White-Label Branding Engine & Dynamic Presets
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 93/93. Overall coverage 98.47% lines / 94.04% branches / 98.68% funcs (quality gate: 80%).

### Tasks completed
- **5.1:** `src/config/TenantRegistry.js` — `register(preset)`/`get(tenantId)`/`has(tenantId)`/`list()` manage a set of dealer brand presets, each normalized through `createTenantConfig` (so every preset gets the full shape: `tenantId`, `name`, `tagline`, `logoUrl`, `themeColors`, `contact`). Extended `src/config/tenantConfig.js` with `tagline` (string) and `contact` (`{ phone, email }`, deep-merged like `themeColors`) fields.
- **5.2:** `src/config/tenantResolution.js` — pure helpers `readTenantIdFromUrl(search)` (parses `?tenant=`), `readTenantIdFromStorage`/`writeTenantIdToStorage` (wrapped in try/catch since Safari private-mode `localStorage` can throw), and `resolveActiveTenantId({ search, storage, defaultTenantId })` which prioritizes URL → localStorage → default, persisting a URL-resolved id back to storage so it survives a subsequent reload without the query string. `TenantRegistry.resolveTenant(...)` composes this with registry lookups and falls back to a bare `createTenantConfig()` if the resolved id isn't a known preset.
- **5.3:** `App.js`'s `renderHeader` now renders the dealer's `tagline` under the title, and `renderBrandLogo` shows the `logoUrl` `<img>` when present — swapping to a text-initials fallback (`getBrandInitials`, `src/ui/branding.js`) both when no `logoUrl` is configured and reactively via an `error` listener if the image fails to load. `applyTenantTheme` (from UOW-04) is re-invoked on every tenant switch, re-painting the CSS custom properties on `document.documentElement`.
- **5.4:** `renderBrandSwitcher` adds a `<select>` of all `TenantRegistry.list()` presets to the top of the Dealer Studio view. Selecting a brand calls `switchTenant(tenantId)`, which swaps the active `TenantConfig`, persists the choice via `writeTenantIdToStorage`, and re-renders the whole app shell. Each tenant gets its own lazily-created, cached `{ dealers, telemetryService, ingestService, searchService }` state (keyed by `tenantId`) so each white-label brand keeps an isolated dealer network and inventory — switching back to a brand preserves what was ingested for it. Three demo presets ship out of the box: Carboyz Motors, Summit Auto Group, Harbor Motors Collective, each with distinct theme colors, tagline, contact info, and a small dealer network.
- **5.5:** New suites `tests/tenantResolution.test.js`, `tests/tenantRegistry.test.js`, `tests/ui.branding.test.js`; `tests/tenantConfig.test.js` extended for `tagline`/`contact` merging; `tests/index.test.js` extended for the new core exports (`TenantRegistry`, `TENANT_STORAGE_KEY`, `readTenantIdFromUrl`, `readTenantIdFromStorage`, `writeTenantIdToStorage`, `resolveActiveTenantId`). `npm test` passing 93/93; coverage verified via `node --test --experimental-test-coverage`.

### Caveat (carried forward from UOW-04)
No browser-automation tool is available in this environment. `App.js`'s DOM wiring — including the new brand switcher, logo fallback swap, and tenant-switch re-render — was syntax-checked (`node --check`) and its static assets smoke-tested over a local HTTP server (200s for `index.html`, `App.js`, `TenantRegistry.js`, etc.), but not visually exercised in an actual browser. All the logic behind it (`TenantRegistry`, `tenantResolution`, `branding`, both view controllers) is fully unit tested. Please sanity-check brand switching and the logo/tagline rendering in a real browser using the launch instructions below.

### Web app launch instructions (unchanged from UOW-04)
```bash
# Option A — Python (no install required)
python3 -m http.server 8080
# then open http://localhost:8080/index.html

# Option B — Node (via npx, nothing added to package.json)
npx serve .
```
Opening `index.html` directly via `file://` will not work — browsers block `type="module"` script loads from that origin.

To test tenant resolution directly, open e.g. `http://localhost:8080/index.html?tenant=summit-auto` — the app should load already skinned as Summit Auto Group, and that choice should persist (via `localStorage`) on a plain reload without the query string. Use the "Dealer Brand" dropdown at the top of the Dealer Studio view to switch live between presets.

### Files added/modified
- `src/config/TenantRegistry.js` (new)
- `src/config/tenantResolution.js` (new)
- `src/config/tenantConfig.js` (modified — added `tagline`, `contact` fields)
- `src/ui/branding.js` (new)
- `src/ui/App.js` (modified — tenant registry wiring, brand switcher, logo/tagline rendering, per-tenant state caching)
- `src/ui/styles.css` (modified — logo fallback, tagline, brand-switcher styles)
- `src/core/index.js` (modified — exports `TenantRegistry` and tenant-resolution helpers)
- `tests/tenantResolution.test.js` (new)
- `tests/tenantRegistry.test.js` (new)
- `tests/ui.branding.test.js` (new)
- `tests/tenantConfig.test.js` (modified — `tagline`/`contact` coverage)
- `tests/index.test.js` (modified — asserts new exports)
- `.hydrate/CURRENT_UOW.md` (UOW-04 finalized, UOW-05 checkboxes updated)

### Test output
```
ℹ tests 93
ℹ suites 0
ℹ pass 93
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                        | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------------
ℹ  config/tenantConfig.js      | 100.00 |   100.00 |  100.00 |
ℹ  config/TenantRegistry.js    | 100.00 |   100.00 |  100.00 |
ℹ  config/tenantResolution.js  | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js               | 100.00 |   100.00 |  100.00 |
ℹ  index.js                    | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js            | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js           | 100.00 |   100.00 |  100.00 |
ℹ  services/HapticsService.js  |  93.75 |    80.00 |  100.00 | 14
ℹ  services/IngestService.js   | 100.00 |   100.00 |  100.00 |
ℹ  services/SearchService.js   |  98.08 |    85.96 |  100.00 | 23-24
ℹ  services/ShareService.js    |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js|  97.85 |    94.87 |  100.00 | 18-19
ℹ  ui/branding.js              | 100.00 |   100.00 |  100.00 |
ℹ  ui/BuyerSearchController.js | 100.00 |   100.00 |  100.00 |
ℹ  ui/DealerStudioController.js| 100.00 |    92.86 |  100.00 |
ℹ  ui/marketBadge.js           | 100.00 |   100.00 |  100.00 |
ℹ  ui/theme.js                 |  89.29 |   100.00 |   80.00 | 16-18
ℹ  ui/vehicleCard.js           | 100.00 |   100.00 |  100.00 |
ℹ  utils/geo.js                | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------------
ℹ all files                    |  98.47 |    94.04 |   98.68 |
```

## [UOW-05 (second unit under this id)] — Multi-Vendor Integration & Discovery Engine UI
- **Date:** 8/18/2026
- **Status:** Complete. All 5 tasks done, `npm test` passing 111/111. Overall coverage 98.40% lines / 93.36% branches / 97.83% funcs (quality gate: 80%).
- **⚠️ Roadmap note:** this unit of work was issued as "UOW-05," the same identifier already used by the prior, unrelated "White-Label Branding Engine & Dynamic Presets" unit (logged above). `.hydrate/CURRENT_UOW.md` now has two "UOW-05" sections. Executed exactly as specified; flagging the collision so the product owner can renumber going forward (this one is arguably "UOW-06").
- **Breaking-ish change:** `src/config/tenantResolution.js`'s URL query parameter was renamed from `?tenant=` to `?brand=`, per this unit's explicit spec (Task 5.1). All existing tests and usages were updated to match — `TENANT_STORAGE_KEY` (localStorage) is unchanged.

### Tasks completed
- **5.1:** Reused the existing `TenantRegistry` (`src/config/TenantRegistry.js`, built in the prior UOW-05) rather than re-implementing it, since it already manages exactly the preset shape asked for here (logoUrl, name, tagline, colors, contact). Renamed the URL query key that drives resolution from `tenant` to `brand` in `src/config/tenantResolution.js` (`TENANT_QUERY_PARAM = 'brand'`) so branding is now driven by `?brand=tenantId`, with the existing localStorage fallback/persistence left in place.
- **5.2:** `src/adapters/VendorAdapter.js` — `normalizeDealer(rawDealer)` and `normalizeVehicle(rawVehicle)` map heterogeneous raw vendor field names (`dealer_id`/`id`, `dealer_name`/`name`, `latitude`/`lat`, `asking_price`/`price`, `odometer`/`mileage`, `body_type`/`bodyStyle`, etc.) into real `Dealer`/`Vehicle` domain instances, tagged with the adapter's configured `tenantId` (constructor throws without one). `normalizeFeed(feed)` normalizes an entire `{ dealers, vehicles }` raw feed at once.
- **5.3:** `src/services/DiscoveryService.js` — `scanRadius({ origin, radiusMiles = 50, tenantId, onProgress })` simulates an async multi-stage scan over injected `vendorFeeds`, emitting ordered `onProgress` events through `DiscoveryStage.SCANNING → PARSING → CALCULATING → COMPLETE` (each stage fires twice: a "starting" event and a "found X" event with counts). Radius filtering uses the existing `haversineDistanceMiles` utility against each feed's dealer coordinates; parsing uses `VendorAdapter`; the calculating stage evaluates each discovered vehicle's live market position via the existing `TelemetryService.getMarketStats`/`evaluateMarketPosition`. Stage pacing is injectable (`delayFn`, `stageDelayMs`) so tests run instantly while the real UI gets a perceptible multi-second scan. Added a small, additive `registerDealer(dealer)` method to both `SearchService` and `TelemetryService` so dealers discovered at runtime become resolvable for distance filtering/sorting without reconstructing those services.
- **5.4:** `src/ui/App.js`: the header's logo/tagline rendering was already in place from the prior UOW-05 (`renderBrandLogo` + `renderHeader`) and needed no changes — verified still correct against this unit's requirement. Added a "Scan 50-mile Radius" button to the Buyer Search view; clicking it opens a modal overlay (`renderProgressModal`, appended to `document.body` so it survives the app's full re-renders) that live-updates its stage heading and message from `DiscoveryService`'s `onProgress` events via the new pure `discoveryStageLabel()` helper (`src/ui/discoveryProgress.js`). On completion, discovered dealers are registered into the tenant's `SearchService`/`TelemetryService` and discovered vehicles are ingested through the existing `IngestService.intake` (so they get tenant tagging, sequential IDs, and show up in both Buyer Search results and the Dealer Studio inventory list with live market badges), a haptic pulse fires, and the app re-renders. Three demo vendor feeds ship, one per tenant preset, each with a lot inside the 50-mile radius and (for the default tenant) one intentionally outside it to demonstrate radius filtering.
- **5.5:** New suites `tests/vendorAdapter.test.js` (7 tests), `tests/discoveryService.test.js` (7 tests, using an instant `delayFn` so async progress-state assertions run without real waiting), `tests/ui.discoveryProgress.test.js` (2 tests); `registerDealer` tests added to `tests/searchService.test.js` and `tests/telemetryService.test.js`; `tests/tenantResolution.test.js` and `tests/tenantRegistry.test.js` updated for the `?brand=` rename; `tests/index.test.js` extended for the new core exports (`DiscoveryService`, `DiscoveryStage`, `VendorAdapter`). `npm test` passing 111/111; coverage verified via `node --test --experimental-test-coverage`.

### Caveat (carried forward)
No browser-automation tool is available in this environment. The new Scan button, progress modal, and post-scan re-render were syntax-checked (`node --check`) and the updated static files were smoke-tested for delivery over a local HTTP server (200s), but not visually exercised in a real browser. All the logic behind them (`VendorAdapter`, `DiscoveryService`, `discoveryStageLabel`, the `registerDealer` additions) is fully unit tested. Please sanity-check the scan flow in a real browser using the launch instructions below.

### Web app launch instructions (updated: query parameter renamed)
```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```
or `npx serve .` (nothing added to `package.json`). `file://` still won't work for the same `type="module"` CORS reason as before.

Branding is now driven by `?brand=` (renamed from `?tenant=`): try `http://localhost:8080/index.html?brand=summit-auto`. In Buyer Search, click "Scan 50-mile Radius" to watch the progress modal move through Finding Local Lots → Parsing Inventory → Calculating Telemetry → Complete, then see newly discovered vendor vehicles appear in the results (and in Dealer Studio's inventory, with live market badges).

### Files added/modified
- `src/adapters/VendorAdapter.js` (new)
- `src/services/DiscoveryService.js` (new)
- `src/ui/discoveryProgress.js` (new)
- `src/config/tenantResolution.js` (modified — `?tenant=` → `?brand=`)
- `src/services/SearchService.js` (modified — added `registerDealer`)
- `src/services/TelemetryService.js` (modified — added `registerDealer`)
- `src/ui/App.js` (modified — vendor feed fixtures, Scan button, progress modal, discovery wiring)
- `src/ui/styles.css` (modified — `.modal-overlay`/`.modal` styles)
- `src/core/index.js` (modified — exports `DiscoveryService`, `DiscoveryStage`, `VendorAdapter`)
- `tests/vendorAdapter.test.js` (new)
- `tests/discoveryService.test.js` (new)
- `tests/ui.discoveryProgress.test.js` (new)
- `tests/searchService.test.js` (modified — `registerDealer` coverage)
- `tests/telemetryService.test.js` (modified — `registerDealer` coverage)
- `tests/tenantResolution.test.js` (modified — `?brand=` rename)
- `tests/tenantRegistry.test.js` (modified — `?brand=` rename)
- `tests/index.test.js` (modified — asserts new exports)
- `.hydrate/CURRENT_UOW.md` (second "UOW-05" section appended and checked off — see roadmap note above)

### Test output
```
ℹ tests 111
ℹ suites 0
ℹ pass 111
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                        | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------------
ℹ  adapters/VendorAdapter.js   | 100.00 |    96.15 |  100.00 |
ℹ  config/tenantConfig.js      | 100.00 |   100.00 |  100.00 |
ℹ  config/TenantRegistry.js    | 100.00 |   100.00 |  100.00 |
ℹ  config/tenantResolution.js  | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js               | 100.00 |   100.00 |  100.00 |
ℹ  index.js                    | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js            | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js           | 100.00 |   100.00 |  100.00 |
ℹ  services/DiscoveryService.js|  96.94 |    80.00 |   85.71 | 13-15
ℹ  services/HapticsService.js  |  93.75 |    80.00 |  100.00 | 14
ℹ  services/IngestService.js   | 100.00 |   100.00 |  100.00 |
ℹ  services/SearchService.js   |  98.15 |    86.21 |  100.00 | 27-28
ℹ  services/ShareService.js    |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js|  97.94 |    95.00 |  100.00 | 22-23
ℹ  ui/branding.js              | 100.00 |   100.00 |  100.00 |
ℹ  ui/BuyerSearchController.js | 100.00 |   100.00 |  100.00 |
ℹ  ui/DealerStudioController.js| 100.00 |    92.86 |  100.00 |
ℹ  ui/discoveryProgress.js     | 100.00 |   100.00 |  100.00 |
ℹ  ui/marketBadge.js           | 100.00 |   100.00 |  100.00 |
ℹ  ui/theme.js                 |  89.29 |   100.00 |   80.00 | 16-18
ℹ  ui/vehicleCard.js           | 100.00 |   100.00 |  100.00 |
ℹ  utils/geo.js                | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------------
ℹ all files                    |  98.40 |    93.36 |   97.83 |
```

## [UOW-06] — CarBoyZ Flagship Preset & Zip Code Seed Engine
- **Date:** 2026-08-19
- **Status:** Complete. All 4 tasks done, `npm test` passing 122/122. Overall coverage 98.59% lines / 93.52% branches / 97.89% funcs (quality gate: 80%).

### Tasks completed
- **6.1:** Rewrote `.hydrate/CURRENT_UOW.md` so the duplicate "UOW-05" labels from the prior two turns are merged into a single sequential `## Completed: UOW-05 — White-Label Branding Engine & Multi-Vendor Discovery` entry (Part A = branding/registry, Part B = vendor/discovery, sub-tasks renumbered 5.1–5.9 with no collisions), with a cleanup note explaining the merge. History now reads UOW-01 through UOW-05 sequentially, and this pass is UOW-06 with no numbering conflicts.
- **6.2:** `src/config/TenantRegistry.js` now exports `CARBOYZ_TENANT_ID` (`'carboyz'`) and `CARBOYZ_FLAGSHIP_PRESET`: name "CarBoyZ Motors", tagline "Raw Muscle, Local Trucks & Saturday Project Builds", dark-mode theme (`background: '#161311'` near-black, `text: '#F5EAE0'` warm cream, `primary: '#D97706'` deep amber, `secondary: '#B91C1C'` red — amber deliberately at the 600-shade rather than a lighter 500 so the white header/button text used throughout the UI stays legible against it), and no `logoUrl` (so the header falls back to initials).
  - Getting the initials fallback to read **"CB"** (not "CM", which the old word-splitting algorithm would have produced from "CarBoyZ **M**otors") required reworking `getBrandInitials` (`src/ui/branding.js`): it now scans the *whole trimmed name* for capital letters in order and pairs the first two found (falling back to the first word's first two characters if fewer than two capitals exist), rather than splitting on words and taking each word's first letter. This is a strict generalization — verified it reproduces every existing test's expected output (`"Carboyz Motors"` → `CM`, `"Summit Auto Group"` → `SA`, `"Harbor Motors"` → `HM`, single-word `"Carboyz"` → `CA`) while also correctly picking the embedded capital out of `"CarBoyZ Motors"` → `CB`.
- **6.3:** `src/utils/seedInventory.js` — `SEED_ZIP_CODE = '28451'`, `SEED_ANCHOR` (~34.35, -77.80, an approximate centroid for Rocky Point, NC since no live geocoding API is wired up). `DIRECT_INVENTORY` is exactly 6 vehicles (30% of 20) as three same-model pairs — Pontiac Trans Am, Jeep Wrangler, Chevrolet Corvette C3 — each pair priced ±1 dealer-standard-deviation apart so `TelemetryService` classifies one UNDERPRICED and one OVERPRICED per pair (verified in tests, not just eyeballed). `VENDOR_FEEDS` is 14 vehicles (70% of 20) across three simulated vendor lots — Jacksonville Truck Exchange (trucks/Bronco), Wilmington Classic Muscle (60s/70s muscle cars), Burgaw Project Cars (rougher, cheaper project builds) — all verified within the 50-mile Discovery radius of `SEED_ANCHOR` (11.5–34.7 mi away). `seedDirectInventory(ingestService)` runs the 6 direct vehicles through `IngestService.intake`.
- **6.4:** In `src/ui/App.js`, `carboyz` replaced the old generic `demo-tenant` preset as `TENANT_PRESETS[0]` (built from `CARBOYZ_FLAGSHIP_PRESET` + a single `carboyz-hq` dealer at `SEED_ANCHOR`), which makes it both the resolution default *and* directly reachable via `?brand=carboyz`. `VENDOR_FEEDS_BY_TENANT[CARBOYZ_TENANT_ID]` now points at `seedInventory.js`'s `VENDOR_FEEDS` for the "Scan 50-mile Radius" flow. `getTenantState()` calls `seedDirectInventory(ingestService)` the first time the `carboyz` tenant's state is lazily constructed — i.e., on initial boot (default tenant) or the moment `?brand=carboyz` resolves — so Dealer Studio's inventory list is pre-populated with the 6 direct vehicles (with live market badges) without any user action. Verified this end-to-end outside the DOM (tenant resolution → dealer → services → seeding) with a one-off Node script; output matched exactly (6 vehicles, correct prices).
  - New tests: `tests/seedInventory.test.js` (7 tests — 20-vehicle/30-70 split, dealer tagging, Trans Am/Wrangler/C3 presence, the ±1σ UNDERPRICED/OVERPRICED pairing verified through a real `TelemetryService`, tenantId tagging via `seedDirectInventory`, 50-mile radius verification via `haversineDistanceMiles`, and clean `VendorAdapter` normalization of every vendor vehicle). `tests/tenantRegistry.test.js` extended with 2 tests for `CARBOYZ_FLAGSHIP_PRESET`'s shape/colors and `?brand=carboyz` resolution. `tests/ui.branding.test.js` extended with 2 tests locking in the new initials algorithm. `tests/index.test.js` extended for the new core exports. `npm test` passing 122/122.

### Caveat (carried forward)
No browser-automation tool is available in this environment. The flagship-preset wiring and boot-time seeding were verified with a real (non-DOM) Node script exercising the actual resolution → seeding path, and `App.js` was syntax-checked and its updated files smoke-tested for static delivery (200s), but the dark amber/red theme and "CB" badge have not been visually confirmed in a real browser. Please open `?brand=carboyz` in a browser to sanity-check contrast and layout.

### Web app launch instructions (unchanged)
```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html?brand=carboyz
```
or `npx serve .`. `file://` still won't work (ES module CORS restriction).

### Files added/modified
- `src/utils/seedInventory.js` (new)
- `src/config/TenantRegistry.js` (modified — added `CARBOYZ_TENANT_ID`, `CARBOYZ_FLAGSHIP_PRESET`)
- `src/ui/branding.js` (modified — reworked `getBrandInitials` to scan for capitals)
- `src/ui/App.js` (modified — `carboyz` replaces `demo-tenant` as the flagship/default preset, wired to `seedInventory.js` for both direct inventory and vendor feeds)
- `tests/seedInventory.test.js` (new)
- `tests/tenantRegistry.test.js` (modified — flagship preset coverage)
- `tests/ui.branding.test.js` (modified — new initials-algorithm coverage)
- `tests/index.test.js` (modified — asserts new exports)
- `src/core/index.js` (modified — exports flagship preset + seed inventory symbols)
- `.hydrate/CURRENT_UOW.md` (UOW-05 duplicate labels merged/cleaned up, UOW-06 checkboxes updated)

### Test output
```
ℹ tests 122
ℹ suites 0
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage report
```
ℹ file                        | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------------------------
ℹ  adapters/VendorAdapter.js   | 100.00 |    96.15 |  100.00 |
ℹ  config/tenantConfig.js      | 100.00 |   100.00 |  100.00 |
ℹ  config/TenantRegistry.js    | 100.00 |   100.00 |  100.00 |
ℹ  config/tenantResolution.js  | 100.00 |   100.00 |  100.00 |
ℹ  core/index.js               | 100.00 |   100.00 |  100.00 |
ℹ  index.js                    | 100.00 |   100.00 |  100.00 |
ℹ  models/Dealer.js            | 100.00 |    90.00 |  100.00 |
ℹ  models/Vehicle.js           | 100.00 |   100.00 |  100.00 |
ℹ  services/DiscoveryService.js|  96.94 |    80.00 |   85.71 | 13-15
ℹ  services/HapticsService.js  |  93.75 |    80.00 |  100.00 | 14
ℹ  services/IngestService.js   | 100.00 |   100.00 |  100.00 |
ℹ  services/SearchService.js   |  98.15 |    86.21 |  100.00 | 27-28
ℹ  services/ShareService.js    |  88.24 |    80.00 |  100.00 | 14-15
ℹ  services/TelemetryService.js|  97.94 |    95.00 |  100.00 | 22-23
ℹ  ui/branding.js              | 100.00 |   100.00 |  100.00 |
ℹ  ui/BuyerSearchController.js | 100.00 |   100.00 |  100.00 |
ℹ  ui/DealerStudioController.js| 100.00 |    92.86 |  100.00 |
ℹ  ui/discoveryProgress.js     | 100.00 |   100.00 |  100.00 |
ℹ  ui/marketBadge.js           | 100.00 |   100.00 |  100.00 |
ℹ  ui/theme.js                 |  89.29 |   100.00 |   80.00 | 16-18
ℹ  ui/vehicleCard.js           | 100.00 |   100.00 |  100.00 |
ℹ  utils/geo.js                | 100.00 |   100.00 |  100.00 |
ℹ  utils/seedInventory.js      | 100.00 |   100.00 |  100.00 |
ℹ ----------------------------------------------------------------------------
ℹ all files                    |  98.59 |    93.52 |   97.89 |
```
