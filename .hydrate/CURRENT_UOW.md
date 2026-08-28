# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: carboyz
Working Directory (absolute): /Users/rnemzek/Projects/personal/carboyz

⚠ SAFETY: Before executing any file edits, confirm your current working
directory and open project match the path above exactly. If they do not
match, STOP and alert the Product Owner instead of proceeding.

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Architectural & System Execution Rules
See AI_PROJECT_RULES.md at repo root (Operating Triad Contract, Quality Gates, Surgical Execution Boundaries, Fast-Path Protocol).

## Target Task Scope & Active Sprint

### UOW-20 — Cellular Tenant Backend & Real-Time WebSocket Sync Service (Epic 1 Phase 1)

**Objective**
Implement a lightweight Hono-based Node.js backend service with WebSocket relay support to enable real-time, cross-device submission and state synchronization across isolated tenant cells (e.g. physical phone intake → desktop lead inbox), while maintaining `BroadcastChannel` as an offline/local fallback.

**Acceptance Criteria**
1. **Cellular Hono Backend Service (`src/server/index.js` or `server.js`)**:
   - HTTP ingress server powered by Hono (`@hono/node-server` or Node native adapter).
   - Ingress content routing for tenant isolation (resolving tenant cell via subdomains `tenant.domain.com` or explicit query/header route `/api/v1/tenants/:tenantId`).
   - Endpoint `/api/v1/health` returning `{ status: "ok", uptime: number }`.
2. **WebSocket Real-Time Sync Server (`src/server/wsRelay.js`)**:
   - Manages tenant-scoped WebSocket client connections.
   - When a client emits `SUBMISSION_CREATED` or `POLICY_UPDATED`, broadcast the event to all other clients connected under the same `tenantId` room/cell.
3. **Client Sync Adapter (`src/services/SyncAdapter.js`)**:
   - Dependency-injected service managing client transport state.
   - Dual-mode synchronization: auto-connects to WebSocket server when reachable; falls back cleanly to `BroadcastChannel` when offline or server is unavailable.
   - Emits standardized events to `SubmissionService` / UI controllers (`SUBMISSION_SYNCED`, `TENANT_POLICY_SYNCED`).
4. **Testing (`tests/server.test.js` & `tests/syncAdapter.test.js`)**:
   - ≥80% line and branch test coverage on new services.
   - Server integration test spinning up an ephemeral port, verifying tenant cell routing, WebSocket connection handshake, and cross-client event broadcasting.
   - Unit tests for `SyncAdapter` demonstrating graceful fallback from socket to `BroadcastChannel` without DOM dependence.
   - Existing 435 tests must remain passing (with same 3 pre-existing `locationAdapter.test.js` env-dependent flakes).

---

### Architecture (Lead Architect step)

**Scope decision — Dependency footprint:** Introduce `hono` and `@hono/node-server` (and standard `ws` dependency for Node engine if needed) as explicit dependencies in `package.json` for server execution. Client components remain ESM zero-dependency modules with DI for socket initialization (`WebSocket` class injection).

**Scope decision — Protocol framing & room isolation:** 
Socket messages use simple JSON payloads:
`{ type: 'SUBMISSION_CREATED', tenantId: string, payload: object, timestamp: number }`
Client messages missing a valid `tenantId` or attempting cross-tenant broadcasts are rejected at the cell boundary.

---

### Proposed File Touches
- `package.json` (modified — add Hono server dependencies & `npm run start:server` script)
- `src/server/index.js` (new — Hono HTTP server & tenant cell ingress router)
- `src/server/wsRelay.js` (new — tenant room management & event broadcaster)
- `src/services/SyncAdapter.js` (new — hybrid WS + BroadcastChannel client transport layer)
- `src/ui/App.js` (modified — initialize `SyncAdapter` into application context)
- `tests/server.test.js` (new — ephemeral Hono + WS integration tests)
- `tests/syncAdapter.test.js` (new — sync adapter unit & fallback tests)
- `docs/journals/dev-journal.md` (updated — log execution delta)

## Execution Instruction
Execute UOW-20 in Plan & Implement mode using Claude Code. Stage, test, verify ≥80% coverage gates, and auto-commit upon clean completion.

