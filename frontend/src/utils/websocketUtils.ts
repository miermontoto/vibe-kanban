/**
 * Shared WebSocket utilities for consistent connection handling across the app
 */

/**
 * Construct WebSocket URL, bypassing Vite proxy in development
 *
 * En desarrollo, Vite tiene un bug conocido con WebSockets (https://github.com/vitejs/vite/issues/20223)
 * donde no reenvía correctamente las conexiones WebSocket. Para evitarlo, conectamos directamente
 * al puerto del backend.
 */
export function buildWebSocketUrl(endpoint: string): string {
  if (import.meta.env.DEV && endpoint.startsWith('/api/')) {
    // En desarrollo: conectar directamente al puerto del backend
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3001';
    return `ws://localhost:${backendPort}${endpoint}`;
  }

  // En producción o URLs absolutas
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint.replace(/^http/, 'ws');
  }

  // Para URLs relativas en producción, usar protocolo según ubicación actual
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${endpoint}`;
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 32000)
 * @param jitterAmount - Maximum jitter in milliseconds (default: 1000)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 32000,
  jitterAmount = 1000
): number {
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = Math.random() * jitterAmount;
  return exponentialDelay + jitter;
}

/**
 * Check if a process ID is optimistic (client-side only, doesn't exist on backend)
 */
export function isOptimisticProcessId(processId: string): boolean {
  return processId.startsWith('optimistic-');
}

/**
 * WebSocket ready state helpers
 */
export const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

export function isWebSocketConnecting(ws: WebSocket): boolean {
  return ws.readyState === WebSocketState.CONNECTING;
}

export function isWebSocketOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocketState.OPEN;
}

export function isWebSocketClosing(ws: WebSocket): boolean {
  return ws.readyState === WebSocketState.CLOSING;
}

export function isWebSocketClosed(ws: WebSocket): boolean {
  return ws.readyState === WebSocketState.CLOSED;
}

/**
 * Safely close a WebSocket connection and clear event handlers
 */
export function closeWebSocket(ws: WebSocket | null): void {
  if (!ws) return;

  // Clear event handlers to prevent callbacks after cleanup
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;

  // Close if not already closed/closing
  if (
    ws.readyState === WebSocketState.OPEN ||
    ws.readyState === WebSocketState.CONNECTING
  ) {
    ws.close();
  }
}

/**
 * Check if a close event indicates a normal closure
 */
export function isNormalClosure(event: CloseEvent): boolean {
  return event.code === 1000 && event.wasClean;
}

/**
 * Check if we should retry connection after close event
 */
export function shouldRetryConnection(
  event: CloseEvent,
  intentionallyClosed: boolean
): boolean {
  return !intentionallyClosed && !isNormalClosure(event);
}
