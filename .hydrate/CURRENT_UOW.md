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

### UOW-17 — White-Labeling Engine & Mobile PWA Ergonomics

**Objective**
Implement dynamic white-labeling with an in-browser icon normalization utility, bottom mobile navigation bar, and A2HS (Add to Home Screen) onboarding drawer.

**Acceptance Criteria** (as given by Product Owner)
1. Canvas-Based Icon Processing Utility (`src/utils/iconNormalizer.js`) — accepts raw image files or URLs (SVG/PNG/JPG), renders onto an HTML5 Canvas centering the logo inside a square with safe-area padding, generates normalized PNG outputs for apple-touch-icon (180×180) and manifest icons (192×192, 512×512).
2. Dynamic Tenant Branding Service (`src/services/TenantConfigService.js`) — stores tenant profiles, applies theme properties to `:root` CSS vars, dynamically updates `<title>`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, and Web App Manifest links in `<head>`.
3. Mobile Bottom Navigation Bar (`src/ui/BottomNavView.js`) — replaces top header tabs on mobile viewports with a persistent bottom tab bar (Intake, Lead Inbox, Analytics, Admin), safe-area bottom padding.
4. PWA A2HS Onboarding (`src/ui/PwaInstallPromptView.js`) — non-intrusive bottom drawer explaining the 3-tap "Add to Home Screen" flow for iOS Safari / Android Chrome, tenant-branded.

### Prior UOW
UOW-16's staged content archived to `.hydrate/archive/UOW-16.md` (shipped and committed as `31d3675`).

### Architecture (Lead Architect step)

Fast-Path eligible: additive across all four surfaces, no breaking changes to existing service/controller contracts. Reconciliation note up front — the repo already has `src/config/tenantConfig.js` (shape + `createTenantConfig`), `src/config/TenantRegistry.js` (per-tenant storage/lookup), and `src/ui/theme.js` (`applyTenantTheme` → `:root` CSS vars). `TenantConfigService` does **not** duplicate any of these — it composes them and owns exactly the `<head>` side effects (title/meta/icon-links/manifest-link) that don't exist yet anywhere in the codebase.

---

#### 1. `src/utils/iconNormalizer.js` — pure layout math + thin canvas/image I/O

Split for testability, same precedent as `TestHarnessView.js` (pure exports tested, DOM-touching `renderX` untested) — canvas/`Image`/`FileReader` have no Node equivalent, so only the geometry is unit-tested.

**Exported constants:**
- `ICON_SPECS = [{ key: 'appleTouchIcon', size: 180 }, { key: 'manifestIcon192', size: 192 }, { key: 'manifestIcon512', size: 512 }]`

**Pure, testable:**
- `resolveIconSpec(key)` → matching `ICON_SPECS` entry, throws `Unknown icon spec: ${key}` if not found.
- `computeContainLayout(sourceWidth, sourceHeight, canvasSize, paddingRatio = 0.12)` → `{ drawWidth, drawHeight, dx, dy }`. **"Contain", not "cover"** — the whole logo is scaled to fit inside a `canvasSize * (1 - 2*paddingRatio)` safe-area box, preserving aspect ratio, centered via `dx`/`dy`. (A crop-to-square "cover" strategy would cut off wide/tall logos, which is wrong for a logo-normalization tool.) Covers square/wide/tall source branches plus `paddingRatio` variation.

**DOM-dependent, untested (same tier as View-layer render functions):**
- `loadImageElement(input)` → async; `input` is a `File`/`Blob` (read via `FileReader`/`createObjectURL`) or a `string` URL (assigned directly to `new Image().src` — the canvas rasterizes SVG/PNG/JPG uniformly once loaded); resolves on `load`, rejects on `error`.
- `renderIconCanvas(image, size, paddingRatio)` → new `size×size` canvas, `computeContainLayout` off `image.naturalWidth`/`naturalHeight`, `ctx.drawImage(image, dx, dy, drawWidth, drawHeight)`, returns the canvas.
- `canvasToPngDataUrl(canvas)` → `canvas.toDataURL('image/png')`.
- `normalizeIconSet(input, { paddingRatio = 0.12 } = {})` → async orchestrator: loads the image once, renders+exports all 3 `ICON_SPECS`, returns `{ appleTouchIcon, manifestIcon192, manifestIcon512 }` (data-URL strings) — **this exact shape is `tenantConfig.iconSet`**, consumed by `TenantConfigService`.

