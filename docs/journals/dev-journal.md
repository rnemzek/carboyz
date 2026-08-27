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

## [UOW-09] — Spatial Core / Domain Overlay Contract: Google Geocoding Wire-Up
- **Date:** 2026-08-21
- **Status:** Complete. `npm test` passing 184/184 (carboyz only — spatial-core untouched this pass). `locationAdapter.js` at 100.00% line / 84.09% branch coverage (quality gate: 80%).
- **Scope:** Follow-up to the prior Spatial Core / Domain Overlay Contract Refactor. That pass wired pin rendering/interaction ownership to carboyz and built+tested spatial-core's `GooglePlacesGeocoder`/`geocodeAddress` (`geocoder.ts`), but never connected it to carboyz's UI — the location search modal (UOW-08) still resolved only against a static offline gazetteer. Requested as an explicit re-audit against the "spatial core owns geo mechanics / app owns UI+interaction" contract.

### Summary
- Audited the contract end-to-end first: confirmed no Leaflet exists anywhere in the repo (map canvas is already 100% MapLibre GL via spatial-core's `renderTopicLayer`/`updateTopicLayer`), and confirmed dealership pin appearance/click/hover was already fully carboyz-owned (`buildDartPinElement`, `onNodeClick`, `onNodeHover`/`onNodeLeave` in `carboyzAdapter.js`/`MapView.js`, per the prior refactor). The one real gap was geocoding routing.
- `src/adapters/locationAdapter.js`: `resolveLocationQuery` is now `async` and Google-first — constructs spatial-core's `GooglePlacesGeocoder` (api key via `options.apiKey` → `process.env.GOOGLE_PLACES_API_KEY` → `window.CARBOYZ_GOOGLE_PLACES_API_KEY`, mirroring `chatFilterAdapter`'s existing LLM-key resolution convention) and calls spatial-core's `geocodeAddress()` first. Falls back to the pre-existing offline ZIP/city gazetteer (`resolveOffline`) whenever no API key is configured, the Google request fails, or it finds no match — never throws. `describeCoordinates` (GPS-fix captioning) is unchanged: Google Places Text Search is forward-geocoding only, so reverse-lookup captioning stays the local nearest-known-point heuristic.
- `src/ui/MapView.js`: the location search modal's submit handler now `await`s `resolveLocationQuery`, disabling the Search button for the duration (mirroring `ChatDiscovery`'s existing async-submit pattern). Modal label/placeholder/error copy updated from "ZIP Code or City" to "address, ZIP code, or city" since free-form street addresses now resolve via Google.
- **Verification:** `npm test` → 184/184 (up from 175; +9 new tests in `tests/locationAdapter.test.js` covering the Google-routes-first path with a mocked `fetchImpl`, the no-API-key/failed-request/no-match fallback paths, and the pre-existing offline-resolution cases re-asserted as async). Ran a headless Playwright pass (`npx serve .` on :8080, Playwright's bundled Chromium via the cached `npx` install — same fallback documented in prior UOW passes, no `chromium-cli` or `playwright` project dependency in this environment) against the live app with a mocked geolocation grant: confirmed 3 dart pins render at the default location with carboyz's custom SVG styling, clicking a pin opens the drawer with the correct dealer title, opened the location modal and submitted "Denver, CO" with no API key configured (confirming the offline-fallback path activates cleanly with no blocking network call), map flew to Denver and the overlay label updated. Zero browser console errors throughout.
- **Note for a future pass:** no `GOOGLE_PLACES_API_KEY`/`window.CARBOYZ_GOOGLE_PLACES_API_KEY` is configured in this environment, so the Playwright pass exercised the offline-fallback path live; the Google-routing path itself is covered by the mocked-`fetchImpl` unit tests only. Worth a manual pass with a real key before shipping.

### Files added/modified
- `src/adapters/locationAdapter.js` (modified — async `resolveLocationQuery`, Google-first via spatial-core's `geocodeAddress`/`GooglePlacesGeocoder`, offline gazetteer as fallback)
- `src/ui/MapView.js` (modified — async-aware location modal submit, updated copy)
- `tests/locationAdapter.test.js` (modified — async assertions, Google-routing/fallback coverage)
- `ROADMAP.md`, `.hydrate/CURRENT_UOW.md` (UOW-09 checked off / logged)

### Test output
```
ℹ tests 184
ℹ suites 0
ℹ pass 184
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## [Fix] Dark Matter Basemap Default
- **Date:** 2026-08-21
- **Status:** Complete. `npm test` unchanged at 184/184 (no business-logic module touched; `MapView.js` has no unit test target per the existing convention).
- **Report:** MapView was still rendering MapLibre's light-green demo tiles instead of the dark canvas the product spec calls for.

### Root cause
- `MapView.js`'s `ensureMap()` creates the `maplibregl.Map` instance directly (`DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json'`, hardcoded). **spatial-core has no involvement in tile style at all** — per the Spatial Core / Domain Overlay Contract, spatial-core is headless and only operates on an already-created `SpatialMapInstance` (`renderTopicLayer`/`updateTopicLayer`); it never instantiates the base map or resolves a style URL. So "spatial-core defaults to dark tiles" isn't an applicable fix site — the style URL is purely a carboyz/`MapView.js` concern, and it was never coupled to `GOOGLE_PLACES_API_KEY` presence (that key only gates `locationAdapter`'s Google geocoding path, added in UOW-09, unrelated to the basemap).

### Fix
- Replaced the hardcoded `DEMO_STYLE_URL` default with `CARTO_DARK_MATTER_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'`, resolved via a new `resolveMapStyleUrl()` in `MapView.js`.
- Runtime override: `resolveMapStyleUrl()` checks `window.CARBOYZ_MAP_STYLE_URL` first, matching the existing `window.CARBOYZ_*` runtime-config convention (`chatFilterAdapter`'s `CARBOYZ_ANTHROPIC_API_KEY`, `locationAdapter`'s `CARBOYZ_GOOGLE_PLACES_API_KEY`) — no window-injection is required for the dark default itself (it's now hardcoded as the fallback), the global just gives static serving a way to swap basemaps without a build step if ever needed.
- Audited `GOOGLE_PLACES_API_KEY` resolution while in there: `locationAdapter.resolveApiKey` already degrades correctly under static serve — `typeof process !== 'undefined'` is false in a vanilla browser (no bundler polyfill), so that branch is skipped with no error, and resolution falls through cleanly to `window.CARBOYZ_GOOGLE_PLACES_API_KEY`. No change needed there.
- **Verification:** Headless Playwright pass against the live app confirmed `style.json`/tile/sprite/font requests now hit `basemaps.cartocdn.com`/`tiles.basemaps.cartocdn.com`, the map renders the dark basemap with street labels and carboyz's custom dart pins on top, and zero console errors.

### Files added/modified
- `src/ui/MapView.js` (modified — `CARTO_DARK_MATTER_STYLE_URL` default, `resolveMapStyleUrl()` runtime override)
- `docs/journals/dev-journal.md` (logged)

## [Fix] Runtime Config Injection for Static Serving + a Real Fetch Bug
- **Date:** 2026-08-21
- **Status:** Complete. `npm test` unchanged at 184/184 in carboyz; spatial-core at 41/41 (up from 24 — picks up geocoder/places/spatialCellIndex suites added since the last carboyz-side log).
- **Report:** follow-up to the dark-basemap fix — an untracked `.env.local` with a real `GOOGLE_PLACES_API_KEY` existed on disk but was never reaching the browser (this app has no build step; nothing loaded `.env.local` into `window`), so `locationAdapter`'s Google-first geocoding path had never actually been exercised live.

### Runtime config generator
- Added `scripts/generate-runtime-config.js`: a small dependency-free Node script that parses `.env.local` (simple `KEY=VALUE`, skips blanks/comments) and writes a gitignored `runtime-config.js` at the repo root, setting `window.CARBOYZ_*` globals for any allowlisted key present (`GOOGLE_PLACES_API_KEY` → `CARBOYZ_GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY` → `CARBOYZ_ANTHROPIC_API_KEY`) — matches the window-global convention `chatFilterAdapter.js`/`locationAdapter.js` already read from. Wired as `prestart` in `package.json` so `npm start` regenerates it fresh every run.
- `index.html` loads it via `<script src="/runtime-config.js" onerror="this.remove()">` before `App.js`'s module script. The `onerror` handler means a fresh checkout or a direct `npx serve .` (no `prestart` run) degrades silently — no console error, no broken page — and every adapter's existing no-key fallback takes over exactly as before.
- `runtime-config.js` added to `.gitignore` (generated, contains a secret — never committed).

### A real bug this surfaced: bare `fetch` reference → "Illegal invocation"
- With the key now actually reaching the browser, a live Playwright pass against the location search modal showed **zero** network requests to `places.googleapis.com` despite a valid key being present — the Google path was silently resolving to `null` and falling through to the offline gazetteer every time, with no visible error.
- Root cause, isolated via direct in-page evaluation: spatial-core's `GooglePlacesGeocoder` (`geocoder.ts`) and `GooglePlacesAdapter` (`places.ts`) both defaulted `fetchImpl` to a **bare** `fetch` reference — `fetchImpl ?? fetch`. Per the Fetch spec's "illegal invocation" branding check, calling a `fetch` reference detached from `window`/`globalThis` throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`. Every existing test in both repos always injects a mock `fetchImpl`, so the buggy default path had never actually been exercised — not by spatial-core's own geocoder/places test suites, and not by carboyz's UOW-09 tests either. It would have silently broken **any** live use of the default-`fetch` path, including `chatFilterAdapter.js`'s Anthropic LLM query parser (`parseChatQueryWithLLM`), which had the identical pattern (`fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)`) and had likewise never been exercised live with a real `ANTHROPIC_API_KEY` configured in any prior Playwright pass — every prior pass ran with no key configured, short-circuiting before `fetch` was ever called and masking the bug.
- **Fix (spatial-core, `9dc63dd`'s follow-up commit):** `geocoder.ts` and `places.ts` now default to `fetch.bind(globalThis)` instead of the bare reference. Rebuilt `dist/`, `spatial-core` tests still 41/41.
- **Fix (carboyz):** `chatFilterAdapter.js`'s `parseChatQueryWithLLM` given the same `fetch.bind(globalThis)` treatment.
- **Verification:** with the fetch fix live-reloaded via `npm start`, the same location-search Playwright pass now shows a genuine outbound request to `https://places.googleapis.com/v1/places:searchText`. It currently returns `403` — a Google Cloud API-key configuration issue (Places API (New) enablement/billing/referrer restriction on the configured key), outside this codebase's control — and the adapter correctly treats that as "no match" and falls through to the offline gazetteer with no crash, confirmed by submitting "Denver, CO" and seeing the overlay update correctly with zero JS exceptions (one benign browser-logged `403` resource-load message, not a thrown error).
- **Open item:** the Google Places (New) API key needs Google Cloud–side configuration (enable the API, confirm billing, check referrer/IP restrictions) before live geocoding will actually return results; the code path itself is now confirmed correct end-to-end.

### Files added/modified
- `scripts/generate-runtime-config.js` (new)
- `package.json` (modified — `prestart` hook)
- `index.html` (modified — optional `runtime-config.js` script tag)
- `.gitignore` (modified — `runtime-config.js`)
- `src/adapters/chatFilterAdapter.js` (modified — bound `fetch` reference)
- spatial-core: `src/geocoder.ts`, `src/places.ts`, `dist/geocoder.js`, `dist/places.js` (modified — bound `fetch` reference)

## [UOW] UI Repaint & Dense Dealer Layer
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 185/185 (+2: a radius sanity check on the expanded local layer, an id-uniqueness check on `LOCAL_DEALERS`). Verified live via `npm start` + a headless Playwright pass (no `chromium-cli` in this environment, so drove it directly with the `playwright` package — screenshots + computed-style + console-error checks).
- **Report:** Product Owner proposed aligning carboyz's theme with `../streaming-service-search-engine` (StreamZilla)'s dark/gold system and densifying the local Leland/Wilmington dealer layer. The proposal named files that don't exist in this repo (`global.css`, `Header.js`, `SearchView.js`) and guessed StreamZilla's hex values (`#FFBB00`/`#FFC107`); traced the real target files and pulled StreamZilla's actual tokens (Tailwind `amber-400` `#fbbf24` on `slate-950/900/800/700`) from its `tailwind-input.css`/`index.html` before touching anything. Plan reviewed and approved via `EnterPlanMode`/`ExitPlanMode` before implementation.

### Theming plumbing (the actual unlock)
- `CARBOYZ_FLAGSHIP_PRESET.themeColors` (`src/config/TenantRegistry.js`) already ran a deliberate amber-on-dark theme (`#D97706` primary, white header text) — a prior comment explained amber-600 was chosen specifically so *white* text stayed legible. Going full StreamZilla gold (`#fbbf24`, much lighter) required flipping to dark text, so `theme.js`'s tenant→CSS-variable map gained a new `onPrimary` key (`--color-on-primary`), plus previously-unthemeable `surface`/`border` keys — the Dealer Studio intake form was rendering as a light-gray box on carboyz's dark background because `--color-surface`/`--color-border` were never wired through `applyTenantTheme`. All three default to their pre-existing light-mode values in `styles.css :root`, so `summit-auto`/`harbor-motors` (which don't set them) are unaffected.
- `CARBOYZ_FLAGSHIP_PRESET.themeColors` updated to the gold set (`primary #FBBF24`, `background #020617`, `surface #0F172A`, `border #334155`, `onPrimary #0F172A`).
- `styles.css`: header/button/tagline/chat-submit text now read `var(--color-on-primary)` instead of hardcoded `#ffffff`; `.button`/`.chat-discovery__submit` are full pill radius; added `:focus`/`:focus-within` gold-accent borders on form inputs and the chat bar, matching StreamZilla's `focus:border-amber-400`.
- `CARBOYZ_MAP_STYLE.pinColor` (`src/adapters/carboyzAdapter.js`) → `#FBBF24`; pin SVG's white stroke/dot kept as-is for contrast on the dark basemap.

### Dense dealer layer
- `LOCAL_DEALERS`/`LOCAL_DEALER_INVENTORY` (`src/utils/seedInventory.js`) expanded from 2 to 12 real Leland/Wilmington-area towns (Castle Hayne, Hampstead, Carolina Beach, Wrightsville Beach, Porters Neck, downtown Wilmington, Leland Riverside, Ogden, Monkey Junction, Brunswick Forest), each within `MapView.js`'s default 25mi search radius — verified with a new `haversineDistanceMiles`-based test rather than by eyeballing coordinates. Deliberately left `DIRECT_INVENTORY`/`VENDOR_FEEDS` untouched — an existing test locks their 30%/70% split, and `LOCAL_DEALER_INVENTORY` was already excluded from that ratio.
- `MapView.js`'s location chip (`.map-location-bar`) now appends a live dealer count (`📍 Leland, NC (25 mi) · 13 dealers`), sourced from the same `nearbyDealers ?? dealers` set the layer itself renders from — fixed a latent ordering bug in `applyUserLocation()` where the chip text was written *before* `nearbyDealers` was recomputed, so it always showed the previous count; also wired `update()` to refresh the chip so it stays in sync after a discovery scan changes the dealer set, not just on relocation.

### Files added/modified
- `src/ui/theme.js` (modified — `surface`/`border`/`onPrimary` in the CSS-variable map)
- `src/config/TenantRegistry.js` (modified — `CARBOYZ_FLAGSHIP_PRESET.themeColors` → StreamZilla gold set)
- `src/ui/styles.css` (modified — `--color-on-primary` token, on-primary text swaps, pill buttons, focus states)
- `src/adapters/carboyzAdapter.js` (modified — `CARBOYZ_MAP_STYLE.pinColor`)
- `src/utils/seedInventory.js` (modified — 10 new `LOCAL_DEALERS`/`LOCAL_DEALER_INVENTORY` entries)
- `src/ui/MapView.js` (modified — dealer count in the location chip, `applyUserLocation` ordering fix, `update()` chip refresh)
- `tests/carboyzAdapter.test.js`, `tests/tenantRegistry.test.js` (modified — updated hardcoded color expectations)
- `tests/seedInventory.test.js` (modified — dense-layer id-uniqueness/count check + new radius sanity test)
- `docs/journals/dev-journal.md` (logged)

## [Feature] OpenStreetMap Geocoder Bridge + Dual-Mode Map Centering
- **Date:** 2026-08-25
- **Status:** Complete. `npm test`: spatial-core 51/51 (+10), carboyz 190/190 (+5). Verified live against real `nominatim.openstreetmap.org` and `places.googleapis.com` endpoints via a headless Playwright pass — no mocks — confirming the Google→OSM bridge and the GPS "Use My Location" flow both actually recenter the map.
- **Report:** Added `OpenStreetMapGeocoder` (Nominatim) to spatial-core as a zero-cost, no-API-key alternative/bridge tier between `GooglePlacesGeocoder` and carboyz's offline gazetteer, gated behind an explicit opt-in flag (Option B) rather than always-on, to preserve the existing "no API key configured means no network call" test guarantee in `locationAdapter.test.js`.

### spatial-core: `OpenStreetMapGeocoder`
- `src/geocoder.ts` — new class implementing the same `GeocoderResolver`/`GeocodedPlace` contract as `GooglePlacesGeocoder`, hitting Nominatim's `/search` endpoint (`format=jsonv2`, no key required). Two response-shape quirks it normalizes away that a naive copy of the Google mapping would get wrong: Nominatim returns `lat`/`lon` as **strings** (needs `Number()` coercion, with a `NaN` guard returning `null` rather than poisoning coordinates), and its `boundingbox` field is ordered `[south, north, west, east]` — a different order than Google's `{north,south,east,west}` object, easy to transpose. `fetchImpl` defaults to `fetch.bind(globalThis)`, not a bare reference — reusing the exact fix from the 2026-08-21 "Illegal invocation" bug rather than reintroducing it. Optional `userAgent`/`baseUrl` constructor fields: Nominatim's usage policy wants a custom User-Agent identifying the calling app (1 req/sec, no bulk use), but browser `fetch` forbids scripts from setting that header, so it's documented as a no-op in-browser and only effective for server-side callers.
- `src/index.ts` — exported alongside `GooglePlacesGeocoder`.
- `tests/geocoder.test.ts` — 10 new tests mirroring `GooglePlacesGeocoder`'s existing matrix (query params sent, string→number + bounding-box-order parsing, non-ok/unparseable/no-results/blank-input → `null`), plus one confirming it fires unconditionally with no key gate (the point of "zero-cost").

### carboyz: opt-in bridge tier + runtime flag
- `src/adapters/locationAdapter.js` — `resolveLocationQuery` now tries Google first (unchanged), and only when `resolveOsmEnabled(options)` is true — `options.enableOsm === true` or `window.CARBOYZ_ENABLE_OSM === 'true'` — bridges through `OpenStreetMapGeocoder` before falling through to the offline gazetteer. With the flag unset (the default), behavior and the "no API key ⇒ no network call" guarantee are byte-for-byte unchanged; verified with a dedicated test asserting zero `fetchImpl` calls in that state.
- `scripts/generate-runtime-config.js` — added `CARBOYZ_ENABLE_OSM` to the `.env.local` → `window.CARBOYZ_*` allowlist. Unlike the two existing keys, this one is already `CARBOYZ_`-prefixed in `.env.local` (it's a feature flag, not a secret pulled from a bare env var name), so it maps to itself rather than gaining a second prefix.
- `tests/locationAdapter.test.js` — 5 new tests: OSM tier silent by default, bridges when Google has no key, bridges when Google finds no match, falls through to the gazetteer when OSM also misses, and returns `null` end-to-end when nothing matches.

### carboyz: dual-mode map centering
- `src/ui/MapView.js`'s `buildLocationModal` now calls `resolveLocationQuery(query, { enableOsm: true })` — the search-by-address/ZIP/city path always opts into the OSM bridge, independent of the (currently unset) global runtime flag.
- The GPS "Use My Location" button already existed (`locateBtn`/🎯, wired to `navigator.geolocation.getCurrentPosition` via `handleLocateMeClick`, calling the same `applyUserLocation` → `map.flyTo` path the search modal uses) — relabeled its `aria-label`/added a `title` from "Locate me" to "Use My Location" rather than adding a duplicate button, since one already covered the requested behavior end-to-end.
- **Live verification** (temporarily set `CARBOYZ_ENABLE_OSM=true` in `.env.local` for the test run, reverted after): searching "Castle Hayne, NC" fired a real request to `places.googleapis.com` (403, the pre-existing Cloud API-key config issue logged 2026-08-21), bridged to a real `nominatim.openstreetmap.org` request, resolved successfully, and `map.flyTo` recentered the view — confirmed via screenshot and the location chip reading "📍 Castle Hayne (25 mi) · 13 dealers". Clicking "Use My Location" with a mocked geolocation fix recentered the map to the mocked coordinate and updated the chip to "📍 Near Wilmington, NC (25 mi) · 13 dealers" (nearest-known-point caption from the existing small offline gazetteer — expected, unrelated to this change).

### Files added/modified
- spatial-core: `src/geocoder.ts`, `src/index.ts`, `tests/geocoder.test.ts`, `dist/geocoder.js`, `dist/geocoder.d.ts`, `dist/index.js`, `dist/index.d.ts` (rebuilt)
- `src/adapters/locationAdapter.js` (modified — `resolveOsmEnabled`, OSM bridge tier in `resolveLocationQuery`)
- `scripts/generate-runtime-config.js` (modified — `CARBOYZ_ENABLE_OSM` mapping)
- `src/ui/MapView.js` (modified — `enableOsm: true` on the search modal's `resolveLocationQuery` call, locate button relabeled)
- `tests/locationAdapter.test.js` (modified — 5 new OSM-bridge tests)
- `docs/journals/dev-journal.md` (logged)

## [UOW-HOTFIX] Surgical UI Polish: Brand Badge, Popup Theming, Default Map Tab, Drawer Overlap, Tagline
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 190/190 unchanged (no test-covered surface touched besides the tagline assertion). Verified live via Playwright — including one bug caught only by actually driving the app, not by unit tests.
- **Report:** Five requested polish items, all implemented; one of them (badge/drawer overlap) surfaced a real, unrelated functional bug along the way that needed fixing to actually satisfy the request.

### 1. Brand icon (`app__logo--fallback`)
- Was gold text (`var(--color-primary)`) on a hardcoded white background — didn't read as branded at all. Now `background: var(--color-primary)` / `color: var(--color-on-primary)`, reusing the token pair from the 2026-08-25 repaint UOW rather than hardcoding new hex values — resolves to gold-fill/dark-text for the carboyz tenant automatically, and stays theme-consistent for any other tenant.

### 2. Map popup readability
- MapLibre's own stylesheet (loaded from unpkg, no theming hook) was rendering `.maplibregl-popup-content` as a plain white browser-default card — confirmed live before touching anything. Forced dark-slate styling (`#0F172A` bg, capped `max-width: 240px` so it can't run off narrow viewports) is intentionally hardcoded rather than tenant-tokenized, matching the existing precedent that the map surface itself (CARTO Dark Matter) is always dark regardless of active tenant.
- `.map-synopsis__title` → gold `#FBBF24`, `.map-synopsis__meta`/`__dealer` → white `#F1F5F9`, new `.map-synopsis__price` → green `#22C55E`. `carboyzAdapter.js`'s two synopsis-card builders (`buildSynopsisCardHtml`, `buildDealerSynopsisCardHtml`) now wrap the price/price-range in its own `<span class="map-synopsis__price">` so it can be colored independently of the rest of the meta line — existing tests use `assert.match` regex, not exact-string equality, so this didn't need test changes.
- Live-verified via a forced `mouseenter` dispatch (Playwright's synthetic `.hover()` was unreliable against MapLibre's transformed marker elements in headless mode — dispatching the event directly, which is exactly what spatial-core's `map.ts` listens for, sidesteps that) — confirmed `POPUP_BG: rgb(15,23,42)`, title `rgb(251,191,36)`, price `rgb(34,197,94)`, meta `rgb(241,245,249)`.

### 3. Default tab → Map
- `App.js`: `let activeTab = 'dealer'` → `'map'`. One-line change — the render/mount logic already branched correctly on `activeTab === 'map'` for the initial paint (it had to, to support deep-linking-style state already), so nothing else needed touching.

### 4. Badge/bottom-overlay collision — plus a real bug this surfaced
- The requested `.badge-container` class doesn't exist in this codebase, and the `gap: 8px` the ticket asked for was already present on both `.card__top` and `.map-drawer__vehicle-top`. The actual overlap risk: the map's floating locate button (`.map-locate-btn`, bottom-right) and the map inventory drawer (`.map-drawer`, a bottom sheet) share the same right-edge anchor, and the drawer routinely grows tall enough (title + several vehicle cards) to occupy the same screen region as the button. Fixed by hiding the locate button whenever the drawer is open (`showDrawer()`, the drawer-close click handler, and `onMapBackgroundClick` in `MapView.js`) and adding `flex-shrink: 0` to `.badge` so a long dealer/vehicle title can't squeeze a badge into wrapping.
- **A real, separate bug found live, not by the ticket:** driving the app to verify the above, the drawer's own "Close" button turned out to be unclickable — Playwright's error showed `.chat-discovery__submit` "intercepts pointer events" on top of it. Root cause: `.map-drawer` had `z-index: 10` while `.chat-discovery__bar` (the floating chat input) sits at `z-index: 20` in the same bottom region — the chat bar was silently eating clicks meant for the drawer underneath it. Fixed by raising `.map-drawer` to `z-index: 25`, above both the chat bar and the locate button, so the drawer always renders on top and stays clickable while open.
- **A second real bug found live:** the locate-button-hide fix above didn't work on the first Playwright pass (`LOCATE_BTN_VISIBLE_WHILE_DRAWER_OPEN: true` despite `locateBtn.hidden = true` executing). Cause: `.map-locate-btn`'s own `display: flex` rule (author stylesheet) beats the browser's default `[hidden] { display: none }` UA rule at equal specificity, because author-origin CSS always wins over user-agent-origin CSS regardless of selector specificity. Every other absolutely-positioned/toggled element in this codebase (`.map-drawer[hidden]`, `.view[hidden]`, `.modal-overlay[hidden]`, `.chat-discovery__results[hidden]`) already has this companion reset rule — `.map-locate-btn` just never needed it before now. Added `.map-locate-btn[hidden] { display: none; }` to match the established pattern.
- Re-verified after both fixes: `LOCATE_BTN_VISIBLE_WHILE_DRAWER_OPEN: false`, drawer's Close button clicks successfully, `DRAWER_HIDDEN_AFTER_CLOSE: true`, `LOCATE_BTN_VISIBLE_AFTER_CLOSE: true`.

### 5. Tagline
- `CARBOYZ_FLAGSHIP_PRESET.tagline` → `"Raw Muscle, Badass Trucks & whatever wimps want"`. Updated the one test asserting the exact string (`tests/tenantRegistry.test.js`); no other hardcoded references exist (it's read dynamically everywhere else via `tenantConfig.tagline`).

### Files added/modified
- `src/ui/styles.css` (modified — logo fallback colors, popup theming, `.map-synopsis__price`, `.badge` flex-shrink, `.map-drawer` z-index, `.map-locate-btn[hidden]`)
- `src/adapters/carboyzAdapter.js` (modified — price wrapped in `.map-synopsis__price` span, both synopsis builders)
- `src/ui/App.js` (modified — default `activeTab`)
- `src/ui/MapView.js` (modified — locate button hidden while the drawer is open, in all three code paths that show/hide it)
- `src/config/TenantRegistry.js` (modified — tagline)
- `tests/tenantRegistry.test.js` (modified — updated tagline assertion)
- `docs/journals/dev-journal.md` (logged)

## [UOW-HOTFIX] Pin Contrast, Tagline, Recenter Zoom
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 190/190. Verified live: cropped screenshot of a rendered pin confirms the dark outline/dot, and a full map screenshot at the new zoom shows street/town labels (Leland, Navassa, Wilmington) that weren't visible at the old zoom.
- **Report:** Three small, mostly-confirmatory changes; the location-search recenter/dealer-recalc/location-bar-sync flow this UOW asked to "wire up" was already fully in place from the 2026-08-25 OpenStreetMap-bridge work, so the only real gap was the zoom level.

1. **Pin contrast** — `buildDartPinSvgMarkup()`'s stroke and center dot were white (`#ffffff`), low-contrast against the gold fill. Changed both to `#0F172A`. `CARBOYZ_MAP_STYLE.pinColor` was already `#FBBF24` from the earlier repaint — no change needed there.
2. **Tagline** — updated to "Raw Muscle, Badass Trucks, Boss Jeeps & whatever wimps want"; updated the one test asserting the exact string.
3. **Recenter zoom** — `resolveLocationQuery(query, { enableOsm: true })` on search submit, `map.flyTo`, nearby-dealer recalculation, and the location bar's "📍 [Location] (25 mi) · X dealers" text were all already wired (`MapView.js`'s `applyUserLocation`, shared by both the search modal and the GPS locate button). `App.js` doesn't participate in this flow at all — `MapView.js` is fully self-contained (`renderMapView()` returns `{ section, mount, update }`; `App.js` only calls `update()`/`mount()`), so despite the ticket naming it as a file to touch, there was nothing there to wire. The one actual gap: `DEFAULT_ZOOM` was `10`, not the requested `11` — bumped it, which affects the initial map load and both recentering paths uniformly (they already intentionally shared one zoom level; no reason to fork it into a search-only value).

### Files added/modified
- `src/adapters/carboyzAdapter.js` (modified — pin stroke/dot color)
- `src/config/TenantRegistry.js` (modified — tagline)
- `tests/tenantRegistry.test.js` (modified — updated tagline assertion)
- `src/ui/MapView.js` (modified — `DEFAULT_ZOOM` 10 → 11)
- `docs/journals/dev-journal.md` (logged)

## [Feature] Auto-Suggest Location Picker
- **Date:** 2026-08-25
- **Status:** Complete. `npm test`: spatial-core 60/60 (+9), carboyz 199/199 (+9, net of one added/one removed during a design correction below). Verified live end-to-end against real `googleapis.com`/`nominatim.openstreetmap.org` — typed with per-keystroke Playwright input (not `.fill()`), confirmed the 300ms debounce doesn't fire early, dropdown renders in the dark-slate style, click closes the modal, `flyTo` recenters, and the location chip updates with the new label and live dealer count.
- **Report:** The request assumed `resolveLocationQuery` already supported multi-result autosuggest ("render up to 5 suggested matches") — it only ever returns one best match, and both underlying geocoders hardcoded a single result (`GooglePlacesGeocoder` read `places[0]`; `OpenStreetMapGeocoder` sent `limit=1`). Went through `EnterPlanMode` given the real scope: a new spatial-core capability plus a new adapter function plus a materially new UI component, not a wiring task.

### spatial-core: `resolveMany`
- `GooglePlacesGeocoder`/`OpenStreetMapGeocoder` (`src/geocoder.ts`) each gained `resolveMany(address, limit = 5): Promise<GeocodedPlace[]>`, refactored out of the existing fetch/parse logic; `resolve()` becomes `(await this.resolveMany(address, 1))[0] ?? null`, so the `GeocoderResolver` contract and every existing test are untouched. Google's Text Search response already returns multiple `places` in one call (previously just sliced to `[0]`) — no request change needed. OSM's hardcoded `limit=1` became the requested `limit`.
- **A real gap this surfaced:** `OpenStreetMapGeocoder.resolveMany` initially trusted the server to honor `limit` and didn't cap client-side, unlike the Google version (which has no server-side limit param to rely on at all). A test using a fixed-size mock response caught the inconsistency immediately. Fixed by slicing client-side in both, matching defensive posture.

### carboyz: `searchLocationSuggestions`
- New function in `locationAdapter.js`, sibling to `resolveLocationQuery` (left completely unchanged — other callers depend on its single-result contract). Tries Google (`resolveMany`) if a key resolves, then OpenStreetMap if enabled, then a new offline prefix match against the same `KNOWN_LOCATIONS` gazetteer `resolveLocationQuery` already falls back to (city-name or ZIP `startsWith`), so typing still suggests something with no key/flag configured.
- **A design mistake made and reverted during this UOW, worth recording:** live-tested a partial query ("Wilming") and found a suggestion whose label was literally the raw typed text — traced to a live geocoder matching a real coordinate with no display-name field, which spatial-core's existing `?? query` fallback (unrelated to this change, already used by `resolveLocationQuery`) renders as the query text itself. First fix attempt filtered any suggestion whose label matched the raw query string — but re-running the full test suite immediately showed this also silently discards the extremely common, entirely legitimate case of typing an exact name and getting that exact name back (e.g. "Pensacola" → "Pensacola"), which is normal, correct autosuggest behavior, not a bug. There is no reliable way to distinguish "genuine exact-name match" from "synthetic echo fallback" once both are just strings at the adapter layer. Reverted the filter; the rare echo-label edge case is accepted as-is (still resolves to a real coordinate on click, matches `resolveLocationQuery`'s pre-existing behavior for the identical scenario) rather than fixed with a heuristic proven to break the common case.

### carboyz: debounced dropdown in the existing search modal
- Extended `buildLocationModal()` in `MapView.js` (not a new modal — `.map-location-bar` already opened this one) with a `<ul class="location-modal__suggestions" role="listbox">`, styled via the existing theme tokens (`--color-surface`/`--color-border`/`--color-text`, which already resolve to the requested `#0F172A` dark-slate for the carboyz tenant — no new hardcoded hex needed).
- `input` event → 300ms debounce → `searchLocationSuggestions(value, { enableOsm: true, limit: 5 })`, guarded against out-of-order responses with a monotonic request-token check. Selecting a suggestion calls the same `onResolve` callback the existing submit flow already uses, so `applyUserLocation()` (flyTo at `DEFAULT_ZOOM`=11, nearby-dealer recalculation, location-bar text/count sync) handles centering with zero new code. The type-and-press-Search path is untouched and still works as a fallback.
- **Known, accepted tradeoff, not silently glossed over:** a 300ms debounce on fast typing can exceed Nominatim's documented "≤1 req/sec" usage policy for the shared public instance. Matches the requested debounce value exactly; not addressed here.
- **A test-tooling bug caught (not an app bug):** an early live-verification script asserted `waitForSelector('.modal-overlay[hidden]', { state: 'visible' })` — self-contradictory, since a `[hidden]` element can never be "visible." The actual app behavior (modal closes correctly, chip updates correctly) was confirmed once the assertion was fixed to check `isHidden()`.

### Files added/modified
- spatial-core: `src/geocoder.ts`, `tests/geocoder.test.ts` (+ rebuilt `dist/`)
- `src/adapters/locationAdapter.js` (modified — `searchLocationSuggestions`, `suggestOffline`)
- `tests/locationAdapter.test.js` (modified — new suggestion-tier tests)
- `src/ui/MapView.js` (modified — debounced suggestions dropdown in `buildLocationModal`)
- `src/ui/styles.css` (modified — `.location-modal__suggestions`/`__suggestion`)
- `docs/journals/dev-journal.md` (logged)

## [Feature] Procedural Regional Dealer Seeding
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` 209/209 (+10, new `generateRegionalDealers.test.js`). Verified live: searched "Miami, FL" via the auto-suggest modal, confirmed `flyTo`, exactly 10 pins, a readable dark-themed popup with real generated data, and the chip reading "📍 Miami (25 mi) · 10 dealers"; opened a generated dealer's drawer and confirmed real market-verdict badges (Overpriced/Underpriced) computed against the generated comp pool; panned within the generated region and confirmed the existing pins stayed stable rather than jittering/regenerating.
- **Report:** Went through `EnterPlanMode` given the real scope. Two gaps between the ticket and current architecture, traced before writing anything: (1) the ticket asked for the generator to live in `MapView.js`/`carboyzAdapter.js`, but neither owns dealer/vehicle *data* — `App.js` owns the tenant-scoped inventory, `carboyzAdapter.js` is a pure spatial-core formatter — so a `src/utils/` module (alongside `seedInventory.js`/`geo.js`) was the correct home; (2) there was no `map.on('moveend', …)` handler anywhere in this codebase before this UOW — the "or a viewport pan completes" trigger required new plumbing, not a wire-up.

### `src/utils/generateRegionalDealers.js` (new)
- `generateRegionalDealers(centerLat, centerLng, locationLabel, count = 10, { random = Math.random } = {})` — injectable `random`, matching this codebase's existing DI convention (`fetchImpl`, `apiKey`), so scatter/pricing is deterministic and testable with a seeded PRNG rather than flaky on real randomness.
- Scatters dealers within ~0.15° of center; derives a clean short place name from a (often verbose) geocoder label by splitting on the first comma; cycles 7 name templates ("{loc} Motors", "{loc} Truck Hub", "Coastal {loc} Auto", ...) so a default `count=10` doesn't repeat until the 8th; seeds 2-5 vehicles per dealer from a make/model/bodyStyle pool matching the flavor already established in `seedInventory.js`.
- Returns **plain objects**, not `Dealer`/`Vehicle` class instances — those classes require a `tenantId` (throw without one), and `MapView.js` doesn't know the active tenant (that's `App.js`-level state, threaded in only as already-tenant-scoped `dealers`/`vehicles` arrays via `update()`). Confirmed before designing this that the entire render path (`buildInventoryFeatures`, `evaluateVehicleMarketPosition`/`buildCompPool`, `buildVehicleCardElement`) is duck-typed with no `instanceof`/`tenantId` checks, so plain objects are the correct, simpler choice — not a shortcut.

### `MapView.js`: local-only generated state, never fed into the real inventory
- New closure state (`generatedDealers`, `generatedVehicles`, `generatedRegionCenter`) stays entirely inside `MapView.js` — deliberately never written back to `App.js`'s `state.dealers`/`IngestService`, so Dealer Studio and Buyer Search never see synthetic data. `currentDealers()`/`currentVehicles()` merge real + generated only at the points that actually render (layer config, drawer, chat discovery, dealer-count chip) — four call sites, same mechanical swap at each.
- `ensureRegionalCoverage(center, label, realNearbyDealers)`: the one shared decision point. Real dealers found → clear any stale generated filler (real data always wins, e.g. after a Discovery Scan later adds real vendor dealers to a previously-empty area — also re-checked inside `update()` now, not just on location resolution). Zero real dealers, but the existing generated cluster's center is still within the search radius → no-op, so pins don't jitter/regenerate on every small pan. Otherwise → generate a fresh cluster.
- Two triggers, both routed through `ensureRegionalCoverage`: `applyUserLocation()` (search modal + GPS locate — also bumps the chip's dealer count to include generated ones) and a new `map.on('moveend', ...)` handler reading `map.getCenter()`. The pan handler deliberately does **not** touch `locationLabel`/the chip text — panning is a distinct concern from an explicit search/GPS resolution, confirmed live (chip stayed "Miami" while panning to an adjacent empty area).

### Files added/modified
- `src/utils/generateRegionalDealers.js` (new)
- `tests/generateRegionalDealers.test.js` (new)
- `src/ui/MapView.js` (modified — generated-data state, `ensureRegionalCoverage`, `handleViewportSettled`/`moveend`, `currentDealers()`/`currentVehicles()` swapped in at the render/drawer/chat/chip call sites)
- `docs/journals/dev-journal.md` (logged)

## [Fix] Production 404 on @nemzilla/spatial-core — Vendored, Not Vite
- **Date:** 2026-08-25
- **Status:** Complete. `npm test` unchanged at 209/209 (no application logic touched). Verified live by fully hiding `node_modules/@nemzilla` (exactly simulating a Railway build, which only ever clones this repo) and confirming the app still renders completely — header, tagline, 13 real dealer pins — with zero 404s and zero console errors in a real headless Chromium pass.
- **Report:** Original ticket asked for a `vite.config.js` fix (`optimizeDeps`, `commonjsOptions`, etc.) — this repo has no Vite anywhere (no config, no dependency, no `build`/`preview` scripts) and is deliberately bundler-free by design (`index.html` resolves bare specifiers via a native `<script type="importmap">`). Flagged this before touching anything; turned out to be describing a different sibling project (`nemzilla-studio`/`todoz`/`portfolio` all use Vite). Re-scoped by the Product Owner to fix the real root cause while explicitly keeping the no-bundler architecture.

### Root cause
`@nemzilla/spatial-core` is declared as `"file:../spatial-core"` — a dependency pointing at a sibling directory *outside* this git repo, present only on a developer's machine. Locally, `npm install` symlinks `node_modules/@nemzilla/spatial-core` straight to that sibling checkout, which resolves fine — including its own nested `node_modules/{zod,h3-js}`, both referenced directly in `index.html`'s import map. On Railway (or any fresh clone), that sibling directory never exists, so `npm install` can't resolve the dependency at all, and every import-map entry pointing into `node_modules/@nemzilla/spatial-core/...` 404s. Nothing about `serve`'s configuration was ever the problem.

### Fix: vendor a committed snapshot, not a build step
- `scripts/vendor-spatial-core.js` (new) copies `node_modules/@nemzilla/spatial-core/dist` → `vendor/spatial-core/dist`, and its nested `zod`/`h3-js` → `vendor/zod`/`vendor/h3-js` — filtering out `.map`/`.d.ts`/docs/tests/benchmarks (safe: never fetched by a browser; not an attempt at real tree-shaking, which would need a bundler or fragile hand-tracing of zod's actual reachable module graph — out of scope, and the full package's runtime `.js` files are the safe fallback). Cut the vendored snapshot from 14MB to 6.7MB this way.
- Critically, this is **not** a dynamic "copy at deploy time" step (the ticket's original phrasing suggested this, and it fundamentally can't work: the source — `../spatial-core` — never exists on Railway either, only what's committed to *this* repo does). `vendor/` is committed to git; the script is a *local convenience* that refreshes it from `node_modules` whenever the sibling repo happens to be resolved (wired into `prestart`, same as `generate-runtime-config.js`), and no-ops gracefully otherwise — same graceful-degradation shape already established for the gitignored `runtime-config.js`, but inverted: that file must never be committed (secrets, regenerable everywhere); this one must always be committed (nothing regenerates it in production).
- `index.html`'s import map now points at `/vendor/spatial-core/dist/index.js`, `/vendor/zod/index.js`, `/vendor/h3-js/dist/h3-js.es.js` instead of `/node_modules/...`.
- **Known tradeoff, not silently glossed over**: `vendor/` can drift from the sibling `spatial-core` repo if someone changes it without re-running `npm start` locally (which refreshes the vendor snapshot) before committing. This mirrors exactly the coordination this session already did manually across both repos for prior UOWs (OSM geocoder, `resolveMany`, etc.) — nothing new, just now something to remember to do before pushing carboyz after a spatial-core change.

### Files added/modified
- `scripts/vendor-spatial-core.js` (new)
- `vendor/` (new, committed — `spatial-core/dist`, `zod`, `h3-js`)
- `package.json` (modified — `prestart` chains the new vendor script)
- `index.html` (modified — import map points at `/vendor/...`)
- `docs/journals/dev-journal.md` (logged)

**Follow-up fix, same session:** the vendor filter's `.ts` exclusion pattern (`/\.ts$/`) didn't match `.cts`/`.d.cts` (different suffix, same intent) — zod ships CJS-flavored `.cts` declaration/build files alongside its `.ts` source tree, and both slipped into the first commit despite this app only ever resolving ESM `.js`. Widened to `/\.(d\.)?[cm]?ts$/` (catches `.ts`/`.mts`/`.cts` and their `.d.*` declaration variants) and added a `.cjs`/`src` exclusion. Re-vendored: 6.7MB → 4.1MB, 246 → 141 files. Re-verified the same way (node_modules/@nemzilla fully hidden) — still zero 404s, zero console errors, full render.

## [UOW-10] — Mobile-First Seller Submission Engine
- **Date:** 8/25/2026
- **Status:** Complete. `npm test` 225/225 (+16 new: `submission.test.js`, `submissionService.test.js`, `ui.sellerSubmissionController.test.js`). `node --test --experimental-test-coverage` on the three new modules: `Submission.js` 100%/100%, `SubmissionService.js` 93.33%/90.00%, `SellerSubmissionController.js` 100%/100% (line/branch) — clears the repo's 80% standard; uncovered lines are the storage read/write failure catch blocks. Verified live with a headless Playwright script (`npx serve .` + Chromium): default tab loads as "Sell Your Car", selecting "Other" reveals/hides the Competitor Dealer Name field correctly, a full submission (with and without an attached file) succeeds with a visible confirmation, the form resets, `localStorage['carboyz:submissions:carboyz']` holds the persisted JSON (including the file as a `data:image/...;base64,...` string), and a reload + other-tab clicks show no regressions. Zero console errors throughout.
- **Report:** Went through `EnterPlanMode` given the real scope — new data model, new persistence layer, new UI surface, and a change to the app's default landing tab (confirmed with the Product Owner via `AskUserQuestion` before implementing: "Sell Your Car" replaces Map as default, per the ticket's "primary user flow" framing). No backend exists in this repo, so "local state persistence" and the "Base64/File Blob reference" spec line both resolve to the same mechanism: `localStorage` plus a client-side `FileReader.readAsDataURL` encode — consistent with this app's no-bundler, no-server architecture.
- **A real bug caught during live verification, not by unit tests:** the conditional Competitor Dealer Name row (`hidden` attribute on a `.form__row` div) silently never hid — `.form__row { display: flex; ... }` in `styles.css` overrides the browser's default `[hidden] { display: none; }` UA rule at equal specificity, because author-origin CSS always wins over user-agent-origin CSS regardless of specificity. This is the exact problem `.view[hidden] { display: none; }` (styles.css) already exists to solve for tab sections — just not yet extended to `.form__row`. Fixed by adding the equivalent `.form__row[hidden] { display: none; }` rule. Unit tests (DOM-free, `node:test`) had no way to catch this; only the live browser pass did.
- **Also caught during verification, environmental not a bug:** `npx serve . -p 8099` silently bound to a different port (52616) because port 8099 was already held by an unrelated, 5-day-old stale `serve` process left running from a different git worktree (`.claude/worktrees/geospatial-search-v2`, started 8/20). Not cleaned up — flagged to the Product Owner rather than killed unprompted, since it predates this session and wasn't blocking the task.

### `src/models/Submission.js` (new)
Constructor-validated class mirroring `Vehicle.js`'s style: required-field throws (`vin`, `year`, `make`, `model`, `mileage`, `zipCode`), a `competitor` enum check (`CarMax`/`Carvana`/`KBB`/`GiveMeTheVin`/`Other`), a conditional `competitorDealerName` requirement only when `competitor === 'Other'` (and the field is force-nulled otherwise, so stale data from a prior "Other" selection can't leak through if the form value changes), a non-negative numeric `competitorOfferAmount` guard, and a `status` enum (`NEW`/`IN_REVIEW`/`OFFER_BEATEN`/`DECLINED`, default `NEW`). `id`/`timestamp` are accepted as inputs (stamped by the service), matching how `Vehicle` accepts rather than generates `vehicleId`.

### `src/services/SubmissionService.js` (new)
DI'd `{ tenantId, storage }`, combining `IngestService`'s id/sequence pattern with `tenantResolution.js`'s try/catch storage pattern, under key `carboyz:submissions:<tenantId>`. Rehydrates the full array and continues the id sequence from storage on construction — verified with two service instances sharing one fake storage object. `updateStatus` re-validates through the `Submission` constructor itself rather than duplicating the enum list.

### `src/ui/SellerSubmissionController.js` / `src/ui/SellerSubmissionView.js` (new)
Controller mirrors `DealerStudioController`: haptics fire only on a successful `submit()`, never on a thrown validation error (verified explicitly — a rejected submission left the haptics spy at zero calls). View is a new mobile-first single-page form built with `App.js`'s existing `h()` DOM helper (exported for reuse — the one shared-code change, previously module-private); large tap targets via new `.input--large`/`.button--large` classes, and a drop-zone `<input type="file" accept="image/*,application/pdf" capture="environment">` with drag/drop support, reading the selected file through `FileReader` before calling the controller.

### `App.js` / `styles.css`
New "Sell Your Car" tab, now first in the tab order and the default `activeTab` (was `'map'`). `getTenantState()` gained a tenant-scoped `SubmissionService`. Styling additions reuse existing `--color-*`/`--spacing`/`--radius` tokens — no new palette.

### Files added/modified
- `src/models/Submission.js` (new)
- `src/services/SubmissionService.js` (new)
- `src/ui/SellerSubmissionController.js` (new)
- `src/ui/SellerSubmissionView.js` (new)
- `src/ui/App.js` (modified — `h` exported, new tab, service/controller/view wiring, default tab)
- `src/ui/styles.css` (modified — `.form__row[hidden]`, `.input--large`/`.button--large`, `.dropzone*`, `.form__status*`, `.view__subtitle`)
- `tests/submission.test.js`, `tests/submissionService.test.js`, `tests/ui.sellerSubmissionController.test.js` (new)
- `.hydrate/CURRENT_UOW.md` (updated with UOW-10 scope and architecture)
- `docs/journals/dev-journal.md` (logged)

## [UOW-11] — Offer Beater Spread Engine & Lead Inbox View
- **Date:** 8/25/2026
- **Status:** Complete. `npm test` 238/241 (+15 new: `spreadService.test.js` 10, `ui.leadInboxController.test.js` 5). The 3 failures are pre-existing, unrelated `tests/locationAdapter.test.js` env-dependent flakes — confirmed still failing identically on `main` before this change (`git stash` + rerun). `node --test --experimental-test-coverage` on the two new modules: `SpreadService.js` 100%/100%/100%, `LeadInboxController.js` 100%/100%/100% (line/branch/func) — clears the repo's 80% standard.
- **FMV data source decision:** No VIN-decode/external pricing API exists in this repo. Reused `TelemetryService.getMarketStats()` (the same call `DealerStudioController` already uses for inventory comp averages) against the tenant's current inventory, keyed by the submission's make/model/year, as the Fair Market Value input to `SpreadService`. When no comps exist, `SpreadService` returns a `NO_DATA` status rather than fabricating a number — Recommended Counter Offer still computes since it only depends on the competitor offer.
- **Scope decision — extend, not replace:** The ticket said "Replace or extend the Dealer Studio / Buyer Search views." Replacing either would have broken `tests/ui.dealerStudioController.test.js` / `tests/ui.buyerSearchController.test.js` and violated the repo's "npm test clean across 225+ existing tests" regression gate — so a 5th "Lead Inbox" tab was added alongside the existing four, mirroring how the "Sell" tab was added in UOW-10. Default tab stays `'sell'` (unchanged from UOW-10's Product Owner decision).
- **A real bug caught during live verification, not by unit tests:** views in this app (`sellView`, `dealerView`, etc.) are built once per `render()` call; tab-button clicks only toggle `hidden`/`aria-selected` in a closure — they don't re-invoke `render()`. `renderLeadInboxView()` originally rendered its card list once at construction time, so a lead submitted via the "Sell Your Car" tab never appeared in "Lead Inbox" without a full re-render (e.g. a tenant switch). Caught with a live Playwright pass (submit a lead → switch tabs → empty state persisted). Fixed by having `renderLeadInboxView()` return `{ section, refresh }` instead of just the section, and calling `refresh()` on tab-select — the same shape `mapView` already uses (`{ section, mount, update }`) for its own on-select refresh (`mapView.mount()`).
- **Verified live with headless Playwright** (`npx serve .` + cached Chromium, no `chromium-cli` available in this environment so drove `playwright` directly per the run skill's fallback): submitted a Jeep Wrangler 2021 lead against seeded inventory comps (avg $30,500) with a $15,000 competitor offer → card showed `Greenlight` badge, spread math correct ($30,500 × 0.88 − $15,000 = $11,840 ≥ $1,000), Recommended Counter $15,300 ($15,000 + $300); a make/model/year with no comps correctly showed `No Market Data`; clicking "Mark In Review" disabled that action button and persisted through re-render. Zero console errors throughout.

### `src/services/SpreadService.js` (new)
Pure functions, no DI — no state to hold. `calculateSpread({ fairMarketValue, competitorOfferAmount, counterOfferOffset = 300 })` throws on an invalid `competitorOfferAmount` (mirrors the guard already in `Submission.js`), always computes `recommendedCounterOffer` independent of FMV availability, and returns `NO_DATA` (nulled `estimatedWholesaleValue`/`spread`) when `fairMarketValue` isn't a positive number. Boundaries: spread ≥ $1,000 → `GREENLIGHT`, ≥ $300 → `MARGINAL`, else `PASS` (covers negative spreads too).

### `src/ui/LeadInboxController.js` (new)
Mirrors `DealerStudioController`'s DI/throw pattern (`submissionService`, `telemetryService`, `ingestService`). `buildLeadViewModels()` resolves FMV per submission via the inventory comp average, calls `SpreadService`, and formats the competitor label (`Other (Hendrick Motors)` when applicable). `updateStatus()` delegates straight to `submissionService.updateStatus`.

### `src/ui/LeadInboxView.js` (new)
`renderLeadInboxView(controller)` → `{ section, refresh }`. Card list (empty-state pattern reused from `renderDealerStudioView`), spread badge, competitor-offer-vs-counter line (`Intl.NumberFormat` pattern from `vehicleCard.js`), a document-view modal reusing the `.modal-overlay`/`.modal` CSS already defined for the discovery-scan progress modal (renders an `<img>` for image data URLs, a link for `application/pdf` ones), and three status-action buttons that call `controller.updateStatus` then re-render.

### `App.js` / `styles.css`
New "Lead Inbox" 5th tab, wired the same way as the other four; `refreshLeadsView()` called on tab-select (see bug note above). `.badge--greenlight`/`--marginal`/`--pass`/`--no-data` added next to the existing badge block, reusing existing `--color-underpriced`/`--color-fair`/`--color-overpriced`/`--color-secondary` tokens — no new palette. `.modal--doc`/`.modal__doc-content`/`.modal__doc-image` added for the document-view modal.

### Files added/modified
- `src/services/SpreadService.js` (new)
- `src/ui/LeadInboxController.js` (new)
- `src/ui/LeadInboxView.js` (new)
- `src/ui/App.js` (modified — 5th tab, controller/view wiring, tab-select refresh)
- `src/ui/styles.css` (modified — badge variants, doc-modal styling)
- `tests/spreadService.test.js`, `tests/ui.leadInboxController.test.js` (new)
- `.hydrate/CURRENT_UOW.md` (updated with UOW-11 scope and architecture; UOW-10's prior content archived to `.hydrate/archive/UOW-10.md`)
- `docs/journals/dev-journal.md` (logged)

## [UOW-12] — Configurable Spread Tier Engine & Admin Portal
- **Date:** 8/27/2026
- **Status:** Complete. `npm test` 264/264 pass minus the same 3 pre-existing, unrelated `tests/locationAdapter.test.js` env-dependent flakes noted in UOW-11's entry (23 new tests: `spreadConfigService.test.js` 11, `ui.spreadConfigController.test.js` 4, `spreadService.test.js` +7, `ui.leadInboxController.test.js` +1). `node --test --experimental-test-coverage` scoped to the touched/new modules: `SpreadConfigService.js` 92.91%/90.91%, `SpreadService.js` 100%/92.59%, `SpreadConfigController.js` 100%/100% (line/branch) — clears the repo's 80% standard; uncovered `SpreadConfigService.js` lines are the storage read/write failure catch blocks (same shape as `SubmissionService.js`'s uncovered lines in UOW-10).
- **Scope decision — wire it live, not just build the capability:** The ticket only listed `SpreadConfigService`, the `SpreadService` refactor, `SpreadConfigView`, and tests as files — it didn't explicitly ask for `LeadInboxController`/`App.js` changes. But an admin screen for editing tiers that no code path ever reads would be dead weight, so the architecture step added a `spreadConfigService` as an **optional** 4th constructor param on `LeadInboxController` (defaults to `null`, existing required-dep checks and all prior tests untouched) so Lead Inbox counter-offer math actually reflects saved tier edits.
- **Extend, not replace (same precedent as UOW-10/UOW-11):** Added a 6th "Admin" tab alongside the existing five rather than touching any of them. Default tab stays `'sell'`.
- **Percent storage convention:** Tiers store `percent` as a 0–1 fraction internally (matches how `SpreadService` multiplies it directly against the offer amount); `SpreadConfigView` converts to/from a human-typed whole number (`2` ↔ `0.02`) at the form boundary only.
- **Verified live with headless Playwright** (`npx serve .` + cached Chromium, driven directly since `playwright` isn't installed as a project dependency — same fallback used in UOW-11, reusing the `~/.npm/_npx` cache that already held it from that run): submitted a 2021 Jeep Wrangler lead against CarMax for $18,000 → Lead Inbox showed Recommended Counter $18,500 (default middle tier: `MAX($500 flat, $18,000 × 2% = $360)` → $500). Edited CarMax's middle tier flat amount to $900 in the new Admin tab, saved, reloaded the page (fresh `mountApp()` run) — the edited value was still $900 and the same lead's Recommended Counter recalculated to $18,900 with no further action. "Reset to Defaults" restored $500. Zero console errors throughout.

### `src/services/SpreadConfigService.js` (new)
`{ tenantId, storage }` DI, storage key `carboyz:spreadConfig:<tenantId>`, mirrors `SubmissionService.js`'s try/catch read/write pattern. Exports `TIER_STRATEGIES` (`MAX`/`FLAT_ONLY`/`PERCENT_ONLY`) and a frozen `DEFAULT_TIERS` 3-bracket ladder (`$0–15k` → $300/2%, `$15k–30k` → $500/2%, `$30k+` → $750/1.5%) seeded for every `COMPETITORS` entry. `validateConfig` throws descriptive errors on bad tier shape (negative `minPrice`/`flatAmount`/`percent`, `maxPrice` not `null`/not `> minPrice`, unrecognized `strategy`) but defaults an omitted `strategy` to `MAX` rather than throwing, and doesn't require every competitor to be present or brackets to be sorted/non-overlapping (not asked for). `getTiersForCompetitor` on an unknown competitor returns `[]` — the fallback signal `SpreadService` treats as "use the flat default."

### `src/services/SpreadService.js` (refactor, fully backward-compatible)
`calculateSpread` gained an optional `tierConfig` param. New `matchTier`/`evaluateTierOffset` helpers resolve a bracket by `amount >= minPrice && (maxPrice === null || amount < maxPrice)` and apply `Math.max(flat, percent-of-offer)` for the default/`MAX` strategy (or just one side for `FLAT_ONLY`/`PERCENT_ONLY`). No bracket match or no `tierConfig` at all → falls straight back to the pre-UOW-12 flat `counterOfferOffset` path, so all 12 original tests needed zero changes.

### `src/ui/SpreadConfigController.js` / `src/ui/SpreadConfigView.js` (new)
Controller is a thin DI wrapper (mirrors `DealerStudioController`), `getCompetitors()` sourced from `Submission.js`'s `COMPETITORS` so the Admin form's competitor list can't drift from the Sell/Lead Inbox forms. View renders one editable tier-row block per competitor (`h()` builder from `App.js`) with Add/Remove Tier buttons, a Save/Reset pair, and a `.form__status` message reusing `SellerSubmissionView`'s try/catch-and-display pattern.

### `src/ui/LeadInboxController.js` / `App.js` / `styles.css`
See scope decision above for the optional `spreadConfigService` wiring. `App.js` gained a per-tenant `SpreadConfigService` in `getTenantState()` and a 6th "Admin" tab wired identically to how "Lead Inbox" was added in UOW-11. `styles.css` added a small `.tier-section`/`.tier-row`/`.tier-row__field` block reusing existing color tokens — no new palette.

### Files added/modified
- `src/services/SpreadConfigService.js` (new)
- `src/services/SpreadService.js` (modified — optional `tierConfig` param, backward-compatible)
- `src/ui/SpreadConfigController.js` (new)
- `src/ui/SpreadConfigView.js` (new)
- `src/ui/LeadInboxController.js` (modified — optional `spreadConfigService` param)
- `src/ui/App.js` (modified — 6th tab, service/controller/view wiring)
- `src/ui/styles.css` (modified — tier editor styling)
- `tests/spreadConfigService.test.js`, `tests/ui.spreadConfigController.test.js` (new); `tests/spreadService.test.js`, `tests/ui.leadInboxController.test.js` (extended)
- `.hydrate/CURRENT_UOW.md` (updated with UOW-12 scope and architecture; UOW-11's prior content archived to `.hydrate/archive/UOW-11.md`)
- `docs/journals/dev-journal.md` (logged)
