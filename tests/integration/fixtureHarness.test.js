import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApp } from '../../src/server/index.js';
import { mapExtractedOfferToFormValues } from '../../src/ui/offerAutoPopulate.js';
import { TelemetryService } from '../../src/services/TelemetryService.js';
import { IngestService } from '../../src/services/IngestService.js';
import { SubmissionService } from '../../src/services/SubmissionService.js';
import { SpreadConfigService } from '../../src/services/SpreadConfigService.js';
import { DispatchService } from '../../src/services/DispatchService.js';
import { generateAppraisalDocument } from '../../src/utils/appraisalPdfGenerator.js';
import { createTenantConfig } from '../../src/config/tenantConfig.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, '..', '..', 'public', 'fixtures', 'offers');
const MANIFEST_PATH = join(HERE, '..', 'fixtures', 'manifest.json');

// Every field offerParser.js can ever populate on `extracted` — asserted both when a manifest
// entry expects it (exact-match) and when it doesn't (must stay absent), so this harness catches
// extraction drift in either direction, not just "found less than expected."
const EXTRACTABLE_KEYS = ['vin', 'year', 'make', 'model', 'mileage', 'competitorOffer', 'competitorName', 'isEstimate'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const CONDITIONAL_LABEL = 'Conditional Counter-Offer (Pending Vehicle Inspection &amp; VIN Verification)';
const GUARANTEED_LABEL = 'Guaranteed Competitor Beat Offer';

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function readFixtureBase64(filename) {
  return readFileSync(join(FIXTURES_DIR, filename)).toString('base64');
}

/** Independently re-derives the configured tier markup from raw tier data — see UOW-44's golden
 * test for why this mirrors (rather than calls) SpreadService's matchTier/evaluateTierOffset. */
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

const manifest = readManifest();

const NON_FIXTURE_EXTENSIONS = new Set(['.json', '.md']);

test('fixture manifest covers every raw offer document in public/fixtures/offers/ (excluding .json/.md housekeeping files)', () => {
  // Raw offer documents are every file in the directory except .json (a fixture's own metadata
  // companion like carmax-offer.json, or the pre-existing fixture-miner index manifest.json) and
  // .md (this directory's README.md) — none of those is itself something a seller would upload.
  // New raw fixtures (another screenshot, a PDF, a trade slip) land here automatically and must
  // be registered in tests/fixtures/manifest.json or this test fails loudly instead of the
  // harness silently never exercising them.
  const rawFixtureFiles = readdirSync(FIXTURES_DIR).filter(
    (name) => !NON_FIXTURE_EXTENSIONS.has(name.slice(name.lastIndexOf('.'))),
  );
  assert.deepEqual(
    manifest.entries.map((entry) => entry.filename).sort(),
    rawFixtureFiles.sort(),
  );
});

for (const entry of manifest.entries) {
  test(`fixture golden path: ${entry.filename}`, async () => {
    // --- Stage 1: extraction, through the real HTTP route ---
    const app = createApp();
    const documentBase64 = readFixtureBase64(entry.filename);
    const parseRes = await app.request('/api/offers/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentBase64, mimeType: entry.mimeType }),
    });
    const parseBody = await parseRes.json();

    assert.equal(parseRes.status, 200);
    assert.equal(parseBody.success, true);

    const extracted = parseBody.extracted;
    for (const key of EXTRACTABLE_KEYS) {
      if (key in entry.expectedExtraction) {
        assert.equal(extracted[key], entry.expectedExtraction[key], `${entry.filename}: extracted.${key}`);
      } else {
        assert.equal(extracted[key], undefined, `${entry.filename}: extracted.${key} should not have been found`);
      }
    }
    assert.equal(entry.offerSourceType, extracted.isEstimate ? 'ESTIMATE' : 'FIRM_OFFER');
    assert.equal(extracted.competitorOffer, entry.expectedAmount);

    // --- Stage 2: valuation math, double-checked against the live spread config ---
    const tenantId = `fixture-harness-${entry.filename.replace(/[^a-z0-9]/gi, '-')}`;
    const telemetryService = new TelemetryService();
    const ingestService = new IngestService({ telemetryService, tenantId });
    const submissionService = new SubmissionService({ tenantId });
    const spreadConfigService = new SpreadConfigService({ tenantId });
    const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });

    const mapped = mapExtractedOfferToFormValues(extracted);
    const vehicle = {
      vin: mapped.vin ?? entry.vehicle.vin,
      year: mapped.year ?? entry.vehicle.year,
      make: mapped.make ?? entry.vehicle.make,
      model: mapped.model ?? entry.vehicle.model,
      mileage: mapped.mileage ?? entry.vehicle.mileage,
    };

    // A market comp (deterministically derived from the offer amount, not hand-tuned per
    // fixture) so fair market value resolves instead of NO_DATA, for every fixture alike.
    ingestService.intake({
      dealerId: 'dA',
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      price: Math.round(entry.expectedAmount * 1.15),
    });

    const submission = submissionService.submit({
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      mileage: vehicle.mileage,
      zipCode: '28451',
      competitor: mapped.competitor ?? 'Other',
      competitorDealerName: mapped.competitorDealerName,
      competitorOfferAmount: mapped.competitorOfferAmount,
      offerSourceType: entry.offerSourceType,
    });

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

    const { submission: dispatched } = dispatchService.dispatch(submission);

    assert.equal(dispatched.calculatedCounterOffer, expectedCounterAmount, `${entry.filename}: calculatedCounterOffer`);
    assert.equal(dispatched.finalCounterOffer, expectedCounterAmount, `${entry.filename}: finalCounterOffer`);
    assert.equal(dispatched.projectedMargin, expectedProjectedMargin, `${entry.filename}: projectedMargin`);
    assert.equal(dispatched.offerSourceType, entry.offerSourceType, `${entry.filename}: offerSourceType`);

    // --- Stage 3: appraisal artifact ---
    const { svgMarkup } = generateAppraisalDocument({
      submission: dispatched,
      tenantConfig: createTenantConfig({ name: 'CarBoyZ Motors' }),
    });

    const expectedLabel = entry.offerSourceType === 'ESTIMATE' ? CONDITIONAL_LABEL : GUARANTEED_LABEL;
    assert.ok(svgMarkup.includes(expectedLabel), `${entry.filename}: expected svg to contain "${expectedLabel}"`);
    const counterLabel = currencyFormatter.format(expectedCounterAmount);
    assert.ok(svgMarkup.includes(counterLabel), `${entry.filename}: expected svg to contain ${counterLabel}`);
  });
}