Not wired into any upload UI in this UOW (no AC asks for one) — it's a standalone utility exercised by its own tests; `TenantConfigService`/tenant presets treat `iconSet` as optional and gracefully no-op icon-link updates when absent.

---

#### 2. `src/config/tenantConfig.js` — additive field only

Add `iconSet: null` to `DEFAULT_TENANT_CONFIG` and pass through in `createTenantConfig` via a plain top-level override (no nested-merge needed — `iconSet` is either `null` or a flat 3-key data-URL map, unlike `themeColors`/`contact`). Extend existing `tests/tenantConfig.test.js` with default/override assertions (no new test file).

#### 2b. `src/ui/theme.js` — additive `accent` color key

Add `accent: '--color-accent'` to `CSS_VARIABLE_BY_COLOR_KEY` (the AC explicitly names `--color-accent` alongside `--color-primary`). Stays optional/undefined-filtered exactly like `surface`/`border`/`onPrimary` today — no change to `DEFAULT_THEME_COLORS`. One assertion added to existing `tests/ui.theme.test.js`.

---

#### 3. `src/services/TenantConfigService.js`

Same DI-for-testability precedent as `theme.js`'s injectable `target` — constructor takes an injectable `document`-like object (defaults to the real `document`) plus an injectable manifest-blob factory so tests never depend on Node's `Blob`/`URL.createObjectURL` support.

```
export function buildManifestObject(tenantConfig)
  // pure, testable: { name, short_name, description, start_url: '/', display: 'standalone',
  //   background_color, theme_color, icons: [...] } — icons array includes an entry only for each
  //   iconSet.manifestIcon192/512 that is present (0, 1, or 2 entries); background_color/theme_color
  //   fall back to sane defaults when themeColors is sparse.

export class TenantConfigService {
  constructor({ document = (typeof document !== 'undefined' ? document : null),
                createManifestUrl = defaultCreateManifestUrl } = {})
  applyTenant(tenantConfig)
    // no-op if this.document is null (SSR/non-browser, same safety precedent as applyTenantTheme).
    // 1. applyTenantTheme(tenantConfig, this.document.documentElement)  — delegates, no duplication
    // 2. this.document.title = tenantConfig.name
    // 3. upsert <meta name="theme-color"> content = themeColors.primary
    // 4. if iconSet.appleTouchIcon: upsert <link rel="apple-touch-icon" href=...>
    // 5. if iconSet.manifestIcon192 / manifestIcon512: upsert matching <link rel="icon" sizes="...">
    // 6. revoke the previously created manifest URL (if any), build buildManifestObject(tenantConfig),
    //    createManifestUrl(manifestObject) → href, upsert <link rel="manifest" href=...>
}
```

`upsertMetaTag`/`upsertLinkTag` are small private helpers: find by `document.head.querySelector('meta[name=...]')` / `('link[rel=...][sizes=...]')`, update `content`/`href` in place if found, else `document.createElement` + `head.appendChild`.

`defaultCreateManifestUrl(manifestObject)` — real implementation: `URL.createObjectURL(new Blob([JSON.stringify(manifestObject)], { type: 'application/manifest+json' }))`.

---

#### 4. `src/ui/BottomNavView.js`

Untested DOM-rendering tier (same as `renderTabs` in `App.js` itself, `AnalyticsView.js`, `LeadInboxView.js` — none of these have dedicated test files).

```
export const BOTTOM_NAV_ITEMS = [
  { tab: 'sell', label: 'Intake' },
  { tab: 'leads', label: 'Lead Inbox' },
  { tab: 'analytics', label: 'Analytics' },
  { tab: 'admin', label: 'Admin' },
];
export function renderBottomNavView(activeTab, onSelect) → { nav, buttons }  // buttons: Map<tab, HTMLButtonElement>
```

