import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Submission } from '../src/models/Submission.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import {
  PRICE_BRACKET_PRESETS,
  HISTORICAL_OUTCOME_PRESETS,
  generateVin,
  buildMockAppraisal,
  encodeAppraisalForUrl,
  decodeAppraisalFromUrlParam,
  buildPrefillUrl,
  parsePrefillFromSearch,
  buildHistoricalSubmissionPatch,
  seedHistoricalLeads,
} from '../src/ui/TestHarnessView.js';

test('generateVin is deterministic and always returns a 17-char VIN from the safe charset', () => {
  const vin = generateVin(3);
  assert.equal(vin, generateVin(3));
  assert.equal(vin.length, 17);
  assert.match(vin, /^[0-9A-HJ-NPR-Z]{17}$/);
});

test('generateVin produces different VINs for different seeds', () => {
  const vins = new Set(Array.from({ length: 10 }, (_, i) => generateVin(i)));
  assert.ok(vins.size > 1);
});

test('buildMockAppraisal is deterministic and keeps the offer within the bracket range', () => {
  for (const bracket of PRICE_BRACKET_PRESETS) {
    for (let seedIndex = 0; seedIndex < 10; seedIndex++) {
      const appraisal = buildMockAppraisal(bracket.key, seedIndex);
      assert.deepEqual(appraisal, buildMockAppraisal(bracket.key, seedIndex));
      assert.ok(appraisal.competitorOfferAmount >= bracket.offerRange[0]);
      assert.ok(appraisal.competitorOfferAmount <= bracket.offerRange[1]);
      assert.ok(['CarMax', 'Carvana'].includes(appraisal.competitor));
      assert.equal(appraisal.zipCode, '28451');
    }
  }
});

test('buildMockAppraisal throws for an unknown bracket key', () => {
  assert.throws(() => buildMockAppraisal('nope', 0), /Unknown price bracket/);
});

test('buildMockAppraisal produces a submission-shaped payload the Submission model accepts', () => {
  const appraisal = buildMockAppraisal('15k', 2);
  assert.doesNotThrow(() => new Submission({ id: 'x', timestamp: new Date().toISOString(), ...appraisal }));
});

test('encodeAppraisalForUrl / decodeAppraisalFromUrlParam round-trip', () => {
  const appraisal = buildMockAppraisal('25k', 5);
  const encoded = encodeAppraisalForUrl(appraisal);
  const decoded = decodeAppraisalFromUrlParam(encoded);
  assert.deepEqual(decoded, appraisal);
});

test('decodeAppraisalFromUrlParam rejects malformed or unversioned input', () => {
  assert.equal(decodeAppraisalFromUrlParam('not-a-real-payload'), null);
  assert.equal(decodeAppraisalFromUrlParam('carboyz-appraisal-v1|too|few|fields'), null);
  assert.equal(decodeAppraisalFromUrlParam(null), null);
  assert.equal(decodeAppraisalFromUrlParam(undefined), null);
});

test('buildPrefillUrl / parsePrefillFromSearch round-trip through a real URL', () => {
  const appraisal = buildMockAppraisal('5k', 1);
  const url = buildPrefillUrl('https://carboyz.example/', appraisal);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('tab'), 'sell');
  assert.deepEqual(parsePrefillFromSearch(parsed.search), appraisal);
});

test('parsePrefillFromSearch returns null when no pf param is present', () => {
  assert.equal(parsePrefillFromSearch('?tab=sell'), null);
  assert.equal(parsePrefillFromSearch(''), null);
});

test('buildHistoricalSubmissionPatch produces schema-valid enum combinations for every outcome', () => {
  for (const outcome of HISTORICAL_OUTCOME_PRESETS) {
    const { submitData, updatePatch } = buildHistoricalSubmissionPatch('15k', outcome.key, 4);
    assert.equal(updatePatch.status, outcome.status);
    assert.equal(updatePatch.winLossStatus, outcome.winLossStatus);
    assert.equal(updatePatch.approvalType, outcome.approvalType);
    assert.ok(Number.isFinite(updatePatch.calculatedCounterOffer));
    assert.ok(Number.isFinite(updatePatch.finalCounterOffer));
    assert.ok(Number.isFinite(updatePatch.expectedMargin));
    assert.ok(Number.isFinite(updatePatch.timeToCounterMs));
    assert.match(updatePatch.priceBracket, /^\$/);
    assert.ok(new Date(submitData.timestamp).getTime() < Date.now());
  }
});

test('buildHistoricalSubmissionPatch throws for an unknown outcome key', () => {
  assert.throws(() => buildHistoricalSubmissionPatch('15k', 'NOT_REAL', 0), /Unknown historical outcome/);
});

test('seedHistoricalLeads creates the requested count, each a schema-valid, resolved submission', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });

  const created = seedHistoricalLeads(submissionService, { count: 50 });

  assert.equal(created.length, 50);
  assert.equal(submissionService.getSubmissions().length, 50);

  const outcomeKeysSeen = new Set(created.map((submission) => submission.winLossStatus));
  for (const outcome of HISTORICAL_OUTCOME_PRESETS) {
    assert.ok(outcomeKeysSeen.has(outcome.winLossStatus), `expected to see winLossStatus ${outcome.winLossStatus}`);
  }

  const bracketsSeen = new Set(created.map((submission) => submission.priceBracket));
  assert.equal(bracketsSeen.size, PRICE_BRACKET_PRESETS.length);

  created.forEach((submission) => {
    assert.equal(submission.status, 'AUTO_COUNTER_SENT');
    assert.ok(submission.finalCounterOffer > 0);
    assert.ok(Number.isFinite(submission.expectedMargin));
    assert.ok(Number.isFinite(submission.timeToCounterMs));
  });
});

test('seedHistoricalLeads defaults to a count of 50', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const created = seedHistoricalLeads(submissionService);
  assert.equal(created.length, 50);
});
