# Unit of Work Payload: UOW-CARBOYZ-31

**Title:** QR Code Layout Refinement & Payload Density Reduction
**Target Scope:** `src/utils/qrEncoder.js`, `src/ui/LeadInboxView.js`, `public/styles.css`

---

## 1. Context & Objective
Refine the QR code rendering aesthetic and fix camera lock-on failures by reducing matrix payload density and centering the high-contrast white card container.

---

## 2. Acceptance Criteria
- [ ] **Compact Matrix Density:** Reduce QR encoding payload / error correction to produce a low-version matrix (large, highly readable modules).
- [ ] **Symmetrical Card Layout:** Clamp `.pairing-card__qr` to a centered square container (`max-width: 280px; aspect-ratio: 1 / 1; margin: 16px auto; padding: 16px; border-radius: 12px; background: #FFFFFF;`).
- [ ] **QR Matrix Scaling:** Ensure the inner SVG scales cleanly to fill the padded square card without horizontal stretch or excess whitespace.
- [ ] **Quality Gate & Zero Regression:** `npm test` passes 100%.

---

## 3. Surgical Implementation Plan
1. **`src/utils/qrEncoder.js`:** Update encoding settings to use low/medium error correction and minimal URL path length.
2. **`public/styles.css`:** Update `.pairing-card__qr` with strict max-width, square aspect ratio, and rounded corners.
3. **`tests/utils/qrEncoder.test.js`:** Update test suite to assert compact matrix module boundaries and container classes.
