import { TEAM_MEMBER_ROLES, toE164 } from './DealerProfileService.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Normalizes a roster member's stored display-format phone to E.164 before handing it to the SMS
 * adapter — real providers (Telnyx/Twilio) reject display-format numbers. A member with an
 * unformattable phone is skipped (warned, not thrown) so one bad record can't block the rest of
 * the roster (UOW-54).
 */
function dispatchToMember(smsAdapter, member, body) {
  try {
    return smsAdapter.sendSms({ to: toE164(member.phone), body });
  } catch (err) {
    console.warn(`[NotificationService] Skipping SMS to ${member.name ?? member.id}: ${err.message}`);
    return { success: false, provider: 'skipped', to: member.phone, body, error: err.message };
  }
}

function competitorLabel(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return submission.competitorDealerName;
  }
  return submission.competitor;
}

/** Dev/test default adapter — logs the formatted SMS payload instead of sending it. */
export class ConsoleSmsAdapter {
  sendSms({ to, body }) {
    console.log(`[SMS -> ${to}] ${body}`);
    return { success: true, provider: 'console', to, body };
  }
}

/** Sends real SMS via Twilio's REST API directly (no SDK dependency) using HTTP Basic Auth. */
export class TwilioSmsAdapter {
  constructor({ accountSid, authToken, fromNumber, fetchImpl = fetch.bind(globalThis) } = {}) {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('TwilioSmsAdapter requires accountSid, authToken, and fromNumber');
    }
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
    this.fetchImpl = fetchImpl;
  }

  async sendSms({ to, body }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.fromNumber, Body: body });
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return { success: response.ok, provider: 'twilio', to, body };
  }
}

/**
 * Dispatches SMS through the server-side relay (POST /api/v1/notifications/sms), which holds the
 * provider credentials this browser bundle never sees. On a failed request or response it warns
 * to the console rather than throwing, so a dead relay/missing credentials never crash the UI.
 */
export class FetchSmsAdapter {
  constructor({ endpoint = '/api/v1/notifications/sms', fetchImpl = fetch.bind(globalThis), credentials = 'same-origin' } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.credentials = credentials;
  }

  async sendSms({ to, body }) {
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        credentials: this.credentials,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message: body }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        console.warn(`[FetchSmsAdapter] SMS dispatch to ${to} failed: ${result.error ?? `HTTP ${response.status}`}`);
        return { success: false, provider: 'fetch', to, body, error: result.error ?? `HTTP ${response.status}` };
      }
      return { success: true, provider: 'fetch', to, body, messageId: result.messageId ?? null };
    } catch (err) {
      console.warn(`[FetchSmsAdapter] SMS dispatch to ${to} threw: ${err.message}`);
      return { success: false, provider: 'fetch', to, body, error: err.message };
    }
  }
}

/**
 * Dispatches a dealer alert email through the server-side relay (POST
 * /api/v1/notifications/email), which holds the Resend API key and the alert recipient — this
 * browser bundle never sees either. Mirrors FetchSmsAdapter: warns instead of throwing on a
 * failed request or response, so a dead relay/missing credentials never crash the UI.
 */
export class FetchEmailAdapter {
  constructor({ endpoint = '/api/v1/notifications/email', fetchImpl = fetch.bind(globalThis), credentials = 'same-origin' } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.credentials = credentials;
  }

  async sendEmail({ subject, html }) {
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        credentials: this.credentials,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, html }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        console.warn(`[FetchEmailAdapter] Email dispatch failed: ${result.error ?? `HTTP ${response.status}`}`);
        return { success: false, provider: 'fetch', error: result.error ?? `HTTP ${response.status}` };
      }
      return { success: true, provider: 'fetch', id: result.id ?? null };
    } catch (err) {
      console.warn(`[FetchEmailAdapter] Email dispatch threw: ${err.message}`);
      return { success: false, provider: 'fetch', error: err.message };
    }
  }
}

/** Picks TwilioSmsAdapter when all three Twilio env vars are set, else the console fallback. */
export function createSmsAdapterFromEnv(env = process.env) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    return new TwilioSmsAdapter({
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      fromNumber: TWILIO_FROM_NUMBER,
    });
  }
  return new ConsoleSmsAdapter();
}

export function formatPendingApprovalSms({ submission, host = '' }) {
  return (
    `🔥 CarBoyZ Lead Alert: ${submission.year} ${submission.make} ${submission.model} ` +
    `(Comp: ${competitorLabel(submission)} ${currencyFormatter.format(submission.competitorOfferAmount)}). ` +
    `Review pending counter at: ${host}/dealer?sub=${submission.id}`
  );
}

export function formatEscalationSms({ submission, elapsedMinutes, host = '' }) {
  return (
    `⚠️ Escalation: Lead #${submission.id} (${submission.year} ${submission.make} ${submission.model}) ` +
    `waiting ${elapsedMinutes}m without review. Review now: ${host}/dealer?sub=${submission.id}`
  );
}

