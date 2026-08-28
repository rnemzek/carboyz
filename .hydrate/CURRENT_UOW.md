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

### UOW-18 — Branded PDF Counter-Offer Appraisal Sheet Generator

**Objective**
Build a client-side Counter-Offer Appraisal Sheet Generator that produces a crisp, downloadable, tenant-branded official appraisal document whenever a counter-offer is generated (auto or manually approved).

**Acceptance Criteria** (as given by Product Owner)
1. Document Generator Utility (`src/utils/appraisalPdfGenerator.js`) — zero-dependency client-side generator rendering an official 8.5"x11" printable appraisal document: header (tenant logo, business name, contact info, "Official Counter-Offer Appraisal" title), vehicle summary (year/make/model/trim/mileage/VIN), competitor comparison (competitor name, original competitor offer, CarBoyZ spread offset, guaranteed counter-offer amount highlighted in tenant accent color), embedded QR verification code (leveraging `qrEncoder.js` from UOW-15) linking to a live status page, and terms/disclaimers (7-day expiration, 250-mile allowance, inspection disclaimer).
2. UI Integration — "Download Appraisal Sheet" button on `AUTO_COUNTER_SENT`/`MANUAL_APPROVED` lead cards in `LeadInboxView.js`; "Download Guaranteed Offer Sheet" button on the seller's resolved waiting screen in `SellerSubmissionView.js`.
3. Testing — `tests/appraisalPdfGenerator.test.js` verifying payload assembly, data formatting, and DOM Blob/download-trigger execution, ≥80% line/branch coverage on testable exports; full `npm test` regression.

### Prior UOW
UOW-17's staged content archived to `.hydrate/archive/UOW-17.md` (shipped and committed as `f5c7434`).

### Architecture (Lead Architect step)

Fast-Path eligible: one new pure-utility module plus additive button wiring in two existing views, no breaking contract changes.

**Reconciliation note — "AUTO_COUNTER_SENT or MANUAL_APPROVED" is a single condition, not two.** `Submission.status` only ever takes the value `'AUTO_COUNTER_SENT'` for a dispatched counter-offer — both `DispatchService.dispatch()`'s auto path and `LeadInboxController.approveAndSend()`'s human-approved path set `status: 'AUTO_COUNTER_SENT'`; `MANUAL_APPROVED` only ever appears as `winLossStatus` (see `TestHarnessView.js`'s own `HISTORICAL_OUTCOME_PRESETS`, which pairs `winLossStatus: 'MANUAL_APPROVED'` with `status: 'AUTO_COUNTER_SENT'`). So the Lead Inbox button condition is simply `lead.status === 'AUTO_COUNTER_SENT'` — it already covers both dispatch outcomes named in the AC.

**Format decision — SVG, not a hand-rolled PDF binary.** The ticket's own framing ("pure SVG / HTML5 Canvas rendering... zero-dependency") and the existing `qrEncoder.js` precedent (which already renders QR codes as SVG string markup, no Canvas) point the same direction: `renderAppraisalSvg` builds one self-contained SVG document string (816×1056 — 8.5"×11" @ 96dpi), downloaded as a `.svg` file. SVG is natively printable (browser Print → Save as PDF) and opens as an image in every viewer, satisfying "PDF/Image" without implementing a PDF byte-stream writer. No Canvas rasterization step is added — it would only be needed for a PNG variant, which no AC line asks for, and would move the whole render path into the untested DOM/Image tier for no required gain.

**Contract decision — the generator takes the raw `Submission`, not a view's flattened lead object.** `LeadInboxController.buildLeadViewModels()` and the seller waiting-screen's stash entry both intentionally expose trimmed shapes (no `vin`/`trim`/`finalCounterOffer`/`initialCompetitorOffer` on the lead view model; the stash entry only has `submissionId`/`finalCounterOffer`). Rather than widening those flattened shapes (risking drift from their existing, already-tested contracts), both controllers get one new **1-line lookup method** — `LeadInboxController.getSubmission(id)` / `SellerSubmissionController.getSubmission(id)`, both `this.submissionService.getSubmissions().find((s) => s.id === id) ?? null` — and the two Views call that at button-click time to hand the generator the canonical `Submission`.

---

#### 1. `src/utils/appraisalPdfGenerator.js` (new)

Same split-for-testability precedent as `iconNormalizer.js`/`TenantConfigService.js`: pure payload/string-building functions are fully unit-tested; the one DOM-touching function is unit-tested too, but only because it's fully dependency-injected (same precedent as `TenantConfigService`'s injectable `createManifestUrl`/`revokeManifestUrl`) rather than because it's simple enough to fake.

**Constants:** `EXPIRATION_WINDOW_DAYS = 7`, `MILE_ALLOWANCE_MILES = 250`, `DOCUMENT_WIDTH = 816`, `DOCUMENT_HEIGHT = 1056`.