**Scope decision — 4th slot is `admin` only, Test Harness stays desktop-only:** the ticket lists "Admin / Test Harness" as one slot but a bottom bar only has room for 4 destinations matching the other 3 named tabs 1:1. Test Harness is a QA/dev tool, not a field-ops destination, so it's dropped from the curated mobile set rather than jammed into a shared button with unclear tap targets. The existing top `nav.tabs` (all 8 tabs, Test Harness included) is only hidden below the mobile breakpoint — tablet/desktop retain full access, and "hidden below breakpoint" is reversible/inspectable in the CSS if the Product Owner wants it revisited.

**CSS (`styles.css`):** `.bottom-nav` fixed to viewport bottom, `display: none` by default; `.bottom-nav__button`; media query `@media (max-width: 640px) { .tabs { display: none; } .bottom-nav { display: flex; } }`. Safe-area: `padding-bottom: calc(8px + env(safe-area-inset-bottom));` (viewport meta already has `viewport-fit=cover` in `index.html` — no change needed there).

---

#### 5. `src/ui/PwaInstallPromptView.js`

Mixed file, same precedent as `TestHarnessView.js` (pure exports tested, `renderX` DOM function untested).

**Pure, testable:**
- `detectA2hsPlatform({ userAgent = '', standalone = false } = {})` → `'ios-safari' | 'android-chrome' | 'unsupported'`. `standalone: true` → always `'unsupported'` (already installed). iOS Safari: UA matches `/iphone|ipad|ipod/i` and `/safari/i` and NOT `/crios|fxios|edgios/i` (other iOS browsers can't drive native A2HS this way). Android Chrome: `/android/i` and `/chrome/i`. Else `'unsupported'`.
- `buildA2hsCopy(platform, tenantConfig)` → `{ title, steps: [3 strings] }` tenant-branded (`Add ${tenantConfig.name} to your Home Screen`), platform-specific 3-tap steps; `null` for `'unsupported'`.
- `shouldShowA2hsPrompt({ platform, dismissed })` → `platform !== 'unsupported' && !dismissed`.
- `A2HS_STORAGE_KEY = 'carboyz:a2hsDismissed'`, `readA2hsDismissed(storage)` / `writeA2hsDismissed(storage)` — try/catch-guarded exactly like `tenantResolution.js`'s storage helpers (silent no-op on unavailable storage).

**DOM-dependent, untested:**
- `renderPwaInstallPromptView({ tenantConfig, window = globalThis, storage = window?.localStorage } = {})` → detects platform via `window.navigator.userAgent` + `window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone`; if `shouldShowA2hsPrompt(...)` is false, returns `null` (caller doesn't mount anything); else builds the bottom drawer (tenant logo/name via `getBrandInitials`/`logoUrl`, `copy.title`, ordered `copy.steps`, dismiss button wired to `writeA2hsDismissed(storage)` + `el.remove()`).

---

#### 6. `App.js` wiring

- Import `TenantConfigService`, `renderBottomNavView`, `BOTTOM_NAV_ITEMS`, `renderPwaInstallPromptView`.
- One shared `const tenantConfigService = new TenantConfigService();` at `mountApp` scope (document-singleton, not per-tenant).
- `render()`: replace the existing `applyTenantTheme(activeTenantConfig); document.title = ...;` pair with `tenantConfigService.applyTenant(activeTenantConfig);` (removes now-redundant lines; the service calls `applyTenantTheme` internally, so no duplication).
- Extract the tab-select logic already inline in `renderTabs`'s 3rd arg into a named `handleTabSelect(tab)` closure inside `render()`, used as the `onSelect` callback for **both** `renderTabs` and `renderBottomNavView`, keeping both navs' `aria-selected`/active state and the view-section `.hidden` toggling in one place (no duplicated switch logic).
- Mount `renderBottomNavView(activeTab, handleTabSelect).nav` alongside the existing top `nav` in the `app` div.
- Mount the A2HS drawer: `const a2hsPrompt = renderPwaInstallPromptView({ tenantConfig: activeTenantConfig }); const app = h('div', {...}, [..., a2hsPrompt?.el].filter(Boolean));` — re-evaluated each `render()` call (tenant switch, discovery scan completion) so branding/dismissal state stays current; not on a tighter loop since nothing else re-renders more often than that today.

---

#### 7. `index.html` / new `manifest.webmanifest`

- Add `manifest.webmanifest` at repo root: minimal icon-less static baseline (`name`, `short_name`, `start_url`, `display`, `theme_color`, `background_color`) so PWA installability has a valid manifest before JS runs.
- Add `<link rel="manifest" href="/manifest.webmanifest">` to `index.html` `<head>`. `TenantConfigService.applyTenant()` swaps this link's `href` to a per-tenant Blob-URL manifest at runtime (icons array populated only when `iconSet` is present). Existing `<meta name="theme-color" content="#0057d9">` is reused/updated in place, not duplicated.
- No default apple-touch-icon/manifest-icon binary assets are added (no design assets provided, out of scope) — `TenantConfigService` simply skips those `<link>` upserts when a tenant's `iconSet` is `null`, which is the case for all 3 seed presets until someone runs the normalizer.

---

### Testing Summary (new)
- `tests/iconNormalizer.test.js` (new) — `resolveIconSpec` (found + unknown-key throw), `computeContainLayout` across square/wide/tall sources and varying `paddingRatio`.
- `tests/tenantConfigService.test.js` (new) — `buildManifestObject` (icons present/absent permutations, fallback colors); `TenantConfigService.applyTenant` against an injected fake `document` (title set, meta upsert-vs-create, apple-touch-icon/manifest-icon links only created when `iconSet` present, manifest link href swapped via injected `createManifestUrl`); safe no-op with `document: null`.
- `tests/pwaInstallPromptView.test.js` (new) — `detectA2hsPlatform` (iOS Safari, iOS Chrome→unsupported, Android Chrome, standalone→unsupported, desktop UA→unsupported), `buildA2hsCopy` per platform incl. tenant-name interpolation, `shouldShowA2hsPrompt` truth table, `readA2hsDismissed`/`writeA2hsDismissed` storage-unavailable safety.
- `tests/tenantConfig.test.js` (extended) — `iconSet` default `null`, override passthrough.
- `tests/ui.theme.test.js` (extended) — `accent` → `--color-accent` mapping.
- No dedicated test files for `BottomNavView.js` or the `render*` half of `PwaInstallPromptView.js` — untested View tier, consistent with `AnalyticsView.js`/`LeadInboxView.js`/`SpreadConfigView.js`/`App.js`'s own `renderTabs`.
- Regression: full `npm test` must stay green (pre-existing `tests/locationAdapter.test.js` env flakes remain the only expected failures, per every prior UOW's journal entry).
- Coverage: 80% line/branch standard applies to `iconNormalizer.js`'s pure exports, `TenantConfigService.js`, and `PwaInstallPromptView.js`'s pure exports.
- Manual/Playwright browser check: load app, confirm bottom nav appears at a mobile viewport width and drives the same tab state as the top nav; confirm A2HS drawer renders under a spoofed iOS/Android UA and dismiss persists across a reload; confirm switching the brand-switcher updates `<title>`/`<meta theme-color>`/manifest link href with zero console errors.

### Other file touches
- `src/config/tenantConfig.js` — additive `iconSet` field (§2).
- `src/ui/theme.js` — additive `accent` CSS var key (§2b).
- `src/ui/styles.css` — additive only (`.bottom-nav*`, `.a2hs-drawer*`, mobile breakpoint media query).
- `index.html` — add `<link rel="manifest">`.
- `manifest.webmanifest` — new static baseline file.
- No changes to `TenantRegistry.js`, `tenantResolution.js`, `Submission.js`, `SubmissionService.js`, `DispatchService.js`, `AnalyticsService.js`, or any other existing service/controller.

## Execution Instruction
Architecture fully specified above. Lead Developer (Claude Code) to proceed directly with implementation and verification per Fast-Path Protocol §3 (One-Shot Context Transition) — no secondary plan-approval cycle required before writing code.