export function formatMorningDigestSms({ count, host = '' }) {
  return (
    `🌅 Good morning CarBoyZ desk: ${count} customer offer(s) arrived overnight waiting for review: ${host}/dealer`
  );
}

/**
 * Structured HTML appraisal card for the dealer alert email (Resend) — the zero-friction
 * fallback channel while Twilio's A2P 10DLC campaign is still pending carrier vetting.
 */
export function formatPendingApprovalEmailSubject({ submission }) {
  return `New ${currencyFormatter.format(submission.competitorOfferAmount)} Lead: ${submission.year} ${submission.make} ${submission.model}`;
}

export function formatPendingApprovalEmailHtml({ submission, recommendedCounterOffer, host = '' }) {
  const vehicleTitle = [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(' ');
  const counter =
    recommendedCounterOffer != null ? currencyFormatter.format(recommendedCounterOffer) : 'Pending review';
  const row = (label, value) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666;">${label}</td><td style="padding:4px 0;font-weight:bold;">${value}</td></tr>`;

  return (
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">` +
    `<h2 style="color:#111;">🔥 New CarBoyZ Lead Alert</h2>` +
    `<table style="border-collapse:collapse;">` +
    row('VIN', submission.vin || '—') +
    row('Vehicle', vehicleTitle || '—') +
    row('Mileage', submission.mileage != null ? Number(submission.mileage).toLocaleString('en-US') : '—') +
    row('Competitor Offer', `${competitorLabel(submission)} ${currencyFormatter.format(submission.competitorOfferAmount)}`) +
    row('Recommended Counter', counter) +
    `</table>` +
    `<p><a href="${host}/dealer?sub=${submission.id}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">Review in Dealer Desk</a></p>` +
    `</div>`
  );
}

/**
 * Fans a PENDING_APPROVAL lead out to the dealer roster via SMS, strictly to members with
 * notifyOnPending: true. Exposes both the direct `notifyPendingApproval` call and a generic
 * `notify(notification)` so it can be wired in as DispatchService's `notifier` (see
 * DispatchService.buildApprovalNotification, which carries the full submission through).
 */
export class NotificationService {
  constructor({ dealerProfileService, smsAdapter = new ConsoleSmsAdapter(), emailAdapter = null, host = '' } = {}) {
    if (!dealerProfileService) {
      throw new Error('NotificationService requires a dealerProfileService');
    }
    this.dealerProfileService = dealerProfileService;
    this.smsAdapter = smsAdapter;
    this.emailAdapter = emailAdapter;
    this.host = host;
  }

  notifyPendingApproval({ submission, host = this.host } = {}) {
    const message = formatPendingApprovalSms({ submission, host });
    const recipients = this.dealerProfileService.listMembers().filter((member) => member.notifyOnPending === true);
    return recipients.map((member) => dispatchToMember(this.smsAdapter, member, message));
  }

  /**
   * Dispatches the single dealer alert email for a PENDING_APPROVAL lead — unlike SMS, this goes
   * once to DEALER_ALERT_EMAIL (resolved server-side), not fanned out per roster member. A no-op
   * when no emailAdapter is configured (Resend is optional, SMS still works without it).
   */
  notifyPendingApprovalEmail({ submission, recommendedCounterOffer, host = this.host } = {}) {
    if (!this.emailAdapter) {
      return null;
    }
    return this.emailAdapter.sendEmail({
      subject: formatPendingApprovalEmailSubject({ submission }),
      html: formatPendingApprovalEmailHtml({ submission, recommendedCounterOffer, host }),
    });
  }

  /**
   * Fans SMS out to the roster and fires the single dealer alert email concurrently via
   * Promise.allSettled, so a Twilio outage (e.g. A2P 10DLC error 30034) and a Resend outage never
   * block each other.
   */
  notify(notification) {
    if (!notification?.submission) {
      return [];
    }
    const smsResults = this.notifyPendingApproval({ submission: notification.submission });
    const emailResult = this.notifyPendingApprovalEmail({
      submission: notification.submission,
      recommendedCounterOffer: notification.recommendedCounterOffer,
    });
    if (!emailResult) {
      return smsResults;
    }
    return Promise.allSettled([...smsResults, emailResult]);
  }

  /** Nags the same notifyOnPending roster as a fresh PENDING_APPROVAL lead (UOW-50). */
  notifyEscalation({ submission, elapsedMinutes, host = this.host } = {}) {
    const message = formatEscalationSms({ submission, elapsedMinutes, host });
    const recipients = this.dealerProfileService.listMembers().filter((member) => member.notifyOnPending === true);
    return recipients.map((member) => dispatchToMember(this.smsAdapter, member, message));
  }

  /** Rolls up overnight-queued leads into a single SMS to desk managers, not the full roster. */
  notifyMorningDigest({ count, host = this.host } = {}) {
    const message = formatMorningDigestSms({ count, host });
    const recipients = this.dealerProfileService
      .listMembers()
      .filter((member) => member.role === TEAM_MEMBER_ROLES.MANAGER);
    return recipients.map((member) => dispatchToMember(this.smsAdapter, member, message));
  }
}
