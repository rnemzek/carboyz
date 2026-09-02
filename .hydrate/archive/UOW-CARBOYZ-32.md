# Unit of Work Payload: UOW-CARBOYZ-32

**Title:** Adopt `@nemzilla/qr-core` for Lead Inbox Pairing QR (Scoped Dependency Exception)
**Target Scope:** `package.json`, `src/ui/LeadInboxView.js`

---

## 1. Context & Objective

The PO created a sibling package `@nemzilla/qr-core` (`../qr-core`, `npm install file:../qr-core`) exposing a single
async function `renderQrSvg(text, options) -> Promise<string>` backed by the third-party `qrcode` npm package. The
goal is to render the Lead Inbox "Pair Mobile Device" QR code through this new package instead of the hand-rolled
encoder.

**Dependency-boundary exception:** `CLAUDE.md` §2 requires client modules to stay zero-dependency/ESM-first unless
explicitly authorized here. This UOW authorizes `@nemzilla/qr-core` (and its transitive `qrcode` dependency) as a
production dependency of `carboyz`, scoped strictly to the pairing-card QR code in `LeadInboxView.js`.

**Discovered blast radius (why scope is narrower than originally requested):** `src/utils/qrEncoder.js`'s
`encodeQrMatrix`/`renderQrSvg` exports are also consumed by:
- `src/ui/TestHarnessView.js` (`renderQrBlock`-style live preview, uses `cellSize`/`margin` matrix options)
- `src/utils/appraisalPdfGenerator.js` (`renderQrBlock`, a **documented synchronous, DOM-free string builder** —
  "no DOM access, safe to call in any environment" — embedded into the appraisal PDF SVG via `<g transform>`)

`@nemzilla/qr-core` has no matrix-level API and no `cellSize`/`margin` controls, and is async-only. Rewriting
`qrEncoder.js`'s shared exports to delegate to it would force async into `appraisalPdfGenerator.js`'s sync contract
and drop the sizing controls both other consumers rely on. **Decision: `qrEncoder.js` is left untouched.** Only
`LeadInboxView.js` is changed, importing `renderQrSvg` from `@nemzilla/qr-core` directly (aliased on import to avoid
name collision with the existing `qrEncoder.js` `renderQrSvg`, which is no longer imported in this file).

---

## 2. Acceptance Criteria

- [ ] `package.json` lists `@nemzilla/qr-core: "file:../qr-core"` as a dependency (PO runs `npm install`; Dev verifies
      `node_modules/@nemzilla/qr-core` resolves before implementing).
- [ ] `src/ui/LeadInboxView.js` no longer imports `encodeQrMatrix`/`renderQrSvg` from `../utils/qrEncoder.js`.
- [ ] `src/ui/LeadInboxView.js` imports `renderQrSvg` from `@nemzilla/qr-core` (aliased, e.g.
      `renderQrSvg as renderPairingQrSvg`) and calls it with the pairing URL directly (no matrix step).
- [ ] The `generateBtn` click handler in `renderPairingCard` becomes `async` and `await`s the new `renderQrSvg` call
      before setting `qrContainer.innerHTML`.
- [ ] `src/utils/qrEncoder.js`, `src/ui/TestHarnessView.js`, and `src/utils/appraisalPdfGenerator.js` are **not
      modified** — they keep using the existing hand-rolled encoder unchanged.
- [ ] `tests/qrEncoder.test.js` and `tests/appraisalPdfGenerator.test.js` remain green, unmodified.
- [ ] Any existing test(s) covering `renderPairingCard`'s click handler are updated only as needed to await the now-
      async flow (e.g. `await` the click dispatch / flush microtasks) — no assertions on QR visual output should
      need to change since output is still an `<svg>` string assigned to `innerHTML`.
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% (581+ tests, no regressions).

---

## 3. Surgical Implementation Plan

1. **Verify link:** confirm `node_modules/@nemzilla/qr-core` resolves (`node -e "import('@nemzilla/qr-core')"`) and
   `package.json` was updated by the PO's `npm install file:../qr-core`. Do not proceed until this is true.
2. **`src/ui/LeadInboxView.js`:**
   - Replace `import { encodeQrMatrix, renderQrSvg } from '../utils/qrEncoder.js';` with
     `import { renderQrSvg as renderPairingQrSvg } from '@nemzilla/qr-core';`
   - In `renderPairingCard`, make the `generateBtn` click listener `async`.
   - Replace `const svgMarkup = renderQrSvg(encodeQrMatrix(url, { errorCorrectionLevel: 'L' }));` with
     `const svgMarkup = await renderPairingQrSvg(url, { errorCorrectionLevel: 'L' });`, keeping the existing
     comment about EC level choice (still applies — passed straight through to `qrcode`).
3. **Find/update any test(s)** exercising the pairing-card QR generation to await the async handler.
4. **Run `npm test`**; confirm 100% pass, no regressions in `qrEncoder`/`appraisalPdfGenerator`/`TestHarnessView`
   suites (unchanged files, should be unaffected).
5. Log completion to `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md` (implementation detail + files touched)
   and `.hydrate/ARCHITECT_JOURNAL.md` (dependency-boundary exception granted, scope-narrowing rationale).
6. Archive this file to `.hydrate/archive/UOW-CARBOYZ-32.md` on completion.
