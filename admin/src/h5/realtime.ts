const HEARTBEAT_INTERVAL_MS = 2_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

type RealtimeOptions = {
  url: string;
  heartbeatPayload?: () => unknown;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
};

export type RealtimeConnection = {
  close: () => void;
  send: (data: unknown) => boolean;
};

function isPong(data: unknown) {
  if (typeof data !== "string") return false;
  try {
    return JSON.parse(data).type === "pong";
  } catch {
    return false;
  }
}

// 2026-10-02 01:00:38 CST：H5 WebSocket 每 2 秒发送含当前题号的心跳，保留 10 秒超时断开和指数退避重连。
// 触发场景：H5 页面切换 key 后及时同步访客题号，并在网络切换或服务端重启后恢复订阅。
// 维护注意：Admin 使用独立 realtime 模块，调整本间隔只影响 H5；清理函数必须在路由卸载时调用。
export function connectRealtime(options: RealtimeOptions): RealtimeConnection {
  let disposed = false;
  let socket: WebSocket | null = null;
  let heartbeatTimer: number | null = null;
  let heartbeatTimeout: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;

  const clearHeartbeat = () => {
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
    heartbeatTimer = null;
    heartbeatTimeout = null;
  };

  const sendHeartbeat = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(options.heartbeatPayload?.() ?? { type: "ping" }));
    if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
    heartbeatTimeout = window.setTimeout(() => {
      socket?.close(4000, "heartbeat timeout");
    }, HEARTBEAT_TIMEOUT_MS);
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
      MAX_RECONNECT_DELAY_MS,
    );
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (disposed) return;
    const nextSocket = new WebSocket(options.url);
    socket = nextSocket;

    nextSocket.onopen = () => {
      reconnectAttempt = 0;
      options.onOpen?.();
      sendHeartbeat();
      heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };
    nextSocket.onmessage = (event) => {
      if (isPong(event.data)) {
        if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
        return;
      }
      options.onMessage?.(event);
    };
    nextSocket.onerror = () => {
      options.onError?.();
      nextSocket.close();
    };
    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      socket = null;
      clearHeartbeat();
      if (!disposed) {
        options.onClose?.();
        scheduleReconnect();
      }
    };
  };

  connect();

  return {
    send: (data: unknown) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    },
    close: () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      clearHeartbeat();
      socket?.close();
      socket = null;
    },
  };
}
