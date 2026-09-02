import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITORS } from '../src/models/Submission.js';
import {
  SpreadConfigService,
  DEFAULT_TIERS,
  TIER_STRATEGIES,
  INITIAL_POLICY_VERSION_ID,
  bumpPolicyVersion,
} from '../src/services/SpreadConfigService.js';
import { AuditLedgerService } from '../src/services/AuditLedgerService.js';
import { PolicySnapshot } from '../src/models/PolicySnapshot.js';

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('SpreadConfigService requires a tenantId', () => {
  assert.throws(() => new SpreadConfigService({}), /tenantId/);
});

test('seeds the default tier ladder for every known competitor', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  const config = service.getConfig();

  COMPETITORS.forEach((competitor) => {
    assert.deepEqual(config.tiersByCompetitor[competitor], DEFAULT_TIERS);
  });
});

test('getTiersForCompetitor returns an empty array for an unknown competitor', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.deepEqual(service.getTiersForCompetitor('NotACompetitor'), []);
});

test('saveConfig persists and a fresh instance sharing storage picks it up', () => {
  const storage = fakeStorage();
  const service = new SpreadConfigService({ tenantId: 't1', storage });

  const customTiers = [{ minPrice: 0, maxPrice: null, flatAmount: 999, percent: 0.05, strategy: 'MAX', autoApprove: false }];
  service.saveConfig({ tiersByCompetitor: { CarMax: customTiers } });

  const reloaded = new SpreadConfigService({ tenantId: 't1', storage });
  assert.deepEqual(reloaded.getTiersForCompetitor('CarMax'), customTiers);
});

test('two tenants stay isolated in the same storage', () => {
  const storage = fakeStorage();
  const serviceA = new SpreadConfigService({ tenantId: 'tenant-a', storage });
  const serviceB = new SpreadConfigService({ tenantId: 'tenant-b', storage });

  serviceA.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 42, percent: 0, strategy: 'FLAT_ONLY' }] } });

  assert.deepEqual(serviceB.getTiersForCompetitor('CarMax'), DEFAULT_TIERS);
  assert.equal(new SpreadConfigService({ tenantId: 'tenant-a', storage }).getTiersForCompetitor('CarMax')[0].flatAmount, 42);
});

test('saveConfig throws on a negative minPrice', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.throws(
    () => service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: -1, maxPrice: null, flatAmount: 0, percent: 0 }] } }),
    /minPrice/,
  );
});

test('saveConfig throws when maxPrice is not greater than minPrice', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.throws(
    () => service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 100, maxPrice: 100, flatAmount: 0, percent: 0 }] } }),
    /maxPrice/,
  );
});

test('saveConfig throws on negative flatAmount or percent', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.throws(
    () => service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: -5, percent: 0 }] } }),
    /flatAmount/,
  );
  assert.throws(
    () => service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: -0.1 }] } }),
    /percent/,
  );
});

test('saveConfig throws on an unrecognized strategy', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.throws(
    () =>
      service.saveConfig({
        tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0, strategy: 'BOGUS' }] },
      }),
    /strategy/,
  );
});

test('a tier omitting strategy defaults to MAX', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  const saved = service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0 }] } });
  assert.equal(saved.tiersByCompetitor.CarMax[0].strategy, TIER_STRATEGIES.MAX);
});

test('DEFAULT_TIERS auto-approves the two low-dollar brackets and requires sign-off on the $30k+ bracket', () => {
  assert.equal(DEFAULT_TIERS[0].autoApprove, true);
  assert.equal(DEFAULT_TIERS[1].autoApprove, true);
  assert.equal(DEFAULT_TIERS[2].autoApprove, false);
});

test('saveConfig throws when autoApprove is present but not a boolean', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.throws(
    () =>
      service.saveConfig({
        tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0, autoApprove: 'yes' }] },
      }),
    /autoApprove/,
  );
});

