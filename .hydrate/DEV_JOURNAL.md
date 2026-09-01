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

