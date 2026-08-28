export const SYNC_EVENTS = Object.freeze({
  SUBMISSION_SYNCED: 'SUBMISSION_SYNCED',
  TENANT_POLICY_SYNCED: 'TENANT_POLICY_SYNCED',
});

const MESSAGE_TYPE_TO_SYNC_EVENT = Object.freeze({
  SUBMISSION_CREATED: SYNC_EVENTS.SUBMISSION_SYNCED,
  POLICY_UPDATED: SYNC_EVENTS.TENANT_POLICY_SYNCED,
});

function channelName(tenantId) {
  return `carboyz:sync:${tenantId}`;
}

function defaultWebSocketClass() {
  return typeof WebSocket === 'function' ? WebSocket : null;
}

function buildSocketUrl(wsUrl, tenantId) {
  const separator = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${separator}tenantId=${encodeURIComponent(tenantId)}`;
}

/**
 * Dual-mode client transport: auto-connects to the WS relay when a `wsUrl` + WebSocket
 * implementation are available and reachable, otherwise (and on any socket error/close) falls
 * back to a tenant-scoped BroadcastChannel — same DI/auto-detect precedent as
 * SessionStashService's `channel` option, `false` opts out explicitly. Never touches the DOM.
 */
export class SyncAdapter {
  constructor({ tenantId, wsUrl = null, WebSocketClass = defaultWebSocketClass(), channel = null } = {}) {
    if (!tenantId) {
      throw new Error('SyncAdapter requires a tenantId');
    }

    this.tenantId = tenantId;
    this.wsUrl = wsUrl;
    this.WebSocketClass = WebSocketClass;
    this.channel = channel ?? (typeof BroadcastChannel === 'function' ? new BroadcastChannel(channelName(tenantId)) : null);
    this.socket = null;
    this.mode = 'disconnected';
    this.listenersByEvent = new Map();
    this.boundChannelHandler = null;
  }

  on(eventName, handler) {
    if (!this.listenersByEvent.has(eventName)) {
      this.listenersByEvent.set(eventName, new Set());
    }
    this.listenersByEvent.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    this.listenersByEvent.get(eventName)?.delete(handler);
  }

  emit(eventName, detail) {
    this.listenersByEvent.get(eventName)?.forEach((handler) => handler(detail));
  }

  connect() {
    if (this.mode !== 'disconnected') {
      return;
    }
    if (!this.wsUrl || typeof this.WebSocketClass !== 'function') {
      this.activateBroadcastFallback();
      return;
    }
    this.connectSocket();
  }

  connectSocket() {
    this.mode = 'connecting';
    const socket = new this.WebSocketClass(buildSocketUrl(this.wsUrl, this.tenantId));
    this.socket = socket;

    socket.onopen = () => {
      this.mode = 'socket';
    };
    socket.onmessage = (event) => this.handleIncoming(event.data);
    socket.onerror = () => this.handleSocketUnavailable();
    socket.onclose = () => this.handleSocketUnavailable();
  }

  handleSocketUnavailable() {
    if (this.mode === 'disconnected' || this.mode === 'broadcast') {
      return;
    }
    this.teardownSocket();
    this.activateBroadcastFallback();
  }

  teardownSocket() {
    if (!this.socket) {
      return;
    }
    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    this.socket.close?.();
    this.socket = null;
  }

  activateBroadcastFallback() {
    this.mode = 'broadcast';
    if (!this.channel || this.boundChannelHandler) {
      return;
    }
    this.boundChannelHandler = (event) => this.handleIncoming(event.data);
    this.channel.addEventListener('message', this.boundChannelHandler);
  }

  handleIncoming(raw) {
    let message;
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    if (!message || message.tenantId !== this.tenantId) {
      return;
    }
    const syncEvent = MESSAGE_TYPE_TO_SYNC_EVENT[message.type];
    if (syncEvent) {
      this.emit(syncEvent, message.payload);
    }
  }

  send(type, payload) {
    const message = { type, tenantId: this.tenantId, payload, timestamp: Date.now() };
    if (this.mode === 'socket' && this.socket) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    this.channel?.postMessage?.(message);
  }

  submitSubmissionCreated(payload) {
    this.send('SUBMISSION_CREATED', payload);
  }

  submitPolicyUpdated(payload) {
    this.send('POLICY_UPDATED', payload);
  }

  disconnect() {
    this.teardownSocket();
    if (this.channel && this.boundChannelHandler) {
      this.channel.removeEventListener('message', this.boundChannelHandler);
      this.boundChannelHandler = null;
    }
    this.mode = 'disconnected';
  }
}
