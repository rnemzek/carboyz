import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITORS } from '../src/models/Submission.js';
import { SpreadConfigService, DEFAULT_TIERS } from '../src/services/SpreadConfigService.js';
import { SpreadConfigController } from '../src/ui/SpreadConfigController.js';

test('SpreadConfigController requires a spreadConfigService', () => {
  assert.throws(() => new SpreadConfigController({}), /spreadConfigService/);
});

test('getCompetitors returns the known competitor list', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const controller = new SpreadConfigController({ spreadConfigService });
  assert.deepEqual(controller.getCompetitors(), COMPETITORS);
});

test('buildViewModel returns tiers per competitor', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const controller = new SpreadConfigController({ spreadConfigService });

  const { competitors } = controller.buildViewModel();
  assert.equal(competitors.length, COMPETITORS.length);
  assert.deepEqual(
    competitors.find((entry) => entry.competitor === 'CarMax').tiers,
    DEFAULT_TIERS,
  );
});

test('saveTiers and resetToDefault round-trip through the real service', () => {
  const spreadConfigService = new SpreadConfigService({ tenantId: 't1' });
  const controller = new SpreadConfigController({ spreadConfigService });

  controller.saveTiers({
    CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 42, percent: 0, strategy: 'FLAT_ONLY' }],
  });
  assert.equal(spreadConfigService.getTiersForCompetitor('CarMax')[0].flatAmount, 42);

  controller.resetToDefault();
  assert.deepEqual(spreadConfigService.getTiersForCompetitor('CarMax'), DEFAULT_TIERS);
});
