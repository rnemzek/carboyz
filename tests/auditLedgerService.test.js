import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLedgerService, GENESIS_HASH, sha256Hex, hashConfig, diffConfigs } from '../src/services/AuditLedgerService.js';

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('AuditLedgerService requires a tenantId', () => {
  assert.throws(() => new AuditLedgerService({}), /tenantId/);
});

test('sha256Hex produces the known digest for an empty string', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('hashConfig is stable regardless of key order', () => {
  const a = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null }] } };
  const b = { tiersByCompetitor: { CarMax: [{ maxPrice: null, minPrice: 0 }] }, tenantId: 't1' };
  assert.equal(hashConfig(a), hashConfig(b));
});

test('an empty ledger has no chain and its latest block hash is the genesis hash', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1' });
  assert.deepEqual(ledger.getChain(), []);
  assert.equal(ledger.getLatestBlockHash(), GENESIS_HASH);
});

test('recordMutation requires an authorId and a newConfig', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1' });
  assert.throws(() => ledger.recordMutation({ newConfig: { tenantId: 't1', tiersByCompetitor: {} } }), /authorId/);
  assert.throws(() => ledger.recordMutation({ authorId: 'dealer-1' }), /newConfig/);
});

test('recordMutation appends a block capturing timestamp, authorId, hashes, and a diffPayload', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1', now: () => '2026-09-02T00:00:00.000Z' });
  const previousConfig = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 300, percent: 0.02 }] } };
  const newConfig = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 999, percent: 0.02 }] } };

  const entry = ledger.recordMutation({ authorId: 'dealer-1', previousConfig, newConfig });

  assert.equal(entry.sequence, 1);
  assert.equal(entry.timestamp, '2026-09-02T00:00:00.000Z');
  assert.equal(entry.authorId, 'dealer-1');
  assert.equal(entry.previousConfigHash, hashConfig(previousConfig));
  assert.equal(entry.newConfigHash, hashConfig(newConfig));
  assert.equal(entry.previousBlockHash, GENESIS_HASH);
  assert.equal(entry.diffPayload.length, 1);
  assert.equal(entry.diffPayload[0].competitor, 'CarMax');
  assert.equal(entry.diffPayload[0].tierChanges[0].newValue.flatAmount, 999);
  assert.match(entry.blockHash, /^[0-9a-f]{64}$/);
});

test('a mutation with no previousConfig chains its previousConfigHash to the genesis hash', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1' });
  const entry = ledger.recordMutation({ authorId: 'dealer-1', newConfig: { tenantId: 't1', tiersByCompetitor: {} } });
  assert.equal(entry.previousConfigHash, GENESIS_HASH);
});

test('consecutive blocks link previousBlockHash to the prior block, forming a chain', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1' });
  const first = ledger.recordMutation({ authorId: 'a', newConfig: { tenantId: 't1', tiersByCompetitor: { CarMax: [] } } });
  const second = ledger.recordMutation({
    authorId: 'b',
    previousConfig: { tenantId: 't1', tiersByCompetitor: { CarMax: [] } },
    newConfig: { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } },
  });

  assert.equal(second.sequence, 2);
  assert.equal(second.previousBlockHash, first.blockHash);
});

test('the chain persists across instances sharing storage', () => {
  const storage = fakeStorage();
  const ledger = new AuditLedgerService({ tenantId: 't1', storage });
  ledger.recordMutation({ authorId: 'a', newConfig: { tenantId: 't1', tiersByCompetitor: {} } });

  const reloaded = new AuditLedgerService({ tenantId: 't1', storage });
  assert.equal(reloaded.getChain().length, 1);
  assert.equal(reloaded.getLatestBlockHash(), ledger.getLatestBlockHash());
});

test('two tenants keep separate ledgers in the same storage', () => {
  const storage = fakeStorage();
  const ledgerA = new AuditLedgerService({ tenantId: 'tenant-a', storage });
  const ledgerB = new AuditLedgerService({ tenantId: 'tenant-b', storage });
  ledgerA.recordMutation({ authorId: 'a', newConfig: { tenantId: 'tenant-a', tiersByCompetitor: {} } });

  assert.equal(ledgerA.getChain().length, 1);
  assert.equal(ledgerB.getChain().length, 0);
});

test('verifyChainIntegrity reports valid for an untampered chain, including an empty one', () => {
  const ledger = new AuditLedgerService({ tenantId: 't1' });
  assert.deepEqual(ledger.verifyChainIntegrity(), { valid: true, brokenAtSequence: null });

  ledger.recordMutation({ authorId: 'a', newConfig: { tenantId: 't1', tiersByCompetitor: {} } });
  ledger.recordMutation({ authorId: 'b', newConfig: { tenantId: 't1', tiersByCompetitor: { CarMax: [] } } });
  assert.deepEqual(ledger.verifyChainIntegrity(), { valid: true, brokenAtSequence: null });
});

test('verifyChainIntegrity detects a tampered entry', () => {
  const storage = fakeStorage();
  const ledger = new AuditLedgerService({ tenantId: 't1', storage });
  ledger.recordMutation({ authorId: 'a', newConfig: { tenantId: 't1', tiersByCompetitor: {} } });
  ledger.recordMutation({ authorId: 'b', newConfig: { tenantId: 't1', tiersByCompetitor: { CarMax: [] } } });

  ledger.chain[0].authorId = 'attacker';

  assert.deepEqual(ledger.verifyChainIntegrity(), { valid: false, brokenAtSequence: 1 });
});

test('diffConfigs reports no changes for identical configs', () => {
  const config = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } };
  assert.deepEqual(diffConfigs(config, config), []);
});

test('diffConfigs reports an added competitor as a diff', () => {
  const before = { tenantId: 't1', tiersByCompetitor: {} };
  const after = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } };
  const diff = diffConfigs(before, after);

  assert.equal(diff.length, 1);
  assert.equal(diff[0].competitor, 'CarMax');
  assert.equal(diff[0].tierChanges[0].previousValue, null);
});

test('diffConfigs handles a null previousConfig as an empty baseline', () => {
  const after = { tenantId: 't1', tiersByCompetitor: { CarMax: [{ minPrice: 0, maxPrice: null, flatAmount: 1, percent: 0 }] } };
  const diff = diffConfigs(null, after);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].competitor, 'CarMax');
});
