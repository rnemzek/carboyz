import { TEAM_MEMBER_ROLES } from './DealerProfileService.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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
  constructor({ accountSid, authToken, fromNumber, fetchImpl = fetch } = {}) {
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
    return recipients.map((member) => this.smsAdapter.sendSms({ to: member.phone, body: message }));
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
    return recipients.map((member) => this.smsAdapter.sendSms({ to: member.phone, body: message }));
  }

  /** Rolls up overnight-queued leads into a single SMS to desk managers, not the full roster. */
  notifyMorningDigest({ count, host = this.host } = {}) {
    const message = formatMorningDigestSms({ count, host });
    const recipients = this.dealerProfileService
      .listMembers()
      .filter((member) => member.role === TEAM_MEMBER_ROLES.MANAGER);
    return recipients.map((member) => this.smsAdapter.sendSms({ to: member.phone, body: message }));
  }
}
