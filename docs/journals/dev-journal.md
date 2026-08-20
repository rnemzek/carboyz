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

## [UOW-07] — Structured LLM Query Parsing & Local Discovery Sync
- **Date:** 2026-08-20
- **Status:** Complete. All 5 tasks done, `npm test` passing 167/167. `chatFilterAdapter.js` (the only new/modified business-logic module) at 99.20% line / 87.07% branch / 95.24% funcs coverage (quality gate: 80%).

### Tasks completed
- **7.1:** Added `parseChatQueryWithLLM(text, options)` to `src/adapters/chatFilterAdapter.js`, calling the Anthropic Messages API (`options.apiKey` → `process.env.ANTHROPIC_API_KEY` → `window.CARBOYZ_ANTHROPIC_API_KEY`, checked in that order) with a system prompt instructing it to return ONLY a JSON object matching `{maxPrice?, maxMileage?, minYear?, bodyStyle?: 'SUV'|'Sedan'|'Truck'|'Coupe'|'Hatchback', conditionPreference?: string[], intentSummary}`. The response is extracted/validated by `sanitizeLlmQuery` (numeric bounds checked, `bodyStyle` whitelisted then lowercased to match the internal representation, non-string array entries dropped) and the whole call is wrapped so any failure — missing key, unavailable `fetch`, network error, non-2xx, unparseable JSON, 6s timeout via `AbortController` — resolves to `null` rather than throwing. `apiKey`/`fetchImpl`/`timeoutMs`/`model` are all injectable via `options` for testability.
- **7.2:** Added `resolveChatQuery(text, options)`: tries `parseChatQueryWithLLM` first, and on `null` falls back to the existing regex `parseChatQuery`, synthesizing an `intentSummary` from whatever fields the regex parser recognized (or the raw input text if it recognized nothing) so the drawer always has a summary line to render regardless of which path served the query.
- **7.3:** Wired `resolveChatQuery` into `src/ui/MapView.js`'s chat bar `onSubmit` (now async). The candidate pool passed to `rankTopMatches` is now filtered down to vehicles whose `dealerId` is in `nearbyDealers` (the existing 25-mile/40km H3 nearby-cell set computed for user-location centering) instead of the full unfiltered inventory — closing a gap where the chat bar had been searching the entire tenant's inventory rather than the local pool the map itself was already scoping to. `rankTopMatches` (pre-existing) still runs `evaluateVehicleMarketPosition` → `evaluateMarketComps()` per candidate and returns the best-value Top 5.
- **7.4:** `ChatDiscovery.js`'s `showResults(matches, intentSummary)` now renders the resolved `intentSummary` as a line above the card list (`.chat-discovery__results-summary`, styled/hidden to match the existing empty-state pattern), and the submit handler disables the Search button for the duration of the now-async `onSubmit` call. Map/card-click sync (`focusDealer` → `map.flyTo` + `showDrawer({ highlightVehicleId })`) was already implemented from a prior pass and needed no changes.
- **7.4b:** Extended `filterVehiclesByQuery` to filter on `conditionPreference` (case-insensitive match against `deriveVehicleCondition()`, imported from `ui/vehicleCard.js`) so the field the LLM/regex parsers extract is actually consumed by the filtering pipeline, not just carried through unused.
- **7.5:** New tests in `tests/chatFilterAdapter.test.js`: `parseChatQueryWithLLM` (no-API-key short-circuit never calls `fetch`, network failure, non-ok response, unparseable response text, valid structured parse, invalid `bodyStyle` dropped while the rest of the payload survives), `resolveChatQuery` (prefers a successful LLM parse; falls back to the regex parser + synthesized summary when no key is configured; falls back to raw text when nothing parses), and `filterVehiclesByQuery` `conditionPreference` filtering. `npm test` → 167/167 passing.
  - Ran a headless Playwright pass (`npx serve .` on :8080; no `chromium-cli` in this environment, so used Playwright's bundled Chromium directly per the `run` skill's documented fallback) against the live app: navigated to `?brand=carboyz` (seeded CarBoyZ inventory), switched to the Map tab, submitted "SUV under $35k" in the chat bar → results drawer opened with 2 cards (both seeded Jeep Wranglers), correct verdict badges (`Fair Market`, `Overpriced`) and the intent-summary line ("Looking for a suv, under $35,000."), clicked the first card → map flew to CarBoyZ Motors HQ and the dealer drawer opened with that exact vehicle card highlighted. Zero browser console errors throughout. (Needed to grant a mocked `geolocation` permission at the seed anchor, ~34.35/-77.8 — the app's hardcoded `FALLBACK_LOCATION` used when geolocation is denied/unavailable is in Orange County, CA, ~2,500 miles from the seeded CarBoyZ HQ, so an un-geolocated session now correctly returns zero *local* matches under the new 25-mile filter from Task 7.3. That's a legitimate consequence of "local" actually meaning local now, not a bug, but worth knowing if a future pass wants a friendlier no-location default.)

