import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantConfig } from '../src/config/tenantConfig.js';
import { DealerProfileService } from '../src/services/DealerProfileService.js';
import { AdminController } from '../src/ui/AdminController.js';

function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

function createController({ storage = createStorage(), tenantId = 't1', adminPin } = {}) {
  const tenantConfig = createTenantConfig({ tenantId, ...(adminPin !== undefined ? { adminPin } : {}) });
  const dealerProfileService = new DealerProfileService({ tenantId, storage: createStorage() });
  return new AdminController({ tenantConfig, dealerProfileService, storage });
}

test('AdminController requires a tenantConfig and a dealerProfileService', () => {
  assert.throws(() => new AdminController({}), /tenantConfig/);
  assert.throws(() => new AdminController({ tenantConfig: createTenantConfig() }), /dealerProfileService/);
});

test('isUnlocked is false by default', () => {
  const controller = createController();
  assert.equal(controller.isUnlocked(), false);
});

test('attemptUnlock succeeds with the configured PIN and persists the unlock', () => {
  const storage = createStorage();
  const controller = createController({ storage });

  assert.equal(controller.attemptUnlock('1234'), true);
  assert.equal(controller.isUnlocked(), true);

  const sameSessionController = createController({ storage, adminPin: '1234' });
  assert.equal(sameSessionController.isUnlocked(), true);
});

test('attemptUnlock rejects an incorrect PIN without unlocking', () => {
  const controller = createController();
  assert.equal(controller.attemptUnlock('0000'), false);
  assert.equal(controller.isUnlocked(), false);
});

test('attemptUnlock rejects a PIN that is not exactly 4 digits', () => {
  const controller = createController();
  assert.equal(controller.attemptUnlock('123'), false);
  assert.equal(controller.attemptUnlock('12345'), false);
});

test('attemptUnlock respects a tenant-specific adminPin override', () => {
  const controller = createController({ adminPin: '9999' });
  assert.equal(controller.attemptUnlock('1234'), false);
  assert.equal(controller.attemptUnlock('9999'), true);
});

test('lock clears a previously unlocked session', () => {
  const storage = createStorage();
  const controller = createController({ storage });
  controller.attemptUnlock('1234');
  assert.equal(controller.isUnlocked(), true);

  controller.lock();
  assert.equal(controller.isUnlocked(), false);
});

test('isUnlocked is a safe no-op when storage is unavailable', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('unavailable');
    },
    setItem() {
      throw new Error('unavailable');
    },
    removeItem() {
      throw new Error('unavailable');
    },
  };
  const controller = createController({ storage: throwingStorage });
  assert.equal(controller.isUnlocked(), false);
  assert.doesNotThrow(() => controller.attemptUnlock('1234'));
  assert.doesNotThrow(() => controller.lock());
});

test('team roster methods delegate to the dealerProfileService', () => {
  const storage = createStorage();
  const tenantConfig = createTenantConfig({ tenantId: 't5' });
  const dealerProfileService = new DealerProfileService({ tenantId: 't5', storage: createStorage() });
  const controller = new AdminController({ tenantConfig, dealerProfileService, storage });

  const seeded = controller.listTeamMembers();
  assert.equal(seeded.length, 1);

  const added = controller.addTeamMember({ name: 'Morgan Lee', phone: '5551112222', role: 'SALES_REP' });
  assert.equal(controller.listTeamMembers().length, 2);

  assert.equal(controller.removeTeamMember(added.id), true);
  assert.equal(controller.listTeamMembers().length, 1);
});
