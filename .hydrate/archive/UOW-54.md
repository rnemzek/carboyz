# Unit of Work: UOW-54
# Title: Production Server-Side SMS Relay & Provider Dispatch

- [x] Task 1: Server-Side SMS Route (src/server/routes/notifications.js & src/server/index.js)
  - Create Hono route `POST /api/v1/notifications/sms` protected by session/basicAuth.
  - Accept payload: `{ to: string, message: string }`.
  - Validate E.164 phone formatting (normalize 10-digit US numbers to `+1XXXXXXXXXX`).
  - Read provider credentials from environment variables:
    - Primary (Telnyx): `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`.
    - Secondary/Fallback (Twilio): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
  - Dispatch via native `fetch()` directly to the provider's REST API:
    - If Telnyx: `POST https://api.telnyx.com/v2/messages` with Bearer auth.
    - If Twilio: `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` with Basic auth.
  - Return `{ success: true, messageId: "..." }` or `{ success: false, error: "..." }` with 200/500 status.

- [x] Task 2: Client FetchSmsAdapter (src/services/NotificationService.js & src/ui/App.js)
  - Implement `FetchSmsAdapter` implementing the standard SMS adapter interface.
  - Dispatch POST requests to `/api/v1/notifications/sms` with standard JSON payload.
  - If the server endpoint returns a failure or credentials are unset, log an explicit warning to console without throwing unhandled exceptions.
  - Mount `FetchSmsAdapter` as the primary SMS adapter in production runtime.

- [x] Task 3: Phone Number Normalization & Team Roster Hook (src/services/DealerProfileService.js — no src/models/DealerTeam.js exists in this repo; team-member records live in DealerProfileService, so the normalization fix landed there, see scope note below)
  - Ensure dealer team member records validate and format mobile numbers cleanly for SMS dispatch.
  - Verify `LeadEscalationService` passes desk manager phone numbers cleanly into `NotificationService`.

- [x] Task 4: Testing & Quality Gates
  - Unit tests for `POST /api/v1/notifications/sms` covering valid payload dispatch, mock HTTP responses, and missing credential error states.
  - Unit tests for `FetchSmsAdapter` verifying network call formatting and offline resiliency.
  - Ensure all 801+ existing tests pass without regressions.
  - Append completion records to .hydrate journals, archive UOW-54 to `.hydrate/archive/UOW-54.md`, and commit clean.
