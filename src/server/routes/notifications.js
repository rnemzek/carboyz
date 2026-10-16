import { Hono } from 'hono';

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Normalizes a 10-digit US number or an already-E.164 number to strict E.164 for provider dispatch. */
export function normalizePhoneToE164(rawPhone) {
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    throw new Error('to is required');
  }

  const trimmed = rawPhone.trim();

  if (trimmed.startsWith('+')) {
    const candidate = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    if (!E164_PATTERN.test(candidate)) {
      throw new Error('to must be a valid E.164 phone number');
    }
    return candidate;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    throw new Error('to must be a 10-digit US number or E.164 format (e.g. +15550100100)');
  }
  return `+1${digitsOnly}`;
}

/**
 * Dispatches one SMS via native fetch, straight to the provider REST API — no SDK dependency.
 * Telnyx is primary (TELNYX_API_KEY + TELNYX_FROM_NUMBER); Twilio is the fallback when Telnyx
 * isn't configured (UOW-54).
 */
export async function dispatchSms({ to, message, env = process.env, fetchImpl = fetch }) {
  // The `env = process.env` default only fires when the caller omits `env` entirely; a caller
  // passing `c.env` (which is `{}` under @hono/node-server) still wins the default and leaves us
  // with no credentials, so fall back explicitly whenever the resolved env has no keys.
  const activeEnv = env && Object.keys(env).length > 0 ? env : process.env;
  const { TELNYX_API_KEY, TELNYX_FROM_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = activeEnv;

  if (TELNYX_API_KEY && TELNYX_FROM_NUMBER) {
    const response = await fetchImpl('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: TELNYX_FROM_NUMBER, to, text: message }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: body?.errors?.[0]?.detail || `Telnyx dispatch failed (HTTP ${response.status})` };
    }
    return { success: true, messageId: body?.data?.id ?? null };
  }

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: message });
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: body?.message || `Twilio dispatch failed (HTTP ${response.status})` };
    }
    return { success: true, messageId: body?.sid ?? null };
  }

  return { success: false, error: 'No SMS provider credentials configured' };
}

/** Mounts POST /sms (relative to wherever the caller `app.route()`s this in, e.g. /api/v1/notifications). */
export function createNotificationsRouter({ env = process.env, fetchImpl = fetch } = {}) {
  const router = new Hono();

  router.post('/sms', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.to !== 'string' || typeof body.message !== 'string') {
      return c.json({ success: false, error: 'to and message are required' }, 500);
    }

    let normalizedTo;
    try {
      normalizedTo = normalizePhoneToE164(body.to);
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }

    // c.env is populated by Hono's runtime adapter (e.g. Cloudflare Workers); @hono/node-server
    // never sets it. Pass it through safely (it may be undefined) — dispatchSms falls back to
    // process.env itself when the resolved env turns out empty.
    const result = await dispatchSms({ to: normalizedTo, message: body.message, env: c.env ?? env, fetchImpl });
    return c.json(result, result.success ? 200 : 500);
  });

  return router;
}
