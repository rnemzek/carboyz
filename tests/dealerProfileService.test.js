import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DealerProfileService, TEAM_MEMBER_ROLES, normalizePhone, toE164 } from '../src/services/DealerProfileService.js';

function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

test('normalizePhone formats a bare 10-digit US number', () => {
  assert.equal(normalizePhone('9105550128'), '(910) 555-0128');
  assert.equal(normalizePhone('(910) 555-0128'), '(910) 555-0128');
});

test('normalizePhone preserves a valid E.164 number', () => {
  assert.equal(normalizePhone('+19105550128'), '+19105550128');
});

test('normalizePhone rejects an invalid phone', () => {
  assert.throws(() => normalizePhone('555-0128'), /10-digit/);
  assert.throws(() => normalizePhone('+1'), /E\.164/);
  assert.throws(() => normalizePhone(''), /required/);
});

test('toE164 converts normalizePhone\'s display format back to strict E.164', () => {
  assert.equal(toE164('(910) 555-0128'), '+19105550128');
});

test('toE164 passes through an already-valid E.164 number', () => {
  assert.equal(toE164('+19105550128'), '+19105550128');
});

test('toE164 rejects an invalid phone', () => {
  assert.throws(() => toE164('555-0128'), /10-digit/);
  assert.throws(() => toE164('+1'), /E\.164/);
  assert.throws(() => toE164(''), /required/);
});

test('DealerProfileService requires a tenantId', () => {
  assert.throws(() => new DealerProfileService({}), /tenantId/);
});

test('DealerProfileService seeds a default CarBoyZ desk member when storage is empty', () => {
  const service = new DealerProfileService({ tenantId: 'carboyz', storage: createStorage() });
  const members = service.listMembers();
  assert.equal(members.length, 1);
  assert.equal(members[0].role, TEAM_MEMBER_ROLES.MANAGER);
  assert.equal(members[0].notifyOnPending, true);
});

test('addMember validates name, phone, and role, then persists the new member', () => {
  const storage = createStorage();
  const service = new DealerProfileService({ tenantId: 't1', storage });

  const member = service.addMember({ name: 'Jamie Rivera', phone: '5551234567', role: 'SALES_REP' });
  assert.equal(member.name, 'Jamie Rivera');
  assert.equal(member.phone, '(555) 123-4567');
  assert.equal(member.notifyOnPending, true);
  assert.equal(service.listMembers().length, 2);

  const reloaded = new DealerProfileService({ tenantId: 't1', storage });
  assert.equal(reloaded.listMembers().length, 2);
});

test('addMember rejects a missing name or an invalid role', () => {
  const service = new DealerProfileService({ tenantId: 't2', storage: createStorage() });
  assert.throws(() => service.addMember({ name: '', phone: '5551234567' }), /name/);
  assert.throws(() => service.addMember({ name: 'A', phone: '5551234567', role: 'OWNER' }), /role/);
});

test('removeMember deletes an existing member and returns false for an unknown id', () => {
  const service = new DealerProfileService({ tenantId: 't3', storage: createStorage() });
  const member = service.addMember({ name: 'Taylor', phone: '5559876543' });

  assert.equal(service.removeMember(member.id), true);
  assert.equal(service.listMembers().some((m) => m.id === member.id), false);
  assert.equal(service.removeMember('no-such-id'), false);
});

test('listMembers returns defensive copies', () => {
  const service = new DealerProfileService({ tenantId: 't4', storage: createStorage() });
  const members = service.listMembers();
  members[0].name = 'Mutated';
  assert.notEqual(service.listMembers()[0].name, 'Mutated');
});
