function cloneTiersByCompetitor(tiersByCompetitor) {
  return Object.fromEntries(
    Object.entries(tiersByCompetitor ?? {}).map(([competitor, tiers]) => [competitor, tiers.map((tier) => ({ ...tier }))]),
  );
}

/**
 * The immutable, point-in-time state of a tenant's spread policy — captured at the moment a
 * pricing calculation runs so a Submission can pin the exact policyVersionId (and the tier
 * ladder it implies) that produced its counter-offer, independent of any later policy edits.
 */
export class PolicySnapshot {
  constructor({ policyVersionId, tenantId, tiersByCompetitor, configHash, capturedAt }) {
    if (!policyVersionId) {
      throw new Error('PolicySnapshot requires a policyVersionId');
    }
    if (!tenantId) {
      throw new Error('PolicySnapshot requires a tenantId');
    }
    if (!tiersByCompetitor || typeof tiersByCompetitor !== 'object') {
      throw new Error('PolicySnapshot requires a tiersByCompetitor object');
    }
    if (!configHash) {
      throw new Error('PolicySnapshot requires a configHash');
    }

    this.policyVersionId = policyVersionId;
    this.tenantId = tenantId;
    this.tiersByCompetitor = cloneTiersByCompetitor(tiersByCompetitor);
    this.configHash = configHash;
    this.capturedAt = capturedAt ?? new Date().toISOString();
  }

  getTiersForCompetitor(competitor) {
    return (this.tiersByCompetitor[competitor] ?? []).map((tier) => ({ ...tier }));
  }
}