### Files added/modified
- `src/adapters/chatFilterAdapter.js` (modified — LLM parse handler, `resolveChatQuery`, `conditionPreference` filter)
- `src/ui/MapView.js` (modified — async `onSubmit` via `resolveChatQuery`, 25-mile-filtered candidate pool)
- `src/ui/ChatDiscovery.js` (modified — renders `intentSummary`, async-aware submit button)
- `src/ui/styles.css` (modified — `.chat-discovery__results-summary`)
- `tests/chatFilterAdapter.test.js` (modified — LLM handler, `resolveChatQuery`, `conditionPreference` coverage)
- `ROADMAP.md`, `.hydrate/CURRENT_UOW.md` (UOW-07 checked off / logged)

### Test output
```
ℹ tests 167
ℹ suites 0
ℹ pass 167
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## [UOW-08] — Location Overlay: GPS Locate & ZIP/City Search
- **Date:** 2026-08-20
- **Status:** Complete. All 7 tasks done, `npm test` passing 175/175. `locationAdapter.js` (the only new business-logic module) at 100.00% line / 96.55% branch coverage (quality gate: 80%).

### Tasks completed
- **8.1:** Added `src/adapters/locationAdapter.js`: an offline, `GeocoderResolver`-shaped adapter with a static ZIP/city → `{ lat, lng, label }` gazetteer (Leland NC 28451 plus the cities already referenced by `App.js`'s `TENANT_PRESETS`/`seedInventory.js`). `resolveLocationQuery(text)` matches a 5-digit ZIP or a city/`"City, ST"` string (case-insensitive) to a known point, `null` otherwise. `describeCoordinates(lat, lng)` captions a coordinate with the nearest known label — exact label when within 1 mile, `"Near {label}"` otherwise — via `haversineDistanceMiles` (`src/utils/geo.js`). No network calls, so resolution stays deterministic for tests and offline demo use.
- **8.2:** Changed `FALLBACK_LOCATION` in `src/ui/MapView.js` from Orange County, CA (`{ lat: 33.6846, lng: -117.8265 }`) to Leland, NC (`{ lat: 34.2388, lng: -78.0145 }`) — the no-geolocation default only. `SEED_ANCHOR` and the `TENANT_PRESETS` dealer coordinates were left untouched (separate, seeded domain data).
- **8.3:** Added a top Location Overlay bar (`.map-location-bar`, `📍 {label} ({25} mi)`) to `MapView.js`. Tapping it opens a new search modal (`buildLocationModal`, reusing the existing `.modal-overlay`/`.modal` pattern) with an "Enter ZIP Code or City..." input. On submit, `resolveLocationQuery` resolves the point, `applyUserLocation` (extended to accept an optional display label) calls `map.flyTo`, recomputes `nearbyDealers` via the existing `filterDealersNearby`/spatial-core `getNearbyCells`, and re-renders the layer. Unrecognized input surfaces an inline `.location-modal__error` message instead of closing the modal.
- **8.4:** Added a floating `.map-locate-btn` (🎯, 48px, bottom-right of the map canvas, above the chat bar). Tap calls `navigator.geolocation.getCurrentPosition` directly, shows a disabled "⏳" busy state, and on success calls `applyUserLocation` (label derived via `describeCoordinates`). On missing `navigator.geolocation` or a denied/timed-out request, the location bar briefly shows an inline error message (auto-reverts after 3s) rather than crashing or silently doing nothing.
- **8.5:** Styled `.map-location-bar`, `.map-locate-btn`, and `.location-modal` in `src/ui/styles.css`, matching the existing mobile-first `--spacing`/`--radius` tokens and z-index stacking. Also added `.modal-overlay[hidden] { display: none; }` — a real bug caught by the Playwright pass (see below): the location modal toggles visibility via the `hidden` attribute while staying in the DOM (unlike `renderProgressModal`, which is always removed/appended), and the pre-existing `.modal-overlay { display: flex }` author rule silently overrode the browser's default `[hidden]` behavior, leaving the modal invisible-but-still-intercepting-clicks. `.map-drawer` already had this exact override for the same reason; `.modal-overlay` needed the same fix.
- **8.6:** New `tests/locationAdapter.test.js`: ZIP match, city-name match (case/whitespace-insensitive), `"City, ST"` match, unrecognized ZIP/city → `null`, empty/non-string input → `null`, `describeCoordinates` exact vs. `"Near"` captioning, and non-numeric-input fallback.
- **8.7:** `npm test` → 175/175 passing (up from 167; +8 new tests), `locationAdapter.js` 100.00%/96.55%/100.00% line/branch/func coverage. Ran a headless Playwright pass (`npx serve .` on :8080; no `chromium-cli` in this environment, so drove Playwright's bundled Chromium directly via a scratch script, matching the UOW-07 fallback) against the live app with a mocked `geolocation` grant: navigated to `?brand=carboyz` → Map tab → confirmed the overlay read "📍 Leland, NC (25 mi)" by default → clicked 🎯 with geolocation mocked to a point near Wilmington, NC → map recentered and the overlay updated to "📍 Near Wilmington, NC (25 mi)" → opened the search modal, submitted "Denver, CO" → modal closed, map flew to Denver, overlay updated to "📍 Denver, CO (25 mi)" → reopened the modal, submitted "Nowhereville, ZZ" → inline error shown, modal stayed open. Zero browser console errors across all steps. This pass is what caught the `.modal-overlay[hidden]` bug fixed in 8.5 — the locate button was unclickable (blocked by the still-flexed, hidden-in-name-only modal) until the CSS fix landed.

### Files added/modified
- `src/adapters/locationAdapter.js` (new)
- `src/ui/MapView.js` (modified — location bar, locate button, search modal, `FALLBACK_LOCATION`, `applyUserLocation` label param)
- `src/ui/styles.css` (modified — `.map-location-bar`, `.map-locate-btn`, `.location-modal*`, `.modal-overlay[hidden]` fix)
- `tests/locationAdapter.test.js` (new)
- `ROADMAP.md`, `.hydrate/CURRENT_UOW.md` (UOW-08 checked off / logged)

### Test output
```
ℹ tests 175
ℹ suites 0
ℹ pass 175
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## [Spatial Core / Domain Overlay Contract Refactor]
- **Date:** 2026-08-20
- **Status:** Complete. Cross-repo refactor across `@nemzilla/spatial-core` and `carboyz`. `spatial-core` tests: 24/24 passing. `carboyz` tests: 180/180 passing.
- **Scope:** Establish a clean Generic Spatial Core + Domain Overlay contract — spatial-core owns map mechanics (pan/zoom/flyTo/H3/geocoding) and marker lifecycle; the domain overlay owns pin appearance and node click/hover behavior. Clean break (no back-compat shim); carboyz is spatial-core's only consumer.

