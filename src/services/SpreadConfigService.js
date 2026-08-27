import { COMPETITORS } from '../models/Submission.js';

export const TIER_STRATEGIES = Object.freeze({
  MAX: 'MAX',
  FLAT_ONLY: 'FLAT_ONLY',
  PERCENT_ONLY: 'PERCENT_ONLY',
});

export const DEFAULT_TIERS = Object.freeze([
  Object.freeze({ minPrice: 0, maxPrice: 15000, flatAmount: 300, percent: 0.02, strategy: TIER_STRATEGIES.MAX, autoApprove: true }),
  Object.freeze({ minPrice: 15000, maxPrice: 30000, flatAmount: 500, percent: 0.02, strategy: TIER_STRATEGIES.MAX, autoApprove: true }),
  Object.freeze({ minPrice: 30000, maxPrice: null, flatAmount: 750, percent: 0.015, strategy: TIER_STRATEGIES.MAX, autoApprove: false }),
]);

function cloneTiers(tiers) {
  return tiers.map((tier) => ({ ...tier }));
}

export function buildDefaultConfig(tenantId) {
  return {
    tenantId,
    tiersByCompetitor: Object.fromEntries(COMPETITORS.map((competitor) => [competitor, cloneTiers(DEFAULT_TIERS)])),
  };
}

function validateTier(tier, competitor, index) {
  const label = `tiersByCompetitor.${competitor}[${index}]`;

  if (typeof tier.minPrice !== 'number' || tier.minPrice < 0) {
    throw new Error(`${label}.minPrice must be a non-negative number`);
  }
  if (tier.maxPrice !== null && (typeof tier.maxPrice !== 'number' || tier.maxPrice <= tier.minPrice)) {
    throw new Error(`${label}.maxPrice must be null or a number greater than minPrice`);
  }
  if (typeof tier.flatAmount !== 'number' || tier.flatAmount < 0) {
    throw new Error(`${label}.flatAmount must be a non-negative number`);
  }
  if (typeof tier.percent !== 'number' || tier.percent < 0) {
    throw new Error(`${label}.percent must be a non-negative number`);
  }
  if (tier.strategy !== undefined && !Object.values(TIER_STRATEGIES).includes(tier.strategy)) {
    throw new Error(`${label}.strategy must be one of: ${Object.values(TIER_STRATEGIES).join(', ')}`);
  }
  if (tier.autoApprove !== undefined && typeof tier.autoApprove !== 'boolean') {
    throw new Error(`${label}.autoApprove must be a boolean`);
  }
}

export function validateConfig(config) {
  if (!config || typeof config.tiersByCompetitor !== 'object' || config.tiersByCompetitor === null) {
    throw new Error('SpreadConfigService config requires a tiersByCompetitor object');
  }

  const tiersByCompetitor = {};
  for (const [competitor, tiers] of Object.entries(config.tiersByCompetitor)) {
    if (!Array.isArray(tiers)) {
      throw new Error(`tiersByCompetitor.${competitor} must be an array of tiers`);
    }
    tiers.forEach((tier, index) => validateTier(tier, competitor, index));
    tiersByCompetitor[competitor] = tiers.map((tier) => ({
      ...tier,
      strategy: tier.strategy ?? TIER_STRATEGIES.MAX,
      autoApprove: tier.autoApprove ?? false,
    }));
  }

  return { tenantId: config.tenantId, tiersByCompetitor };
}

function storageKey(tenantId) {
  return `carboyz:spreadConfig:${tenantId}`;
}

function readConfig(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(storageKey(tenantId));
    if (!raw) {
      return null;
    }
    return validateConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeConfig(storage, tenantId, config) {
  try {
    storage?.setItem?.(storageKey(tenantId), JSON.stringify(config));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — the config
    // still works for this session, it just won't persist across reloads.
  }
}

export class SpreadConfigService {
  constructor({ tenantId, storage = null } = {}) {
    if (!tenantId) {
      throw new Error('SpreadConfigService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;
    this.config = readConfig(storage, tenantId) ?? buildDefaultConfig(tenantId);
  }

  getConfig() {
    return {
      tenantId: this.config.tenantId,
      tiersByCompetitor: Object.fromEntries(
        Object.entries(this.config.tiersByCompetitor).map(([competitor, tiers]) => [competitor, cloneTiers(tiers)]),
      ),
    };
  }

  getTiersForCompetitor(competitor) {
    return cloneTiers(this.config.tiersByCompetitor[competitor] ?? []);
  }

  saveConfig(nextConfig) {
    const validated = validateConfig({ ...nextConfig, tenantId: this.tenantId });
    this.config = validated;
    writeConfig(this.storage, this.tenantId, validated);
    return this.getConfig();
  }

  resetToDefault() {
    this.config = buildDefaultConfig(this.tenantId);
    writeConfig(this.storage, this.tenantId, this.config);
    return this.getConfig();
  }
}