test('a tier omitting autoApprove defaults to false', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  const saved = service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0 }] } });
  assert.equal(saved.tiersByCompetitor.CarMax[0].autoApprove, false);
});

test('resetToDefault restores the built-in ladder after a custom save', () => {
  const storage = fakeStorage();
  const service = new SpreadConfigService({ tenantId: 't1', storage });
  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0, strategy: 'FLAT_ONLY' }] } });

  service.resetToDefault();

  assert.deepEqual(service.getTiersForCompetitor('CarMax'), DEFAULT_TIERS);
  assert.deepEqual(new SpreadConfigService({ tenantId: 't1', storage }).getTiersForCompetitor('CarMax'), DEFAULT_TIERS);
});

test('bumpPolicyVersion increments the minor version and resets patch to 0', () => {
  assert.equal(bumpPolicyVersion('v1.0.0'), 'v1.1.0');
  assert.equal(bumpPolicyVersion('v1.4.2'), 'v1.5.0');
});

test('bumpPolicyVersion falls back to the initial version for missing or malformed input', () => {
  assert.equal(bumpPolicyVersion(undefined), INITIAL_POLICY_VERSION_ID);
  assert.equal(bumpPolicyVersion('not-a-version'), INITIAL_POLICY_VERSION_ID);
});

test('a new tenant starts at the initial policy version', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  assert.equal(service.getActivePolicyVersionId(), INITIAL_POLICY_VERSION_ID);
  assert.equal(service.getConfig().policyVersionId, INITIAL_POLICY_VERSION_ID);
});

test('saveConfig bumps the semantic policy version on every mutation', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } });
  assert.equal(service.getActivePolicyVersionId(), 'v1.1.0');

  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 2, percent: 0 }] } });
  assert.equal(service.getActivePolicyVersionId(), 'v1.2.0');
});

test('resetToDefault also bumps the policy version rather than reverting it', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } });
  service.resetToDefault();
  assert.equal(service.getActivePolicyVersionId(), 'v1.2.0');
});

test('the policy version persists across instances sharing storage', () => {
  const storage = fakeStorage();
  const service = new SpreadConfigService({ tenantId: 't1', storage });
  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } });

  const reloaded = new SpreadConfigService({ tenantId: 't1', storage });
  assert.equal(reloaded.getActivePolicyVersionId(), 'v1.1.0');
});

test('getActivePolicySnapshot returns a PolicySnapshot pinned to the current version and tiers', () => {
  const service = new SpreadConfigService({ tenantId: 't1' });
  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 42, percent: 0 }] } });

  const snapshot = service.getActivePolicySnapshot();
  assert.ok(snapshot instanceof PolicySnapshot);
  assert.equal(snapshot.policyVersionId, 'v1.1.0');
  assert.equal(snapshot.tenantId, 't1');
  assert.equal(snapshot.getTiersForCompetitor('CarMax')[0].flatAmount, 42);
});

test('saveConfig and resetToDefault append entries to the audit ledger, defaulting authorId to system', () => {
  const storage = fakeStorage();
  const service = new SpreadConfigService({ tenantId: 't1', storage });

  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } });
  service.saveConfig(
    { tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 2, percent: 0 }] } },
    { authorId: 'dealer-42' },
  );
  service.resetToDefault();

  const ledger = new AuditLedgerService({ tenantId: 't1', storage });
  const chain = ledger.getChain();
  assert.equal(chain.length, 3);
  assert.equal(chain[0].authorId, 'system');
  assert.equal(chain[1].authorId, 'dealer-42');
  assert.equal(chain[2].authorId, 'system');
  assert.deepEqual(ledger.verifyChainIntegrity(), { valid: true, brokenAtSequence: null });
});

test('an injected auditLedgerService is used instead of constructing a default one', () => {
  const calls = [];
  const auditLedgerService = { recordMutation: (args) => calls.push(args) };
  const service = new SpreadConfigService({ tenantId: 't1', auditLedgerService });

  service.saveConfig({ tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].authorId, 'system');
});
