Let's reconcile our units of work and implement UOW-47.

1. Note: The Offer Fixture Management Onboarding Guide (commit abfa747) is logged as UOW-46 in .hydrate/PROJECT_JOURNAL.md.
2. We are now implementing UOW-47 (Two-Tier Counter Offers: No-VIN Conditional vs. Verified-VIN Guaranteed).

Here is the specification for UOW-47:

Context & Objectives:
Sellers uploading estimate screenshots often do not have their VIN on hand. Rather than blocking the submission, we will support a two-tier counter model:
1. No-VIN Counter: Displays a conservative conditional beat using base Year/Make/Model rules.
2. Verified-VIN Counter: Unlocks the full aggressive beat and guaranteed appraisal sheet once the VIN is provided.

Objectives:

1. Spread Engine & Configuration (SpreadConfigService & SpreadService):
   - Update tier pricing configuration to define separate margins/beat bumps for:
     - noVinEstimate (conservative bump, e.g. +$250-$300)
     - verifiedVin (aggressive bump, e.g. +$500-$1000)
   - Allow SpreadService.calculateSpread() to execute without a VIN if offerSourceType === 'ESTIMATE', falling back to generic base-model wholesale values.

2. Submission View Funnel (SellerSubmissionView.js):
   - Remove the hard client-side submit block on missing VIN when an estimate offer is detected.
   - When no VIN is present, display the preliminary counter with an "Unlock Maximum Offer" CTA encouraging the seller to enter the VIN.
   - If the seller types/scans a VIN, dynamically upgrade the calculation to the verified tier in real-time.

3. Persistence & Lead Inbox (DispatchService & LeadInboxView.js):
   - Track submission status: "NO_VIN_ESTIMATE" vs "VERIFIED_ESTIMATE" vs "FIRM_OFFER".
   - In LeadInboxView, render distinct badges:
     - [PRELIMINARY - NO VIN] (amber/outline)
     - [ESTIMATE COUNTER] (amber/solid)
     - [FIRM COUNTER] (green/solid)

4. Tests & Verification:
   - Add integration tests verifying calculation of both tiers for the Carvana Jeep screenshot fixture (with and without seed VIN).
   - Ensure all 650+ existing tests pass without regressions.
   - Update .hydrate/PROJECT_JOURNAL.md upon completion.
   - Commit with: "feat(pricing): add two-tier counter-offers for no-vin estimates vs verified vin"
