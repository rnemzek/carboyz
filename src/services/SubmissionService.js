import { Submission } from '../models/Submission.js';

export const SYNC_STATES = Object.freeze({
  PENDING_SYNC: 'PENDING_SYNC',
  SYNCED: 'SYNCED',
});

function storageKey(tenantId) {
  return `carboyz:submissions:${tenantId}`;
}

function pendingSyncStorageKey(tenantId) {
  return `carboyz:submissions:pendingSync:${tenantId}`;
}

function defaultIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function readPendingSyncIds(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(pendingSyncStorageKey(tenantId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePendingSyncIds(storage, tenantId, ids) {
  try {
    storage?.setItem?.(pendingSyncStorageKey(tenantId), JSON.stringify(ids));
  } catch {
    // Storage may be unavailable — the queue still works for this session, it just won't
    // survive a reload, same tradeoff as writeSubmissions() below.
  }
}

function readSubmissions(storage, tenantId) {
  try {
    const raw = storage?.getItem?.(storageKey(tenantId));
    if (!raw) {
      return [];
    }
    return JSON.parse(raw).map((data) => new Submission(data));
  } catch {
    return [];
  }
}

function writeSubmissions(storage, tenantId, submissions) {
  try {
    storage?.setItem?.(storageKey(tenantId), JSON.stringify(submissions));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — submissions
    // still work for this session, they just won't persist across reloads.
  }
}

export class SubmissionService {
  constructor({ tenantId, storage = null, isOnline = defaultIsOnline } = {}) {
    if (!tenantId) {
      throw new Error('SubmissionService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;
    this.isOnline = isOnline;
    this.submissions = readSubmissions(storage, tenantId);
    this.sequence = this.submissions.length;
    this.pendingSyncIds = readPendingSyncIds(storage, tenantId).filter((id) =>
      this.submissions.some((submission) => submission.id === id),
    );
  }

  generateId() {
    this.sequence += 1;
    return `${this.tenantId}-sub-${this.sequence}`;
  }

  submit(data = {}) {
    const submission = new Submission({
      ...data,
      id: data.id ?? this.generateId(),
      timestamp: data.timestamp ?? new Date().toISOString(),
      status: 'NEW',
      initialCompetitorOffer: data.initialCompetitorOffer ?? data.competitorOfferAmount,
    });

    this.submissions.push(submission);
    writeSubmissions(this.storage, this.tenantId, this.submissions);

    if (!this.isOnline()) {
      this.enqueueForSync(submission.id);
    }

    return submission;
  }

  getSubmissions() {
    return [...this.submissions];
  }

  enqueueForSync(id) {
    if (this.pendingSyncIds.includes(id)) {
      return;
    }
    this.pendingSyncIds.push(id);
    writePendingSyncIds(this.storage, this.tenantId, this.pendingSyncIds);
  }

  getSyncState(id) {
    return this.pendingSyncIds.includes(id) ? SYNC_STATES.PENDING_SYNC : SYNC_STATES.SYNCED;
  }

  getPendingSyncSubmissions() {
    return this.pendingSyncIds
      .map((id) => this.submissions.find((submission) => submission.id === id))
      .filter(Boolean);
  }

  /**
   * Replays every queued offline submission through `syncFn` (typically
   * `syncAdapter.submitSubmissionCreated`). A submission stays queued if `syncFn` throws, so a
   * reconnect that itself flakes doesn't silently drop it — the next 'online' event retries it.
   */
  flushPendingSync(syncFn) {
    if (typeof syncFn !== 'function' || this.pendingSyncIds.length === 0) {
      return { flushed: [], remaining: this.getPendingSyncSubmissions() };
    }

    const flushed = [];
    const remaining = [];
    for (const id of this.pendingSyncIds) {
      const submission = this.submissions.find((candidate) => candidate.id === id);
      if (!submission) {
        continue;
      }
      try {
        syncFn(submission);
        flushed.push(submission);
      } catch {
        remaining.push(id);
      }
    }

    this.pendingSyncIds = remaining;
    writePendingSyncIds(this.storage, this.tenantId, this.pendingSyncIds);

    return { flushed, remaining: this.getPendingSyncSubmissions() };
  }

  receiveExternalSubmission(data) {
    if (!data?.id || this.submissions.some((submission) => submission.id === data.id)) {
      return null;
    }

    let submission;
    try {
      submission = new Submission(data);
    } catch {
      return null;
    }

    this.submissions.push(submission);
    writeSubmissions(this.storage, this.tenantId, this.submissions);
    return submission;
  }

  updateFields(id, patch) {
    const index = this.submissions.findIndex((submission) => submission.id === id);
    if (index === -1) {
      throw new Error(`Submission not found: ${id}`);
    }

    const updated = new Submission({ ...this.submissions[index], ...patch });
    this.submissions[index] = updated;
    writeSubmissions(this.storage, this.tenantId, this.submissions);

    return updated;
  }

  updateStatus(id, status) {
    return this.updateFields(id, { status });
  }
}
