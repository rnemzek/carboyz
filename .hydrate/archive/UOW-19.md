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

### UOW-19 — Camera-Based VIN Barcode & Optical Character Recognition (OCR) Scanner

**Objective**
Enhance the Seller Intake Canvas (`src/ui/SellerSubmissionView.js`) with an inline, real-time camera viewfinder that scans standard automotive Code 39 / DataMatrix barcodes (door jamb stickers, registration documents) or parses raw 17-character VIN text, to automatically populate vehicle details.

**Acceptance Criteria** (as given by Product Owner)
1. Camera Viewfinder & Frame Grabber Utility (`src/utils/vinScanner.js`) — back-camera `getUserMedia`; native `BarcodeDetector` scanning (Code 39/128, DataMatrix); fallback text/OCR parser matching the 17-char ISO 3779 VIN format (no I/O/Q); ISO 3779/NHTSA position-weighted modulus-11 check-digit validation before auto-fill.
2. Seller Intake Canvas UI Integration (`src/ui/SellerSubmissionView.js`) — "Scan VIN" camera-icon button next to the VIN field; full-screen/inline modal viewfinder with a lit reticle; on valid detection, haptic buzz + auto-fill VIN/Year/Make/Model/Trim + close; graceful degradation to manual input when camera is denied/unsupported.
3. Testing — `tests/vinScanner.test.js` covering check-digit math, regex parsing, permission fallback; ≥80% line/branch coverage; full `npm test` + Playwright browser check.

### Prior UOW
UOW-18's staged content archived to `.hydrate/archive/UOW-18.md` (shipped and committed as `d4363d7`).

### Architecture (Lead Architect step)

