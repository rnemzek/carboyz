# Unit of Work Payload: UOW-CARBOYZ-30

**Title:** QR Code Rendering Hotfix: Standard Palette Contrast & Quiet Zone
**Target Scope:** `src/utils/qrEncoder.js`, `src/ui/LeadInboxView.js`

---

## 1. Context & Objective
Fix QR code recognition failure on mobile camera scanners caused by inverted color palette rendering (light-on-dark) and missing quiet zone padding. Force `qrEncoder.generateQRCodeSVG()` to render standard dark `#000000` modules on a light `#FFFFFF` background with a mandatory quiet zone margin, ensuring instant optical recognition on iOS and Android devices.

---

## 2. Acceptance Criteria
- [ ] **Standard High-Contrast Palette:** `qrEncoder.generateQRCodeSVG()` outputs black (`#000000`) modules on a solid white (`#FFFFFF`) background rectangle, regardless of the active UI dark theme.
- [ ] **Mandatory Quiet Zone:** Ensure a minimum 4-module solid white margin surrounds all four edges of the generated QR matrix.
- [ ] **Crisp Pixel Rendering:** Add `shape-rendering="crispEdges"` to the root SVG element to prevent anti-aliasing blur across screen resolutions.
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100% of existing 574 tests plus updated unit tests covering SVG palette output.

---

## 3. Surgical Implementation Plan
1. **QR Palette Enforcement:** Update `qrEncoder.js` to default fill colors to `#000000` for modules and `#FFFFFF` for the background canvas.
2. **Padding Margin:** Add explicit quiet-zone offset calculation in the SVG string generator.
3. **Container Isolation:** In `LeadInboxView.js`, wrap the QR SVG in a dedicated high-contrast card container with vertical spacing above the status text.
4. **Unit Verification:** Update `tests/utils/qrEncoder.test.js` to assert `#FFFFFF` background and `#000000` module attributes.
