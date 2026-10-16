# Unit of Work: UOW-51
# Title: Streamlined 3-Pillar Customer Intake (VIN, Mileage, Offer Doc)

- [ ] Task 1: Update Submission Model & Validation Guards (src/client/models/Submission.js)
  - Enforce mandatory presence of the 3 required pillars on submission payload:
    - vin (string, required, valid 17-char VIN)
    - mileage (positive number, required)
    - offerDocument (string/base64 payload, required)
  - Relax zipCode: update model validation to make zipCode optional (string or null).
  - Derive or preserve auto-populated vehicle specs (year, make, model, trim) from VIN decode or document OCR extraction without requiring manual form entry.
  - Preserve competitor and competitorOfferAmount extracted from document parsing; fallback gracefully when review is required.

- [ ] Task 2: Streamline Seller Intake UI (src/client/views/SellerSubmissionView.js)
  - Strip redundant manual text inputs from the initial form layout: remove Year, Make, Model, and Trim inputs.
  - Update upload dropzone copy and button label to: "Offer Document or Screenshot of Offer Document" (accepts images & PDFs).
  - Lay out the streamlined form focusing strictly on the required pillars:
    1. Offer Document / Screenshot dropzone & camera trigger
    2. VIN input with "Scan VIN" camera button
    3. Mileage input (numeric, labeled "Current Mileage")
    4. ZIP Code input (explicitly labeled "ZIP Code (Optional)")
  - Auto-fill VIN, mileage, and offer details via existing requestOfferParse() and resolveVehicleFromVin() services upon document drop or barcode scan.
  - Provide a compact, collapsible "Extracted Offer Details" review chip/drawer that appears after upload showing extracted competitor, amount, and decoded vehicle specs with an option to edit before final submission.

- [ ] Task 3: Controller & Form Value Mapping (src/client/SellerSubmissionController.js)
  - Update mapExtractedOfferToFormValues() and submitSubmission() to enforce the 3 pillars before dispatch.
  - Ensure missing optional zipCode defaults cleanly to null without causing runtime errors or validation rejections.
  - Add client-side validation feedback disabling or warning on the submit action until all 3 pillars (VIN, Mileage, Offer Document) are provided.

- [ ] Task 4: Testing & Quality Gates
  - Unit tests for Submission model: assert validation fails if vin, mileage, or offerDocument is missing, and passes when zipCode is null.
  - Controller tests verifying form submission handles optional zipCode and maps parsed document data directly into the submission payload.
  - View layout tests asserting the streamlined inputs render and manual year/make/model fields are removed from the default view.
  - Ensure all 744+ existing tests pass without regressions (update test fixtures where zipCode was previously asserted as mandatory).
  - Append completion records to .hydrate/PROJECT_JOURNAL.md, DEV_JOURNAL.md, and ARCHITECT_JOURNAL.md.
  - Archive active spec to .hydrate/archive/UOW-51.md.
  - Commit with: "feat(intake): streamline seller intake to 3 pillars (vin, mileage, offer doc)"
