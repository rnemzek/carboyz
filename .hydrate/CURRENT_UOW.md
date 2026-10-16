# Unit of Work: UOW-55
# Title: Production Rollout, Provider Credentials & Deployment Verification

- [ ] Task 1: Environment Variables Configuration
  - Set production SMS provider secrets in Railway dashboard:
    - Primary (Telnyx): TELNYX_API_KEY, TELNYX_FROM_NUMBER
    - Secondary/Fallback (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
  - Verify PORT and host bindings are configured for Railway container execution.

- [ ] Task 2: Production Deployment
  - Push latest release commits (0e87f9d+) to origin main.
  - Monitor Railway deployment logs to ensure clean build, zero-dependency bundle packaging, and successful Hono server initialization.

- [ ] Task 3: Live SMS & Lead Dispatch Smoke Test
  - Access live deployment at https://<your-railway-domain>/dealer.
  - Authenticate with basicAuth (admin / carboyz2026) and Admin PIN (1234).
  - Add active test phone number to Dealer Team Roster with Manager role.
  - Submit live 3-pillar test lead (VIN, Mileage, Offer Doc) on public intake (/).
  - Confirm production SMS alert delivers directly to the physical mobile device via POST /api/v1/notifications/sms.

- [x] [UOW-HOTFIX] Fix "Illegal invocation" crash in NotificationService.js: TwilioSmsAdapter/FetchSmsAdapter default `fetchImpl = fetch` lost its Window receiver when invoked as `this.fetchImpl(...)`; bound to `fetch.bind(globalThis)` in both constructors. Verified: 821/821 tests pass.

- [x] [UOW-HOTFIX] Fix "No SMS provider credentials configured" under @hono/node-server locally: the /sms route handler now falls back to the process.env-backed `env` closure when `c.env` is undefined or empty (c.env is only populated by Hono's non-Node runtime adapters). Verified: 821/821 tests pass.

- [x] [UOW-HOTFIX] Move the c.env/process.env fallback from the route handler into dispatchSms itself: resolves `activeEnv` at the top of dispatchSms (falls back to process.env whenever the passed env has zero keys), and the /sms handler now just passes `c.env ?? env` through safely. Verified: 821/821 tests pass.

- [x] [UOW-HOTFIX] Fix router-level env fallback: `c.env ?? env` never fell through because c.env comes back empty/undefined (not strictly null) under @hono/node-server, which `??` doesn't catch. Handler now checks Object.keys(c.env).length explicitly, falling back to the configured `env` closure (preserving test injection) before dispatchSms's own process.env fallback. Verified: 821/821 tests pass.

- [ ] Task 4: Dealer Hand-off & Archival
  - Verify all 821+ tests remain passing.
  - Deliver live URL, basicAuth credentials, and onboarding notes to dealership operator.
  - Update .hydrate journals, archive UOW-55 to .hydrate/archive/UOW-55.md, and commit clean.
