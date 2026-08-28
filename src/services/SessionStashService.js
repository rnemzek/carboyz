export const STASH_STATUSES = ['PENDING', 'READY'];

function storageKey(tenantId) {
  return `carboyz:sessionStash:${tenantId}`;
}

function channelName(tenantId) {
  return `carboyz:sessionStash:${tenantId}`;
}

function readStash(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(storageKey(tenantId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStash(storage, tenantId, stash) {
  try {
    storage?.setItem?.(storageKey(tenantId), JSON.stringify(stash));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — the stash still
    // works for this session, it just won't persist across reloads or reach other tabs.
  }
}

export class SessionStashService {
  constructor({ tenantId, storage = null, channel = null } = {}) {
    if (!tenantId) {
      throw new Error('SessionStashService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;
    this.channel = channel ?? (typeof BroadcastChannel === 'function' ? new BroadcastChannel(channelName(tenantId)) : null);
  }

  generateSessionId() {
    return `stash-${this.tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  createPending(submissionId) {
    const stash = readStash(this.storage, this.tenantId);
    const pendingSessionId = this.generateSessionId();
    stash[pendingSessionId] = {
      submissionId,
      status: 'PENDING',
      finalCounterOffer: null,
      updatedAt: new Date().toISOString(),
    };
    writeStash(this.storage, this.tenantId, stash);
    return pendingSessionId;
  }

  resolveBySubmissionId(submissionId, { finalCounterOffer }) {
    const stash = readStash(this.storage, this.tenantId);
    const entryKey = Object.keys(stash).find(
      (key) => stash[key].submissionId === submissionId && stash[key].status === 'PENDING',
    );
    if (!entryKey) {
      return null;
    }

    const updated = {
      ...stash[entryKey],
      status: 'READY',
      finalCounterOffer,
      updatedAt: new Date().toISOString(),
    };
    stash[entryKey] = updated;
    writeStash(this.storage, this.tenantId, stash);
    this.channel?.postMessage?.({
      type: 'RESOLVED',
      pendingSessionId: entryKey,
      submissionId,
      finalCounterOffer,
    });

    return updated;
  }

  getStatus(pendingSessionId) {
    const stash = readStash(this.storage, this.tenantId);
    return stash[pendingSessionId] ?? null;
  }

  subscribe(pendingSessionId, onResolved) {
    if (!this.channel) {
      return () => {};
    }
    const handler = (event) => {
      if (event.data?.type === 'RESOLVED' && event.data.pendingSessionId === pendingSessionId) {
        onResolved(event.data);
      }
    };
    this.channel.addEventListener('message', handler);
    return () => this.channel.removeEventListener('message', handler);
  }
}
