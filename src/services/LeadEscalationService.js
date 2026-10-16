import { isWithinOperatingHours } from '../config/tenantConfig.js';

/**
 * Nags the desk about unreviewed PENDING_APPROVAL leads and rolls up anything that arrived
 * during quiet hours into a single morning digest (UOW-50).
 */
export class LeadEscalationService {
  constructor({ submissionService, notificationService, tenantConfigService } = {}) {
    if (!submissionService) {
      throw new Error('LeadEscalationService requires a submissionService');
    }
    if (!notificationService) {
      throw new Error('LeadEscalationService requires a notificationService');
    }
    if (!tenantConfigService) {
      throw new Error('LeadEscalationService requires a tenantConfigService');
    }

    this.submissionService = submissionService;
    this.notificationService = notificationService;
    this.tenantConfigService = tenantConfigService;
  }

  /**
   * Scans PENDING_APPROVAL leads that have waited past nagIntervalMinutes without a prior nag.
   * During operating hours it fires the escalation SMS immediately; during quiet hours it
   * queues the lead for the next evaluateMorningDigest() sweep instead.
   */
  evaluatePendingLeads({ now = new Date() } = {}) {
    const schedule = this.tenantConfigService.getOperatingSchedule();
    const nagIntervalMs = (schedule.nagIntervalMinutes ?? 15) * 60 * 1000;
    const withinOperatingHours = isWithinOperatingHours(now, schedule);

    const escalated = [];
    const queued = [];

    for (const submission of this.submissionService.getSubmissions()) {
      if (submission.status !== 'PENDING_APPROVAL' || submission.nagSentAt) {
        continue;
      }

      const elapsedMs = now.getTime() - new Date(submission.timestamp).getTime();
      if (elapsedMs < nagIntervalMs) {
        continue;
      }

      if (withinOperatingHours) {
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        this.notificationService.notifyEscalation({ submission, elapsedMinutes });
        escalated.push(this.submissionService.updateFields(submission.id, { nagSentAt: now.toISOString() }));
      } else {
        queued.push(this.submissionService.updateFields(submission.id, { queuedForMorningDigest: true }));
      }
    }

    return { escalated, queued };
  }

  /**
   * Fires once operating hours resume: rolls every queuedForMorningDigest lead into a single
   * rollup SMS to desk managers, then clears the flag so it isn't re-sent on the next sweep.
   */
  evaluateMorningDigest({ now = new Date() } = {}) {
    const schedule = this.tenantConfigService.getOperatingSchedule();
    if (!isWithinOperatingHours(now, schedule)) {
      return { dispatched: false, count: 0 };
    }

    const queuedSubmissions = this.submissionService
      .getSubmissions()
      .filter((submission) => submission.queuedForMorningDigest === true);

    if (queuedSubmissions.length === 0) {
      return { dispatched: false, count: 0 };
    }

    this.notificationService.notifyMorningDigest({ count: queuedSubmissions.length });

    for (const submission of queuedSubmissions) {
      this.submissionService.updateFields(submission.id, {
        queuedForMorningDigest: false,
        digestSentAt: now.toISOString(),
      });
    }

    return { dispatched: true, count: queuedSubmissions.length };
  }
}

export const ESCALATION_TICK_INTERVAL_MS = 60 * 1000;

/**
 * Starts the Acquisition Radar escalation heartbeat (UOW-52): every `intervalMs` (default 60s),
 * runs evaluatePendingLeads() then evaluateMorningDigest() against `now()`. `service` only needs
 * to duck-type those two methods, so App.js can pass an indirection that always resolves to
 * whichever tenant is currently active rather than a single fixed LeadEscalationService instance.
 * Returns the interval handle — pass it to stopEscalationTicker() to clear it.
 */
export function startEscalationTicker(service, { intervalMs = ESCALATION_TICK_INTERVAL_MS, now = () => new Date() } = {}) {
  return setInterval(() => {
    service.evaluatePendingLeads({ now: now() });
    service.evaluateMorningDigest({ now: now() });
  }, intervalMs);
}

/** Clears a handle returned by startEscalationTicker(). No-ops on a null/undefined handle. */
export function stopEscalationTicker(handle) {
  if (handle) {
    clearInterval(handle);
  }
}
