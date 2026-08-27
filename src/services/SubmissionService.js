import { Submission } from '../models/Submission.js';

function storageKey(tenantId) {
  return `carboyz:submissions:${tenantId}`;
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
  constructor({ tenantId, storage = null } = {}) {
    if (!tenantId) {
      throw new Error('SubmissionService requires a tenantId');
    }

    this.tenantId = tenantId;
    this.storage = storage;
    this.submissions = readSubmissions(storage, tenantId);
    this.sequence = this.submissions.length;
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

    return submission;
  }

  getSubmissions() {
    return [...this.submissions];
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
