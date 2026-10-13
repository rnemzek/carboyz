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
import { NO_VIN_ESTIMATE_BEAT_BUMP } from '../../src/services/SpreadConfigService.js';

// UOW-47: Two-Tier Counter Offers (No-VIN Conditional vs. Verified-VIN Guaranteed). Reuses the same
// Carvana/Jeep "Estimate" screenshot fixture as UOW-44's golden pipeline test (no VIN at intake,
// $13,100, 2020 Jeep Wrangler Unlimited), but exercises it twice — once with no VIN supplied at
// submission, once with a seed VIN — to verify the two beat-bump tiers independently.
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'fixtures', 'offers');
const ESTIMATE_FIXTURE_FILE = 'carvana-estimated-offer-screenshot.jpeg';
const SEED_VIN = '1HGCM82633A004352';

function readFixtureBase64(name) {
  return readFileSync(join(FIXTURES_DIR, name)).toString('base64');
}

async function parseEstimateFixture() {
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
  return parseBody.extracted;
}

function makePipeline(tenantId) {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId });
  const submissionService = new SubmissionService({ tenantId });
  const spreadConfigService = new SpreadConfigService({ tenantId });
  const dispatchService = new DispatchService({ submissionService, spreadConfigService, telemetryService, ingestService });
  ingestService.intake({ dealerId: 'dA', make: 'Jeep', model: 'Wrangler Unlimited', year: 2020, price: 18000 });
  return { submissionService, spreadConfigService, dispatchService };
}

test('No-VIN tier: the Carvana Jeep estimate submits without a vin and gets the conservative, manual-review counter', async () => {
  const extracted = await parseEstimateFixture();
  // The estimate screen never has a VIN (that's the point) — submit without one.
  assert.equal(extracted.vin, undefined);

  const { submissionService, dispatchService } = makePipeline('no-vin-tier-t1');
  const submission = submissionService.submit({
    year: extracted.year,
    make: extracted.make,
    model: extracted.model,
    mileage: 42000,
    zipCode: '28451',
    competitor: extracted.competitorName,
    competitorOfferAmount: extracted.competitorOffer,
    offerSourceType: 'ESTIMATE',
  });
  assert.equal(submission.vin, null);

  const { submission: dispatched, outcome, spreadResult } = dispatchService.dispatch(submission);

  assert.equal(outcome, DISPATCH_OUTCOMES.PENDING_APPROVAL);
  assert.equal(spreadResult.matchedTier, null);
  assert.equal(dispatched.calculatedCounterOffer, extracted.competitorOffer + NO_VIN_ESTIMATE_BEAT_BUMP);
  assert.equal(dispatched.offerSourceType, 'ESTIMATE');
});

test('Verified-VIN tier: the same Carvana Jeep estimate, submitted with a seed VIN, gets the full tier-based counter and can auto-dispatch', async () => {
  const extracted = await parseEstimateFixture();

  const { submissionService, spreadConfigService, dispatchService } = makePipeline('verified-vin-tier-t1');
  const submission = submissionService.submit({
    vin: SEED_VIN,
    year: extracted.year,
    make: extracted.make,
    model: extracted.model,
    mileage: 42000,
    zipCode: '28451',
    competitor: extracted.competitorName,
    competitorOfferAmount: extracted.competitorOffer,
    offerSourceType: 'ESTIMATE',
  });
  assert.equal(submission.vin, SEED_VIN);

  const tierConfig = spreadConfigService.getTiersForCompetitor(submission.competitor);
  const matchedTier = tierConfig.find(
    (tier) => submission.competitorOfferAmount >= tier.minPrice && (tier.maxPrice === null || submission.competitorOfferAmount < tier.maxPrice),
  );
  const expectedBump = Math.max(matchedTier.flatAmount ?? 0, submission.competitorOfferAmount * (matchedTier.percent ?? 0));

  const { submission: dispatched, outcome, spreadResult } = dispatchService.dispatch(submission);

  assert.equal(outcome, DISPATCH_OUTCOMES.AUTO_COUNTER_SENT);
  assert.deepEqual(spreadResult.matchedTier, matchedTier);
  assert.equal(dispatched.calculatedCounterOffer, extracted.competitorOffer + expectedBump);
  assert.equal(dispatched.offerSourceType, 'ESTIMATE');
});
