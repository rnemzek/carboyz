# UOW-CARBOYZ-22: LocationAdapter Network Assertion Repair

## 1. Description & Goal
Investigate and resolve the 3 failing tests in `tests/locationAdapter.test.js`. These failures stem from offline-fallback network call assertions. Ensure the location adapter correctly handles network call fallbacks and that test mocks properly reflect offline/online state transitions.

## 2. Key Acceptance Criteria
- [ ] Inspect `tests/locationAdapter.test.js` and the corresponding adapter logic in `src/adapters/` (or `src/services/`).
- [ ] Fix mock behavior or offline fallback handling for network calls so that offline state transitions execute deterministically.
- [ ] Achieve 100% test pass rate across the test suite (476/476 passing).
- [ ] Maintain backward compatibility for multi-tenant spatial mapping logic.

## 3. Affected Files
- `src/adapters/locationAdapter.js` (or relevant adapter service)
- `tests/locationAdapter.test.js`

## 4. Verification Steps
1. Run `npm test` (or the project test runner) and verify all 476 tests pass with 0 failures.