### Summary
- **spatial-core** (`e989da1`): `map.ts` replaced the fixed circle-paint-layer with a pluggable `OverlayConfig` (`renderMarker`, `onNodeClick` with `stopPropagation`, `onNodeHover`/`onNodeLeave`, `onMapBackgroundClick`) driving real DOM `Marker` instances (`MarkerClass` injected by the caller, e.g. `maplibregl.Marker`); the H3 hex overlay is untouched. Added `places.ts` (`GooglePlacesAdapter`, implementing the existing `IngestionAdapter` interface — Field-Masked `searchNearby`, injectable `apiKey`/`fetchImpl`, graceful no-key short-circuit) and `spatialCellIndex.ts` (`SpatialCellIndex`, an H3-keyed cache) for a "look far" Places gap-fill capability. Library-only this pass — no carboyz UI trigger wired in, per explicit scope confirmation. Added 24 new tests across 3 new test files (`map.test.ts`, `places.test.ts`, `spatialCellIndex.test.ts`); since this stack has no jsdom anywhere, DOM stand-ins use Node's native `EventTarget`/`Event` globals rather than a real `document`.
- **carboyz** (`1d01ebc`): `carboyzAdapter.js` gained `buildDartPinSvgMarkup`/`buildDartPinElement` (a custom dealership "dart" pin, SVG generation kept as a pure/testable function separate from the DOM-touching wrapper, matching the existing `vehicleCard.js` view-model convention). `MapView.js` migrated to the new `overlay`/`MarkerClass` shape — `onNodeClick` opens the existing inventory drawer, `onNodeHover`/`onNodeLeave` drive the synopsis popup, `onMapBackgroundClick` closes the drawer. `seedInventory.js`/`App.js` seed two new default local dealer nodes — Leland Motors and Wilmington Auto Plaza (Leland/Wilmington NC) — alongside CarBoyZ Motors HQ, kept in a separate `LOCAL_DEALERS`/`seedLocalDealers` export so the existing fixed 30/70 direct/vendor seed-inventory ratio test stays intact.
- **Verification:** `npm test` green in both repos (spatial-core's `pretest` rebuilds `dist/`, which carboyz's `file:../spatial-core` dependency resolves against). No Playwright suite exists in either repo's `package.json` — ran an ad hoc headless Chromium script (via a locally cached Playwright install, not a project dependency) against the live app instead: 3 dart pins render (HQ + both new local dealers), hover shows the synopsis popup, pin click opens the drawer with the correct title, map-background click closes it, zero console errors.

### Files added/modified
- spatial-core: `src/map.ts`, `src/index.ts`, `tsconfig.json` (modified); `src/places.ts`, `src/spatialCellIndex.ts`, `tests/map.test.ts`, `tests/places.test.ts`, `tests/spatialCellIndex.test.ts` (new)
- carboyz: `src/adapters/carboyzAdapter.js`, `src/ui/MapView.js`, `src/ui/App.js`, `src/ui/styles.css`, `src/utils/seedInventory.js`, `tests/carboyzAdapter.test.js`, `tests/seedInventory.test.js` (modified)

### Test output
```
spatial-core: 24 pass / 0 fail
carboyz:      180 pass / 0 fail
```