Fast-Path eligible for the core scanner+UI wiring (one new pure/DI'd utility module plus additive wiring inside a single existing view — `hapticsService` is already exposed on `SellerSubmissionController`, so no `App.js` changes are needed this time). Two scope calls below were genuinely ambiguous against a zero-dependency, offline-first codebase and are called explicitly rather than silently assumed:

**Scope decision — no real OCR engine; "OCR fallback" is a text-pattern parser applied to typed/pasted text, not image-to-text.** True image OCR needs either a heavy client-side engine (e.g. `tesseract.js`, several MB of wasm) or a browser `TextDetector` API that was Chrome-experimental-only and has since been removed from web platform — neither is compatible with this codebase's established zero-dependency-per-module precedent (`qrEncoder.js`, `appraisalPdfGenerator.js`, `iconNormalizer.js`). `vinScanner.js` ships the genuinely real half of the AC — live camera + native `BarcodeDetector` scanning for Code 39/128/DataMatrix — plus a `captureVideoFrame(video, ctx)` frame-grabber utility (the AC's "Frame Grabber Utility" bullet, DI'd/pure and unit-tested) and a regex+check-digit `findValidVin(text)` parser. The scanner modal's manual-entry field ("type or paste the VIN") runs text through that same parser — this is the fallback path a real user hits after a phone's own Photos/Lens OCR reads the sticker, or when they just type it. No canvas pixel data is ever fed through a text-extraction step; that would be theater, not function.

**Scope decision — Year/Make decoded locally (no NHTSA network call); Model/Trim stay manual.** The AC allows "NHTSA / internal decoding logic." Calling the live NHTSA vPIC API would be this codebase's first network dependency in an otherwise offline-capable, `localStorage`-backed PWA (per `SubmissionService`/`TenantConfigService` precedent) — model year (VIN position 10, standard 30-year-cycle table) and manufacturer (WMI, VIN positions 1-3, best-effort embedded table of common automakers) decode fully offline and deterministically, so those two ship. Model/Trim require a full manufacturer VDS/WMI pattern database that can't be meaningfully embedded client-side; rather than fabricate a guess, those two fields are left for manual entry after a scan, same as before. `decodeWmiMake`/`decodeModelYear` degrade to `null` (leaving the field untouched) for anything outside their known table — never a wrong guess.

**Scope decision — VIN check-digit validation gates every auto-fill path,** barcode or manual: `findValidVin` only returns a candidate that both matches the 17-char ISO 3779 alphabet and passes `validateVin`'s modulus-11 check, so a misread barcode or a typo'd manual entry never silently fills the form with garbage — the AC's "before auto-filling" requirement holds for both entry paths, not just the barcode one.

---

#### 1. `src/utils/vinScanner.js` (new)

**Pure, fully testable:** `normalizeVinText`, `isValidVinFormat`, `computeVinCheckDigit`/`validateVin` (ISO 3779/NHTSA position-weighted modulus-11), `extractVinCandidates`/`findValidVin` (token-based text parsing — normalizes per whitespace-delimited token so a label like "VIN: ‹vin›" doesn't merge into one run), `decodeModelYear` (position-10 code, 30-year-cycle resolved against a reference date), `decodeWmiMake` (best-effort WMI table), `isCameraSupported`/`isBarcodeDetectorSupported` (capability checks), `captureVideoFrame` (DI'd canvas-context frame grab).

**DOM/camera-dependent, but fully dependency-injected** (same DI precedent as `TenantConfigService`/`appraisalPdfGenerator`'s `document`/`URL` injection): `createVinScanner({ videoElement, mediaDevices, BarcodeDetectorClass, requestFrame, cancelFrame, onDetected, onError })` — real `navigator.mediaDevices`/`window.BarcodeDetector`/`requestAnimationFrame` default in a browser, fakes in tests. `start()` requests the back camera (`facingMode: 'environment'`), reports `{ reason: 'unsupported' }` or `{ reason: 'permission-denied' }` via `onError` and returns `false` without throwing, otherwise attaches the stream to `videoElement` and — only if `BarcodeDetector` is supported — runs a `requestFrame` scan loop calling `detector.detect(videoElement)` each tick, filtering results through `findValidVin` before firing `onDetected({ vin, source: 'barcode' })` and self-stopping. `stop()` cancels the frame loop and stops every media track (idempotent, safe pre-start or post-stop).

#### 2. `src/ui/SellerSubmissionView.js` (extended)

`renderVinScannerModal({ onVinConfirmed })` — local factory (same `{ overlay, open, close }` shape as `LeadInboxView.js`'s `renderDocumentModal`), reusing the `.modal`/`.modal-overlay` classes: a `<video>` viewfinder with a CSS reticle overlay, a live status line, a "type/paste VIN" fallback row (parsed via `findValidVin`), and Cancel. A new "📷 Scan VIN" button sits next to the VIN input (new `.vin-input-row` flex wrapper). On a confirmed VIN (barcode or manual): `controller.hapticsService?.vibrate?.()`, fill `vinInput`, and conditionally fill `yearInput`/`makeInput` from `decodeModelYear`/`decodeWmiMake` when they resolve — Model/Trim are left untouched per the scope decision above. Camera errors (unsupported/permission-denied/detect-failed) surface as an inline status message pointing at the same manual fallback field, so the AC's "graceful degradation" is the same code path as the deliberate manual-entry option, not a separate branch.

---

### Testing Summary (new)
- `tests/vinScanner.test.js` (new, 19 tests) — check-digit math against the codebase's existing fixture VIN (`1HGCM82633A004352`, reused from `tests/appraisalPdfGenerator.test.js`) plus a tampered/invalid case; format validation (length, I/O/Q rejection); token-based text-candidate extraction and end-to-end `findValidVin`; `decodeModelYear` across the 30-year cycle (incl. the `U`/`Z`/`0` codes that are never valid position-10 values) against a fixed reference date; `decodeWmiMake` known + unknown prefixes; capability-check branches; `captureVideoFrame` success + every no-op branch; `createVinScanner`'s full lifecycle — unsupported, permission-denied, camera-only (no `BarcodeDetector`), successful detection + self-stop, no-hit-keeps-scanning, and detector-throws-keeps-scanning — all against fake `mediaDevices`/`BarcodeDetectorClass`/frame-scheduler/video-element, no real browser APIs required.
- No dedicated new test coverage for the `SellerSubmissionView.js` button/modal wiring itself — untested View-render tier, same precedent as every prior UOW's `render*View`/`render*Modal` DOM functions.
- Coverage: `vinScanner.js` 100% line / 80.95% branch / 80.77% funcs (quality gate: 80%).
- Regression: `npm test` — 432 pass, the same 3 pre-existing, unrelated `tests/locationAdapter.test.js` env-dependent flakes noted since UOW-11 (confirmed identical failures, nothing new).
- Browser/Playwright check: **not performed this UOW** — no browser automation tooling (`chromium-cli`, `playwright`, or a DOM shim) is installed/available in this execution environment, and `getUserMedia`/`BarcodeDetector` require real camera hardware + a permission grant that headless automation can't meaningfully exercise regardless. Flagged to the Product Owner as a manual verification gap: test on an actual mobile device/browser that the "Scan VIN" button opens the camera, the reticle overlay renders, a real Code 39/128/DataMatrix barcode auto-fills VIN/Year/Make with a haptic buzz, and denying camera permission falls back cleanly to the manual VIN field.

### Other file touches
- `src/ui/styles.css` — additive `.vin-input-row`, `.scanner-modal*` rules (video viewport, reticle, status, manual-fallback row, actions). No changes to existing selectors.
- No changes to `src/ui/App.js` (hapticsService was already threaded onto `SellerSubmissionController`), `src/models/Submission.js`, `src/services/HapticsService.js`, or `src/utils/qrEncoder.js`/`appraisalPdfGenerator.js`.

## Execution Instruction
Architecture fully specified above, including the two scope calls (no real OCR engine, no NHTSA network call) that a Product Owner should sanity-check against expectations. Lead Developer (Claude Code) proceeded directly with implementation and verification per Fast-Path Protocol §3, flagging the unverifiable-in-this-environment browser check per §3's "unless explicit ambiguity exists" carve-out rather than silently marking it done.
