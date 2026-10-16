export const TEAM_MEMBER_ROLES = Object.freeze({
  MANAGER: 'MANAGER',
  SALES_REP: 'SALES_REP',
});

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

// Accepts a bare 10-digit US number (formatted to "(XXX) XXX-XXXX" for display/dialing
// consistency) or an E.164 number (kept as "+<digits>"). Anything else is rejected rather
// than silently mangled, since this phone is used for real SMS/call notifications.
export function normalizePhone(rawPhone) {
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    throw new Error('phone is required');
  }

  const trimmed = rawPhone.trim();

  if (trimmed.startsWith('+')) {
    const candidate = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    if (!E164_PATTERN.test(candidate)) {
      throw new Error('phone must be a valid E.164 number');
    }
    return candidate;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    throw new Error('phone must be a 10-digit US number or E.164 format (e.g. +15550100100)');
  }
  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
}

/**
 * Converts a stored phone (either normalizePhone's "(XXX) XXX-XXXX" display format or an
 * already-E.164 number) into strict E.164, for handing to a real SMS provider (UOW-54) — the
 * display format normalizePhone produces is for UI/dialing, not provider dispatch.
 */
export function toE164(phone) {
  if (typeof phone !== 'string' || !phone.trim()) {
    throw new Error('phone is required');
  }

  const trimmed = phone.trim();

  if (trimmed.startsWith('+')) {
    const candidate = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    if (!E164_PATTERN.test(candidate)) {
      throw new Error('phone must be a valid E.164 number');
    }
    return candidate;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    throw new Error('phone must be a 10-digit US number or E.164 format (e.g. +15550100100)');
  }
  return `+1${digitsOnly}`;
}

function storageKey(tenantId) {
  return `carboyz:dealerProfile:${tenantId}`;
}

function buildSeedMembers(tenantId) {
  return [
    {
      id: `${tenantId}-member-1`,
      name: 'CarBoyZ Front Desk',
      phone: normalizePhone('9105550128'),
      role: TEAM_MEMBER_ROLES.MANAGER,
      notifyOnPending: true,
    },
  ];
}

function readMembers(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(storageKey(tenantId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMembers(storage, tenantId, members) {
  try {
    storage?.setItem?.(storageKey(tenantId), JSON.stringify(members));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — the roster still
    // works for this session, it just won't persist across reloads.
  }
}

export class DealerProfileService {
  constructor({ tenantId, storage = null } = {}) {
    if (!tenantId) {
      throw new Error('DealerProfileService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;

    const existing = readMembers(storage, tenantId);
    this.members = existing ?? buildSeedMembers(tenantId);
    this.sequence = this.members.length;
    if (!existing) {
      writeMembers(this.storage, this.tenantId, this.members);
    }
  }

  generateId() {
    this.sequence += 1;
    return `${this.tenantId}-member-${this.sequence}`;
  }

  listMembers() {
    return this.members.map((member) => ({ ...member }));
  }

  addMember({ name, phone, role = TEAM_MEMBER_ROLES.SALES_REP, notifyOnPending = true } = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Team member requires a name');
    }
    if (!Object.values(TEAM_MEMBER_ROLES).includes(role)) {
      throw new Error(`Team member role must be one of: ${Object.values(TEAM_MEMBER_ROLES).join(', ')}`);
    }

    const member = {
      id: this.generateId(),
      name: name.trim(),
      phone: normalizePhone(phone),
      role,
      notifyOnPending: Boolean(notifyOnPending),
    };

    this.members.push(member);
    writeMembers(this.storage, this.tenantId, this.members);
    return { ...member };
  }

  removeMember(id) {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) {
      return false;
    }
    this.members.splice(index, 1);
    writeMembers(this.storage, this.tenantId, this.members);
    return true;
  }
}
