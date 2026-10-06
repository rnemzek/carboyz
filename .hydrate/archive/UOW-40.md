# UOW-40: Server-Side Offer Document Extraction & Auto-Population

## Goal & Context
Close the primary automation gap in the Offer-to-Counter pipeline. Currently, `SellerSubmissionView` reads uploaded PDFs and screenshots as opaque Base64 strings without extraction, requiring manual form entry. 

This UOW introduces a backend Hono endpoint (`POST /api/offers/parse`) to extract competitor offer details (offer price, VIN, competitor name, and vehicle metadata) and wires the frontend dropzone to auto-populate the submission form upon file drop, preserving client zero-dependency boundaries and existing 80%+ test coverage.

## Architectural Constraints
- **Client Zero-Dependency Boundary:** All document parsing and text/OCR heuristics execute on the Hono backend. The frontend remains ESM-only with native fetch.
- **Graceful Fallbacks:** If the parser encounters a low-confidence parse or missing fields, it returns partial results without throwing or failing the dropzone upload; the seller can still edit the populated form fields.
- **Storage Contract:** Parsed data hydrates form fields while preserving the original Base64 `offerDocument` on the `Submission` model for rep inspection.

## Surgical Scope
1. **Server Parser Endpoint (`server/` or `src/server/`):**
   - Implement `POST /api/offers/parse` on Hono.
   - Accept payload: `{ documentBase64: string, mimeType: string }`.
   - Implement extraction logic targeting major competitors (CarMax, Carvana, KBB, Driveway, generic dealership offer sheets).
   - Return structured schema:
     ```json
     {
       "success": true,
       "extracted": {
         "competitorOffer": 24500,
         "competitorName": "CarMax",
         "vin": "1HGCR2F83HA000000",
         "year": 2017,
         "make": "Honda",
         "model": "Accord",
         "mileage": 62000
       },
       "confidence": { "competitorOffer": 0.95, "vin": 0.99 }
     }
     ```
2. **Client Auto-Population Wire (`src/views/SellerSubmissionView.js` & Controller):**
   - Intercept dropzone completion (`readFileAsBase64`).
   - Call `POST /api/offers/parse` in the background.
   - Dispatch or update form input values dynamically with extracted data.
   - Retain manual override capability for any input field.
3. **Automated Test Coverage:**
   - Unit tests for the parser extraction service with test fixtures (sample offer text/payloads).
   - Integration test for `POST /api/offers/parse` validating successful parse and malformed fallback handling.
   - Maintain $\ge$ 80% line and branch test coverage.

## Acceptance Criteria
- [ ] `POST /api/offers/parse` endpoint is registered and active on the Hono server.
- [ ] Uploading a competitor offer document via `SellerSubmissionView` auto-populates `competitorOffer`, `vin`, and vehicle metadata without client-side external dependencies.
- [ ] Form remains fully editable after auto-population.
- [ ] Existing `SpreadService` and `SpreadConfigService` auto-calculate the counter offer as soon as the parsed `competitorOffer` populates.
- [ ] All unit and integration tests pass via `npm test` with zero regressions (597+ passing).