**Pure, testable:**
- `buildVerificationUrl(baseUrl, submission)` → `` `${baseUrl}?tab=sell&sid=${encodeURIComponent(submission.id)}` ``. Deep-links back into the same zero-backend PWA (submissions are tenant-scoped `localStorage`, per `SubmissionService`) — consistent with `TestHarnessView.js`'s existing `buildPrefillUrl` pattern of encoding app state into a query string rather than inventing a server route.
- `buildAppraisalPayload({ submission, tenantConfig, verificationBaseUrl = '', now = new Date() })` → pure orchestrator assembling every formatted string the renderer needs: tenant block (`name`, `logoUrl`, `accentColor` from `tenantConfig.themeColors.accent ?? themeColors.primary`, `contactPhone`, `contactEmail`), vehicle block (`titleLine`, `mileageLabel`, `vin`), competitor block (`name` — reuses the same `competitor === 'Other' ? competitorDealerName : competitor` logic already duplicated in `LeadInboxController.js`/`DispatchService.js`, `originalOfferLabel`, `spreadOffsetLabel` (signed), `guaranteedCounterOfferLabel`), `verificationUrl`, `generatedAtLabel`/`expiresAtLabel` (`now` + `EXPIRATION_WINDOW_DAYS`, injectable `now` for deterministic tests), and a 3-line `disclaimers` array (expiration, mile allowance, inspection). Throws if `submission`, `tenantConfig`, or `submission.finalCounterOffer` is missing — the button only ever calls this for a dispatched lead, so a missing `finalCounterOffer` means a caller bug, not a runtime state to handle gracefully.
- `buildAppraisalFilename(payload)` → pure slug: `` `${slugify(tenant.name)}-appraisal-${vin}.svg` ``.
- `renderAppraisalSvg(payload)` → pure string builder, same shape as `qrEncoder.js`'s `renderQrSvg` (no DOM access, safe in any environment). Builds the full document: header band in `tenant.accentColor`, logo `<image href="...">` when `logoUrl` is set else an initials-circle fallback (same fallback *concept* as `App.js`'s `renderBrandLogo`, reimplemented locally as a few lines — importing `ui/branding.js`'s `getBrandInitials` from a `utils/` module would invert the existing ui→utils dependency direction), vehicle summary rows, a competitor-comparison box border/highlight in `tenant.accentColor` with the three dollar amounts, the verification QR (`encodeQrMatrix`/`renderQrSvg` from `./qrEncoder.js`, nested directly as a child `<svg>` element — SVG natively supports nesting, so no data-URI re-encoding needed), and the disclaimers block. All interpolated strings pass through a local `escapeXml()` helper (tenant/competitor names are free text). VIN is rendered as large monospace text, not a barcode symbol — no barcode-symbology utility exists in this codebase and the zero-dependency constraint rules out adding one; text is the fallback, same kind of scope-trim as UOW-17's icon-normalizer "contain not cover" note.
- `generateAppraisalDocument({ submission, tenantConfig, verificationBaseUrl, now })` → pure composition of the three functions above, returns `{ payload, svgMarkup, filename }`.

