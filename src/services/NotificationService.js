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
 * Fans a PENDING_APPROVAL lead out to the dealer roster via SMS, strictly to members with
 * notifyOnPending: true. Exposes both the direct `notifyPendingApproval` call and a generic
 * `notify(notification)` so it can be wired in as DispatchService's `notifier` (see
 * DispatchService.buildApprovalNotification, which carries the full submission through).
 */
export class NotificationService {
  constructor({ dealerProfileService, smsAdapter = new ConsoleSmsAdapter(), host = '' } = {}) {
    if (!dealerProfileService) {
      throw new Error('NotificationService requires a dealerProfileService');
    }
    this.dealerProfileService = dealerProfileService;
    this.smsAdapter = smsAdapter;
    this.host = host;
  }

  notifyPendingApproval({ submission, host = this.host } = {}) {
    const message = formatPendingApprovalSms({ submission, host });
    const recipients = this.dealerProfileService.listMembers().filter((member) => member.notifyOnPending === true);
    return recipients.map((member) => dispatchToMember(this.smsAdapter, member, message));
  }

  notify(notification) {
    if (!notification?.submission) {
      return [];
    }
    return this.notifyPendingApproval({ submission: notification.submission });
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
