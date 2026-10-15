function unlockStorageKey(tenantId) {
  return `carboyz:adminUnlocked:${tenantId}`;
}

export class AdminController {
  constructor({ tenantConfig, dealerProfileService, storage = null } = {}) {
    if (!tenantConfig) {
      throw new Error('AdminController requires a tenantConfig');
    }
    if (!dealerProfileService) {
      throw new Error('AdminController requires a dealerProfileService');
    }

    this.tenantConfig = tenantConfig;
    this.dealerProfileService = dealerProfileService;
    this.storage = storage;
  }

  isUnlocked() {
    try {
      return this.storage?.getItem?.(unlockStorageKey(this.tenantConfig.tenantId)) === 'true';
    } catch {
      return false;
    }
  }

  attemptUnlock(pin) {
    const expectedPin = this.tenantConfig.adminPin;
    const isMatch = typeof pin === 'string' && pin.length === 4 && pin === expectedPin;
    if (!isMatch) {
      return false;
    }

    try {
      this.storage?.setItem?.(unlockStorageKey(this.tenantConfig.tenantId), 'true');
    } catch {
      // Storage may be unavailable — the unlock still holds for the rest of this render pass,
      // it just won't survive a reload.
    }
    return true;
  }

  lock() {
    try {
      this.storage?.removeItem?.(unlockStorageKey(this.tenantConfig.tenantId));
    } catch {
      // Storage may be unavailable; nothing to clear.
    }
  }

  listTeamMembers() {
    return this.dealerProfileService.listMembers();
  }

  addTeamMember(data) {
    return this.dealerProfileService.addMember(data);
  }

  removeTeamMember(id) {
    return this.dealerProfileService.removeMember(id);
  }
}
