import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITORS } from '../src/models/Submission.js';
import { SubmissionService } from '../src/services/SubmissionService.js';
import { SpreadConfigService, DEFAULT_TIERS } from '../src/services/SpreadConfigService.js';
import { SimulationService } from '../src/services/SimulationService.js';
import { SimulationController } from '../src/ui/SimulationController.js';

function makeController() {
  const submissionService = new SubmissionService({ tenantId: 't1' });
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const simulationService = new SimulationService({ submissionService });
  const controller = new SimulationController({ simulationService, spreadConfigService });
  return { submissionService, spreadConfigService, controller };
}

test('SimulationController requires a simulationService', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const simulationService = new SimulationService({ submissionService: new SubmissionService({ tenantId: 't1' }) });
  assert.throws(() => new SimulationController({ spreadConfigService }), /simulationService/);
  assert.throws(() => new SimulationController({ simulationService }), /spreadConfigService/);
});

test('getCompetitors returns the known competitor list', () => {
  const { controller } = makeController();
  assert.deepEqual(controller.getCompetitors(), COMPETITORS);
});

test('buildCandidateSeed mirrors the currently active tier config', () => {
  const { controller } = makeController();
  const seed = controller.buildCandidateSeed();

  assert.equal(seed.currentPolicyVersionId, 'v1.0.0');
  assert.equal(seed.competitors.length, COMPETITORS.length);
  assert.deepEqual(
    seed.competitors.find((entry) => entry.competitor === 'CarMax').tiers,
    DEFAULT_TIERS,
  );
});

test('runSimulation delegates to the simulationService with the given tiers', () => {
  const { submissionService, controller } = makeController();
  submissionService.submit({
    vin: '1HGCM82633A004352',
    year: 2021,
    make: 'Honda',
    model: 'Civic',
    mileage: 25000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 9500,
    winLossStatus: 'WON',
    approvalType: 'AUTO_DISPATCH',
    finalCounterOffer: 9800,
    expectedMargin: 1200,
  });

  const tiersByCompetitor = Object.fromEntries(
    COMPETITORS.map((competitor) => [competitor, DEFAULT_TIERS.map((tier) => ({ ...tier }))]),
  );
  const result = controller.runSimulation(tiersByCompetitor);

  assert.equal(result.sampleSize, 1);
  assert.equal(result.current.wonCount, 1);
});