**DOM-dependent, but DI-tested (not the untested View tier):**
- `triggerAppraisalDownload(svgMarkup, filename, { document = defaultDocument(), createObjectUrl = (blob) => URL.createObjectURL(blob), revokeObjectUrl = (url) => URL.revokeObjectURL(url) } = {})` → builds `new Blob([svgMarkup], { type: 'image/svg+xml' })` (real global `Blob`, same as `TenantConfigService`'s real-`Blob`-but-injected-`createManifestUrl` split), creates a hidden `<a download>` via the injected `document`, clicks it, revokes the object URL. No-ops (`return false`) when `document` is null (SSR/non-browser safety, same precedent as `TenantConfigService.applyTenant`). Unit-tested against the same kind of fake `document`/fake `<a>` element already used in `tests/tenantConfigService.test.js`.
- `downloadAppraisalSheet({ submission, tenantConfig, verificationBaseUrl, now, document, createObjectUrl, revokeObjectUrl } = {})` → thin composition of `generateAppraisalDocument` + `triggerAppraisalDownload`; this is the one function the two Views call directly.

---

#### 2. `src/ui/LeadInboxController.js` — additive method

`getSubmission(id) { return this.submissionService.getSubmissions().find((submission) => submission.id === id) ?? null; }` — same lookup `approveAndSend` already does inline, extracted so the View can reach the raw `Submission`.

#### 3. `src/ui/LeadInboxView.js`

`renderLeadInboxView(controller, { onSendCounter, tenantConfig } = {})` gains `tenantConfig` in its options bag. In `renderLeadCard`'s `lead.status === 'AUTO_COUNTER_SENT'` branch, add a second button next to "Send Counter": `"Download Appraisal Sheet"`, wired to a new `onDownloadAppraisal(lead.id)` callback threaded through `renderList()` the same way `onViewDocument`/`onApproveAndSend` already are. The callback calls `downloadAppraisalSheet({ submission: controller.getSubmission(id), tenantConfig, verificationBaseUrl: \`${window.location.origin}${window.location.pathname}\` })` — same `window.location` composition `TestHarnessView.js`'s `generate()` already uses for its QR URL.

#### 4. `src/ui/SellerSubmissionController.js` — additive method

Same one-line `getSubmission(id)` addition as §2 (`this.submissionService.getSubmissions().find(...)`).

#### 5. `src/ui/SellerSubmissionView.js`

`renderSellerSubmissionView(controller, { sessionStashService, prefill, tenantConfig } = {})` gains `tenantConfig`. Inside `startWaitingForApproval`'s `resolve(entry)` (fires once, guarded by the existing `settled` flag, when the stash entry flips to `READY`), after the "Offer Ready!" message is set: look up `controller.getSubmission(entry.submissionId)`, and if found, append a `"Download Guaranteed Offer Sheet"` button to `waitingScreen` wired to the same `downloadAppraisalSheet(...)` call as §3. Only reachable on the `PENDING_APPROVAL` → human-approved path (the only path that ever calls `startWaitingForApproval` — the auto-dispatch path returns no `pendingSessionId`), which is exactly the "waiting/resolution screen" the AC names.

#### 6. `App.js` wiring

Pass `tenantConfig: activeTenantConfig` into both existing `renderLeadInboxView(...)` and `renderSellerSubmissionView(...)` call sites in `render()`. No new services, no new per-tenant state — `activeTenantConfig` is already in scope.

---

### Testing Summary (new)
- `tests/appraisalPdfGenerator.test.js` (new) — `buildVerificationUrl` encoding; `buildAppraisalPayload` (throws on missing submission/tenantConfig/finalCounterOffer, `initialCompetitorOffer` vs `competitorOfferAmount` fallback, signed spread-offset formatting, `'Other'`+dealer-name competitor label, `now`-relative expiration date, disclaimers content); `buildAppraisalFilename` slugging; `renderAppraisalSvg` (correct root `width`/`height`, all formatted values present, XML-escaping of a name containing `<`/`&`, logo `<image>` vs initials-fallback branch, nested QR `<svg>` present); `triggerAppraisalDownload` (no-op on `document: null`; with a fake document — Blob content/type, `<a>` `href`/`download` attributes, `.click()` invoked, `revokeObjectUrl` called with the created URL); `downloadAppraisalSheet` composition.
- No dedicated new test coverage for the `LeadInboxView.js`/`SellerSubmissionView.js` button wiring itself — untested View-render tier, consistent with every prior UOW's precedent (`AnalyticsView.js`, `BottomNavView.js`, `PwaInstallPromptView.js`'s `render*` half, etc.). `LeadInboxController.getSubmission`/`SellerSubmissionController.getSubmission` are trivial one-line lookups exercised indirectly by existing controller tests' submission fixtures; add one direct assertion each to `tests/ui.leadInboxController.test.js` / `tests/ui.sellerSubmissionController.test.js` for completeness.
- Regression: full `npm test` must stay green (the same pre-existing `tests/locationAdapter.test.js` env flakes noted since UOW-11 remain the only expected failures).
- Coverage: 80% line/branch standard applies to `appraisalPdfGenerator.js` in full (pure exports **and** `triggerAppraisalDownload`/`downloadAppraisalSheet`, since both are DI-tested, not DOM-untested).
- Manual/Playwright browser check: approve-and-send a lead in the Lead Inbox, click "Download Appraisal Sheet", confirm an `.svg` file downloads containing the tenant name, vehicle, VIN, competitor amounts, and a scannable QR; submit a seller intake that lands `PENDING_APPROVAL`, approve it from the Lead Inbox, confirm the seller's waiting screen resolves and shows "Download Guaranteed Offer Sheet"; switch tenants and re-download to confirm branding (name/logo/accent color) updates; zero console errors throughout.

### Other file touches
- `src/ui/LeadInboxController.js` — additive `getSubmission(id)` (§2).
- `src/ui/LeadInboxView.js` — additive `tenantConfig` option + download button (§3).
- `src/ui/SellerSubmissionController.js` — additive `getSubmission(id)` (§4).
- `src/ui/SellerSubmissionView.js` — additive `tenantConfig` option + download button (§5).
- `src/ui/App.js` — thread `tenantConfig` into both render calls (§6).
- No changes to `src/utils/qrEncoder.js`, `src/services/TenantConfigService.js`, `src/config/tenantConfig.js`, `src/models/Submission.js`, `DispatchService.js`, or `src/ui/styles.css` (existing `.button`/`.button--secondary`/`.card__actions` classes are reused as-is — no new CSS needed).

## Execution Instruction
Architecture fully specified above. Lead Developer (Claude Code) to proceed directly with implementation and verification per Fast-Path Protocol §3 (One-Shot Context Transition) — no secondary plan-approval cycle required before writing code.
