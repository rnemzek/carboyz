# Developer Journal — CarBoyZ

## [UOW-22] LocationAdapter Network Assertion Repair — 2026-09-01

**Root cause:** Not an adapter logic bug — a test-isolation gap. `resolveApiKey()` in
`src/adapters/locationAdapter.js` falls back to `process.env.GOOGLE_PLACES_API_KEY` whenever
`options.apiKey` isn't explicitly passed. The 3 failing tests in `tests/locationAdapter.test.js`
assert "no API key configured → no network call," but the developer's ambient shell/`.env.local`
had `GOOGLE_PLACES_API_KEY` set, so the offline-gazetteer-fallback tests unintentionally routed
through the real Google Places geocoder path and tripped their `fetchImpl` mocks.

**Fix:** Added `before`/`after` hooks (`node:test`) at the top of
`tests/locationAdapter.test.js` that save, delete, and restore `process.env.GOOGLE_PLACES_API_KEY`
around the whole file, so "no apiKey option" deterministically means "no API key configured"
regardless of host environment. No production code in `src/adapters/locationAdapter.js` changed —
its fallback ordering (Google → OSM if enabled → offline gazetteer) was already correct.

**Files touched:** `tests/locationAdapter.test.js` (test isolation only).

**Verification:** `npm test` → 476/476 passing (was 473/476). Coverage on
`src/adapters/locationAdapter.js`: 100% line, 81.33% branch (gate: 80% line+branch) — meets the
quality gate.

## [UOW-23] Structural Codebase Audit & RECONSTRUCTED_STATE.md — 2026-09-02

**Scope:** No production code changed. Read every file in `src/` (58 files across
adapters/config/core/models/server/services/ui/utils) plus `package.json`, ran `npm test`
(476/476 passing) and `node --test --experimental-test-coverage`, and wrote
`docs/RECONSTRUCTED_STATE.md` — a ground-truth inventory of what's implemented, what's tested,
and what's stubbed/missing, superseding assumptions in `docs/REBUILD_ANALYSIS.md`.

**Key findings:**
- Every domain model, adapter, and service is fully implemented (no stubs/TODOs found anywhere
  in `src/`). The "spread/pricing policy engine" the roadmap doc listed as an MVP gap already
  exists: `SpreadService.js` + `SpreadConfigService.js` + `DispatchService.js`, all tested.
- Coverage gap (66.84% overall line, 91.27% branch) is concentrated entirely in DOM-mounting
  view functions (`App.js` 16%, `MapView.js` 10%, `SellerSubmissionView.js` 5%, etc.) — a
  consistent, intentional convention (thin DOM glue over fully-tested controllers/logic), not
  scattered incompleteness. Controllers, models, services, and adapters all meet or nearly meet
  the 80% gate.
- Confirmed real gaps vs. the roadmap: no isolated per-tenant backend (server is one shared
  Hono+ws process, two stub routes, no persistence); no QR-based phone-to-desktop session
  handoff wiring; no offline service worker/Workbox queue anywhere in `src/`; no policy
  mutation ledger/versioning/audit trail (`SpreadConfigService.saveConfig()` overwrites
  localStorage with no history); no analytics version-pinning or what-if simulation engine.
- Two standout hand-written implementations worth flagging for future work: a zero-dependency
  ISO/IEC 18004 QR encoder (`utils/qrEncoder.js`) and a spec-correct ISO 3779/NHTSA VIN
  check-digit + WMI decoder (`utils/vinScanner.js`).

**Files touched:** `docs/RECONSTRUCTED_STATE.md` (new).

**Verification:** `npm test` → 476/476 passing (unchanged, no production code modified).

