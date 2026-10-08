import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApp } from '../../src/server/index.js';
import { TelemetryService } from '../../src/services/TelemetryService.js';
import { IngestService } from '../../src/services/IngestService.js';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { SpreadConfigService } from '../../src/services/SpreadConfigService.js';
import { DispatchService, DISPATCH_OUTCOMES } from '../../src/services/DispatchService.js';
import { generateAppraisalDocument } from '../../src/utils/appraisalPdfGenerator.js';
import { createTenantConfig } from '../../src/config/tenantConfig.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'fixtures', 'offers');

// UOW-44's spec names the fixture public/fixtures/offers/55DF9D5E-0F8B-42A2-A048-1EE712D43F48
// (HEIC/JPEG) — that file doesn't exist in this repo; it's presumably the raw iPhone library
// filename before UOW-42 ingested and renamed the screenshot. The file matching UOW-44's exact
// described scenario (Carvana, $13,100, 2020 Jeep Wrangler Unlimited estimate, no VIN) already
// exists as this fixture, hashed into offerParser.js's IMAGE_FIXTURES table — using it here.
const ESTIMATE_FIXTURE_FILE = 'carvana-estimated-offer-screenshot.jpeg';
const KNOWN_TEST_VIN = '1HGCM82633A004352';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function readFixtureBase64(name) {
  return readFileSync(join(FIXTURES_DIR, name)).toString('base64');
}

/**
 * Independently re-derives the configured tier markup from raw tier data (mirroring, but not
 * calling, SpreadService's matchTier/evaluateTierOffset) — this is the test's own double-check of
 * the formula against whatever SpreadConfigService currently returns, not a re-run of the
 * production code path under test.
 */
function computeExpectedMarkup(tierConfig, competitorOfferAmount) {
  const tier = tierConfig.find(
    (candidate) =>
      competitorOfferAmount >= candidate.minPrice && (candidate.maxPrice === null || competitorOfferAmount < candidate.maxPrice),
  );
  assert.ok(tier, `expected a configured tier to match a $${competitorOfferAmount} competitor offer`);

  const flatMarkup = tier.flatAmount ?? 0;
  const percentMarkup = competitorOfferAmount * (tier.percent ?? 0);
  if (tier.strategy === 'FLAT_ONLY') return flatMarkup;
  if (tier.strategy === 'PERCENT_ONLY') return percentMarkup;
  return Math.max(flatMarkup, percentMarkup);
}

test('Golden path: estimate image -> parse -> spread math -> persisted lead -> conditional appraisal SVG', async () => {
  // --- Phase 1: image ingestion & parsing, through the real HTTP route ---
  const app = createApp();
  const documentBase64 = readFixtureBase64(ESTIMATE_FIXTURE_FILE);
  const parseRes = await app.request('/api/offers/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentBase64, mimeType: 'image/jpeg' }),
  });
  const parseBody = await parseRes.json();

  assert.equal(parseRes.status, 200);
  assert.equal(parseBody.success, true);
  // extracted.vin is omitted entirely (not present as a key) rather than explicitly null — same
  // "only present when found" contract as every other field offerParser.js extracts.
  assert.equal(parseBody.extracted.vin, undefined);
  assert.equal(parseBody.extracted.isEstimate, true);
  assert.equal(parseBody.extracted.competitorName, 'Carvana');
  assert.equal(parseBody.extracted.competitorOffer, 13100);
  assert.equal(parseBody.extracted.year, 2020);
  assert.equal(parseBody.extracted.make, 'Jeep');
  assert.equal(parseBody.extracted.model, 'Wrangler Unlimited');

  // --- Phase 2: pricing & spread verification, double-checked against the live config ---
  const tenantId = 'golden-pipeline-t1';
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId });
  const submissionService = new SubmissionService({ tenantId });
  const spreadConfigService = new SpreadConfigService({ tenantId });
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

  // A market comp so fair market value resolves instead of NO_DATA.
  ingestService.intake({ dealerId: 'dA', make: 'Jeep', model: 'Wrangler Unlimited', year: 2020, price: 18000 });

  // The estimate screen never has a VIN (that's the point) — a known test VIN completes the
  // submission payload the same way a seller supplying it manually would.
  const submission = submissionService.submit({
    vin: KNOWN_TEST_VIN,
    year: parseBody.extracted.year,
    make: parseBody.extracted.make,
    model: parseBody.extracted.model,
    mileage: 42000,
    zipCode: '28451',
    competitor: parseBody.extracted.competitorName,
    competitorOfferAmount: parseBody.extracted.competitorOffer,
    offerSourceType: parseBody.extracted.isEstimate ? 'ESTIMATE' : 'FIRM_OFFER',
  });

  // Dynamically load the currently configured spread tiers (not a hardcoded assumption) and
  // independently recompute the expected markup/counter/margin from them.
  const tierConfig = spreadConfigService.getTiersForCompetitor(submission.competitor);
  const expectedMarkup = computeExpectedMarkup(tierConfig, submission.competitorOfferAmount);
  const expectedCounterAmount = submission.competitorOfferAmount + expectedMarkup;

  const marketStats = telemetryService.getMarketStats(ingestService.getInventory(), {
    make: submission.make,
    model: submission.model,
    year: submission.year,
  });
  const expectedWholesaleValue = marketStats.average * 0.88; // SpreadService.WHOLESALE_FACTOR
  const expectedProjectedMargin = expectedWholesaleValue - expectedCounterAmount;

  const { submission: dispatched, outcome } = dispatchService.dispatch(submission);

  assert.equal(dispatched.calculatedCounterOffer, expectedCounterAmount);
  assert.equal(dispatched.finalCounterOffer, expectedCounterAmount);
  assert.equal(dispatched.projectedMargin, expectedProjectedMargin);
  assert.equal(dispatched.priceTierBucket, '10k-20k');
  assert.equal(dispatched.offerSourceType, 'ESTIMATE');

  // --- Phase 3: artifact / appraisal verification ---
  // The auto-dispatch outcome is what gives this submission a finalCounterOffer, which the
  // appraisal generator requires — asserted explicitly so a future config change that pushes this
  // fixture onto the manual-approval path fails loudly here instead of silently in Phase 3.
  assert.equal(outcome, DISPATCH_OUTCOMES.AUTO_COUNTER_SENT);

  const { svgMarkup } = generateAppraisalDocument({
    submission: dispatched,
    tenantConfig: createTenantConfig({ name: 'CarBoyZ Motors' }),
  });

  assert.match(svgMarkup, /Conditional Counter-Offer \(Pending Vehicle Inspection &amp; VIN Verification\)/);
  assert.ok(
    svgMarkup.includes(currencyFormatter.format(expectedCounterAmount)),
    `expected the appraisal SVG to contain the formatted counter ${currencyFormatter.format(expectedCounterAmount)}`,
  );
});
