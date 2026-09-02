import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Submission, COMPETITORS } from '../src/models/Submission.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SpreadConfigService } from '../src/services/SpreadConfigService.js';
import {
  PRICE_BRACKET_PRESETS,
  HISTORICAL_OUTCOME_PRESETS,
  SYNTHETIC_MAKE_MODELS,
  SYNTHETIC_COMPETITOR_SOURCES,
  generateVin,
  buildMockAppraisal,
  encodeAppraisalForUrl,
  decodeAppraisalFromUrlParam,
  buildPrefillUrl,
  parsePrefillFromSearch,
  buildHistoricalSubmissionPatch,
  seedHistoricalLeads,
  buildSyntheticSubmission,
  buildSyntheticSubmissions,
  seedHistoricalPolicyTimeline,
  resolveActivePolicyVersion,
  seedHistoricalSubmissionPool,
} from '../src/ui/TestHarnessView.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

test('buildSyntheticSubmission is deterministic and produces a schema-valid submission payload', () => {
  for (let seedIndex = 0; seedIndex < 20; seedIndex++) {
    const submission = buildSyntheticSubmission(seedIndex);
    assert.deepEqual(submission, buildSyntheticSubmission(seedIndex));
    assert.doesNotThrow(() => new Submission({ id: 'x', ...submission }));
    assert.ok(submission.mileage > 0);
    assert.ok(submission.competitorOfferAmount >= 0);
    assert.ok(COMPETITORS.includes(submission.competitor));
    assert.ok(submission.daysAgo >= 0 && submission.daysAgo < 90);
  }
});

test('buildSyntheticSubmission maps an unlisted competitor source (Hendrick) to Other + competitorDealerName', () => {
  const hendrickSeed = SYNTHETIC_COMPETITOR_SOURCES.findIndex((source) => source === 'Hendrick');
  const submission = buildSyntheticSubmission(hendrickSeed, { competitorSources: SYNTHETIC_COMPETITOR_SOURCES });
  assert.equal(submission.competitor, 'Other');
  assert.equal(submission.competitorDealerName, 'Hendrick');
  assert.doesNotThrow(() => new Submission({ id: 'x', ...submission }));
});

test('buildSyntheticSubmission filters by the selected vehicle makes', () => {
  const submission = buildSyntheticSubmission(3, { makes: ['Honda'] });
  assert.equal(submission.make, 'Honda');
});

test('buildSyntheticSubmission falls back to the full make pool when the selected makes filter matches nothing', () => {
  const submission = buildSyntheticSubmission(3, { makes: ['NotARealMake'] });
  assert.ok(SYNTHETIC_MAKE_MODELS.some((entry) => entry.make === submission.make));
});

test('buildSyntheticSubmissions produces `count` payloads with timestamps distributed across the daysBack window', () => {
  const daysBack = 90;
  const submissions = buildSyntheticSubmissions(60, { daysBack });
  assert.equal(submissions.length, 60);

  const now = Date.now();
  for (const submission of submissions) {
    const age = now - new Date(submission.timestamp).getTime();
    assert.ok(age >= 0 && age <= daysBack * MS_PER_DAY);
  }

  const distinctDaysAgo = new Set(submissions.map((s) => s.daysAgo));
  assert.ok(distinctDaysAgo.size > 1, 'expected timestamps to vary across the window');
});

test('seedHistoricalPolicyTimeline seeds a v1.0.0 -> v1.1.0 -> v1.2.0 chain into AuditLedgerService, backdated across daysBack', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const { segments } = seedHistoricalPolicyTimeline({ tenantId: 't1', spreadConfigService, daysBack: 90 });

  assert.deepEqual(
    segments.map((s) => s.policyVersionId),
    ['v1.0.0', 'v1.1.0', 'v1.2.0'],
  );
  assert.deepEqual(
    segments.map((s) => s.daysAgo),
    [90, 60, 30],
  );

  const chain = spreadConfigService.auditLedgerService.getChain();
  assert.equal(chain.length, 3);
  assert.deepEqual(spreadConfigService.auditLedgerService.verifyChainIntegrity(), { valid: true, brokenAtSequence: null });

  const now = Date.now();
  chain.forEach((entry, index) => {
    const age = now - new Date(entry.timestamp).getTime();
    assert.ok(Math.abs(age - segments[index].daysAgo * MS_PER_DAY) < MS_PER_DAY);
  });

  assert.equal(spreadConfigService.getActivePolicyVersionId(), 'v1.2.0');
});

test('resolveActivePolicyVersion picks the most recent segment whose daysAgo covers the given daysAgo', () => {
  const segments = [
    { policyVersionId: 'v1.0.0', daysAgo: 90 },
    { policyVersionId: 'v1.1.0', daysAgo: 60 },
    { policyVersionId: 'v1.2.0', daysAgo: 30 },
  ];
  assert.equal(resolveActivePolicyVersion(segments, 0), 'v1.2.0');
  assert.equal(resolveActivePolicyVersion(segments, 29), 'v1.2.0');
  assert.equal(resolveActivePolicyVersion(segments, 31), 'v1.1.0');
  assert.equal(resolveActivePolicyVersion(segments, 61), 'v1.0.0');
  assert.equal(resolveActivePolicyVersion(segments, 90), 'v1.0.0');
  assert.equal(resolveActivePolicyVersion(segments, 200), 'v1.0.0');
});

test('seedHistoricalSubmissionPool submits `count` submissions, each tagged with the policyVersionId active at its own timestamp', () => {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const expectedSegments = [
    { policyVersionId: 'v1.0.0', daysAgo: 90 },
    { policyVersionId: 'v1.1.0', daysAgo: 60 },
    { policyVersionId: 'v1.2.0', daysAgo: 30 },
  ];

  const created = seedHistoricalSubmissionPool({ submissionService, days: 90, count: 90 });

  assert.equal(created.length, 90);
  assert.equal(submissionService.getSubmissions().length, 90);

  const now = Date.now();
  for (const submission of created) {
    const actualDaysAgo = Math.round((now - new Date(submission.timestamp).getTime()) / MS_PER_DAY);
    assert.equal(submission.policyVersionId, resolveActivePolicyVersion(expectedSegments, actualDaysAgo));
  }

  const distinctVersions = new Set(created.map((s) => s.policyVersionId));
  assert.ok(distinctVersions.size > 1, 'expected submissions to span more than one policy version');
});

test('seedHistoricalSubmissionPool requires a submissionService', () => {
  assert.throws(() => seedHistoricalSubmissionPool({}), /submissionService/);
});
