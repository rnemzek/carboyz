export const GENESIS_HASH = '0'.repeat(64);

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Synchronous, dependency-free SHA-256 so hash chaining works identically in the browser and
 * under `node --test` without awaiting `crypto.subtle.digest` (which would force saveConfig()
 * and the UI's synchronous try/catch validation flow to become async).
 */
export function sha256Hex(message) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashConfig(config) {
  return sha256Hex(canonicalize(config ?? null));
}

function diffTiers(previousTiers = [], nextTiers = []) {
  const changes = [];
  const length = Math.max(previousTiers.length, nextTiers.length);
  for (let index = 0; index < length; index += 1) {
    const before = previousTiers[index] ?? null;
    const after = nextTiers[index] ?? null;
    if (canonicalize(before) === canonicalize(after)) {
      continue;
    }
    changes.push({ tierIndex: index, previousValue: before, newValue: after });
  }
  return changes;
}

export function diffConfigs(previousConfig, nextConfig) {
  const previousTiersByCompetitor = previousConfig?.tiersByCompetitor ?? {};
  const nextTiersByCompetitor = nextConfig?.tiersByCompetitor ?? {};
  const competitors = new Set([...Object.keys(previousTiersByCompetitor), ...Object.keys(nextTiersByCompetitor)]);

  const changes = [];
  for (const competitor of competitors) {
    const tierChanges = diffTiers(previousTiersByCompetitor[competitor], nextTiersByCompetitor[competitor]);
    if (tierChanges.length > 0) {
      changes.push({ competitor, tierChanges });
    }
  }

  return changes;
}

function storageKey(tenantId) {
  return `carboyz:auditLedger:${tenantId}`;
}

function readChain(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(storageKey(tenantId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeChain(storage, tenantId, chain) {
  try {
    storage?.setItem?.(storageKey(tenantId), JSON.stringify(chain));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — the chain still works
    // for this session, it just won't persist across reloads.
  }
}

function computeBlockHash(entry) {
  const { blockHash, ...rest } = entry;
  return sha256Hex(canonicalize(rest));
}

/**
 * Append-only, hash-chained audit ledger for policy configuration mutations. Each entry links
 * to the previous entry's blockHash, so any tampering with an earlier entry is detectable by
 * verifyChainIntegrity() without needing an external source of truth.
 */
export class AuditLedgerService {
  constructor({ tenantId, storage = null, now = () => new Date().toISOString() } = {}) {
    if (!tenantId) {
      throw new Error('AuditLedgerService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;
    this.now = now;
    this.chain = readChain(storage, tenantId);
  }

  getChain() {
    return this.chain.map((entry) => ({ ...entry }));
  }

  getLatestBlockHash() {
    return this.chain.length > 0 ? this.chain[this.chain.length - 1].blockHash : GENESIS_HASH;
  }

  recordMutation({ authorId, previousConfig = null, newConfig }) {
    if (!authorId) {
      throw new Error('AuditLedgerService.recordMutation requires an authorId');
    }
    if (!newConfig) {
      throw new Error('AuditLedgerService.recordMutation requires a newConfig');
    }

    const entry = {
      sequence: this.chain.length + 1,
      timestamp: this.now(),
      authorId,
      previousConfigHash: previousConfig ? hashConfig(previousConfig) : GENESIS_HASH,
      newConfigHash: hashConfig(newConfig),
      diffPayload: diffConfigs(previousConfig, newConfig),
      previousBlockHash: this.getLatestBlockHash(),
    };
    entry.blockHash = computeBlockHash(entry);

    this.chain.push(entry);
    writeChain(this.storage, this.tenantId, this.chain);

    return { ...entry };
  }

  verifyChainIntegrity() {
    let previousBlockHash = GENESIS_HASH;
    for (const entry of this.chain) {
      if (entry.previousBlockHash !== previousBlockHash || computeBlockHash(entry) !== entry.blockHash) {
        return { valid: false, brokenAtSequence: entry.sequence };
      }
      previousBlockHash = entry.blockHash;
    }
    return { valid: true, brokenAtSequence: null };
  }
}
