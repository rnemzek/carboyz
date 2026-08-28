# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: carboyz
Working Directory (absolute): /Users/rnemzek/Projects/personal/carboyz

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Target Task Scope

### UOW-20 — Cellular Tenant Backend & Real-Time WebSocket Sync Service (Epic 1 Phase 1)

**Objective**
Implement a lightweight Hono-based Node.js backend service with WebSocket relay support to enable real-time, cross-device submission and state synchronization across isolated tenant cells, while maintaining `BroadcastChannel` as an offline/local fallback.

**Acceptance Criteria**
1. **Cellular Hono Backend Service (`src/server/index.js`)**:
   - HTTP ingress server powered by Hono (`@hono/node-server`).
   - Tenant isolation routing via `/api/v1/tenants/:tenantId`.
   - Endpoint `/api/v1/health` returning `{ status: "ok", uptime: number }`.
2. **WebSocket Real-Time Sync Server (`src/server/wsRelay.js`)**:
   - Tenant-scoped WebSocket client room connections.
   - Broadcast events (`SUBMISSION_CREATED`, `POLICY_UPDATED`) across connected clients in the same `tenantId` room.
3. **Client Sync Adapter (`src/services/SyncAdapter.js`)**:
   - Dependency-injected service managing client transport state.
   - Dual-mode sync: connects to WebSocket when online, falls back to `BroadcastChannel` offline.
4. **Testing & Coverage (`tests/server.test.js`, `tests/syncAdapter.test.js`)**:
   - Maintain ≥80% test coverage on new server/adapter modules.
   - Server integration tests spinning up ephemeral port for WS broadcasts.
   - All existing tests pass.
5. **Log Completion**:
   - Append execution summary directly to `docs/SYSTEM.md` (Section 4: Decision & Execution Log).
