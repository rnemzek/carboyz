import { WebSocketServer } from 'ws';

export const RELAYED_MESSAGE_TYPES = Object.freeze(['SUBMISSION_CREATED', 'POLICY_UPDATED']);

function resolveTenantIdFromRequest(request, path) {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== path) {
      return null;
    }
    return url.searchParams.get('tenantId');
  } catch {
    return null;
  }
}

function isRelayableMessage(message, tenantId) {
  return (
    message !== null &&
    typeof message === 'object' &&
    message.tenantId === tenantId &&
    RELAYED_MESSAGE_TYPES.includes(message.type)
  );
}

/**
 * Tenant-scoped WebSocket relay: rooms are keyed by tenantId, and a SUBMISSION_CREATED /
 * POLICY_UPDATED message from one client is broadcast verbatim to every other client in the
 * same room. `server` is optional so tests can drive `handleUpgrade` directly against a fake
 * request/socket/head triple instead of a real listening http.Server.
 */
export function createWsRelay({ server = null, path = '/ws', WebSocketServerClass = WebSocketServer } = {}) {
  const wss = new WebSocketServerClass({ noServer: true });
  const roomsByTenant = new Map();

  function addToRoom(tenantId, socket) {
    if (!roomsByTenant.has(tenantId)) {
      roomsByTenant.set(tenantId, new Set());
    }
    roomsByTenant.get(tenantId).add(socket);
  }

  function removeFromRoom(tenantId, socket) {
    const room = roomsByTenant.get(tenantId);
    if (!room) {
      return;
    }
    room.delete(socket);
    if (room.size === 0) {
      roomsByTenant.delete(tenantId);
    }
  }

  function broadcast(tenantId, message, { exclude = null } = {}) {
    const room = roomsByTenant.get(tenantId);
    if (!room) {
      return 0;
    }
    const serialized = JSON.stringify(message);
    let delivered = 0;
    room.forEach((client) => {
      if (client === exclude) {
        return;
      }
      if (client.readyState === client.OPEN) {
        client.send(serialized);
        delivered += 1;
      }
    });
    return delivered;
  }

  wss.on('connection', (socket, request, tenantId) => {
    socket.tenantId = tenantId;
    addToRoom(tenantId, socket);

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!isRelayableMessage(message, tenantId)) {
        return;
      }
      broadcast(tenantId, message, { exclude: socket });
    });

    socket.on('close', () => removeFromRoom(tenantId, socket));
  });

  function handleUpgrade(request, socket, head) {
    const tenantId = resolveTenantIdFromRequest(request, path);
    if (!tenantId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request, tenantId);
    });
  }

  if (server) {
    server.on('upgrade', handleUpgrade);
  }

  return {
    wss,
    handleUpgrade,
    broadcast,
    getRoomSize: (tenantId) => roomsByTenant.get(tenantId)?.size ?? 0,
  };
}
