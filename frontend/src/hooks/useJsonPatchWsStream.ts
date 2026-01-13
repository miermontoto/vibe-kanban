import { useEffect, useState, useRef } from 'react';
import { produce } from 'immer';
import { applyPatch } from 'rfc6902';
import type { Operation } from 'rfc6902';
import {
  buildWebSocketUrl,
  calculateBackoffDelay,
  shouldRetryConnection,
  closeWebSocket,
  isWebSocketConnecting,
} from '@/utils/websocketUtils';

type WsJsonPatchMsg = { JsonPatch: Operation[] };
type WsReadyMsg = { Ready: true };
type WsFinishedMsg = { finished: boolean };
type WsMsg = WsJsonPatchMsg | WsReadyMsg | WsFinishedMsg;

interface UseJsonPatchStreamOptions<T> {
  /**
   * Called once when the stream starts to inject initial data
   */
  injectInitialEntry?: (data: T) => void;
  /**
   * Filter/deduplicate patches before applying them
   */
  deduplicatePatches?: (patches: Operation[]) => Operation[];
}

interface UseJsonPatchStreamResult<T> {
  data: T | undefined;
  isConnected: boolean;
  isInitialized: boolean;
  error: string | null;
  isReconnecting: boolean;
  retryCount: number;
}

/**
 * Generic hook for consuming WebSocket streams that send JSON messages with patches
 */
export const useJsonPatchWsStream = <T extends object>(
  endpoint: string | undefined,
  enabled: boolean,
  initialData: () => T,
  options?: UseJsonPatchStreamOptions<T>
): UseJsonPatchStreamResult<T> => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<T | undefined>(undefined);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const finishedRef = useRef<boolean>(false);
  const lastPingRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<number | null>(null);

  const injectInitialEntry = options?.injectInitialEntry;
  const deduplicatePatches = options?.deduplicatePatches;

  function scheduleReconnect() {
    if (retryTimerRef.current) return; // already scheduled
    if (finishedRef.current) return; // stream finished normally, don't reconnect

    const attempt = retryAttemptsRef.current;

    // exponential backoff con jitter usando utility compartida
    // 1s, 2s, 4s, 8s, 16s, 32s (max) con jitter para evitar thundering herd
    const delay = calculateBackoffDelay(attempt);

    setIsReconnecting(true);
    setRetryCount(attempt + 1);

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setRetryNonce((n) => n + 1);
    }, delay);
  }

  useEffect(() => {
    if (!enabled || !endpoint) {
      // Close connection and reset state
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (idleCheckIntervalRef.current) {
        window.clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      retryAttemptsRef.current = 0;
      finishedRef.current = false;
      setData(undefined);
      setIsConnected(false);
      setIsInitialized(false);
      setError(null);
      setIsReconnecting(false);
      setRetryCount(0);
      dataRef.current = undefined;
      return;
    }

    // Initialize data
    if (!dataRef.current) {
      dataRef.current = initialData();

      // Inject initial entry if provided
      if (injectInitialEntry) {
        injectInitialEntry(dataRef.current);
      }
    }

    // Create WebSocket if it doesn't exist
    if (!wsRef.current) {
      // Reset finished flag for new connection
      finishedRef.current = false;

      // Convert HTTP endpoint to WebSocket endpoint using shared utility
      const wsEndpoint = buildWebSocketUrl(endpoint);
      const ws = new WebSocket(wsEndpoint);

      ws.onopen = () => {
        setError(null);
        setIsConnected(true);
        setIsReconnecting(false);
        // Reset backoff on successful connection
        retryAttemptsRef.current = 0;
        setRetryCount(0);
        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        // Reset idle detection
        lastPingRef.current = Date.now();

        // Check for idle connection every 10 seconds
        // si no recibimos mensajes en 45s, asumimos que la conexión está muerta
        if (idleCheckIntervalRef.current) {
          window.clearInterval(idleCheckIntervalRef.current);
        }
        idleCheckIntervalRef.current = window.setInterval(() => {
          const timeSinceLastMessage = Date.now() - lastPingRef.current;
          if (timeSinceLastMessage > 45000 && wsRef.current) {
            console.warn('WebSocket idle for 45s, reconnecting...');
            wsRef.current.close();
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          // Update last message time for idle detection
          lastPingRef.current = Date.now();

          const msg: WsMsg = JSON.parse(event.data);

          // Handle JsonPatch messages (same as SSE json_patch event)
          if ('JsonPatch' in msg) {
            const patches: Operation[] = msg.JsonPatch;
            const filtered = deduplicatePatches
              ? deduplicatePatches(patches)
              : patches;

            const current = dataRef.current;
            if (!filtered.length || !current) return;

            // Use Immer for structural sharing - only modified parts get new references
            const next = produce(current, (draft) => {
              applyPatch(draft, filtered);
            });

            dataRef.current = next;
            setData(next);
          }

          // Handle Ready messages (initial data has been sent)
          if ('Ready' in msg) {
            setIsInitialized(true);
            // Reset retry counter when we successfully receive Ready
            retryAttemptsRef.current = 0;
            setRetryCount(0);
            setError(null);
          }

          // Handle finished messages ({finished: true})
          // Treat finished as terminal - do NOT reconnect
          if ('finished' in msg) {
            finishedRef.current = true;
            ws.close(1000, 'finished');
            wsRef.current = null;
            setIsConnected(false);
            if (idleCheckIntervalRef.current) {
              window.clearInterval(idleCheckIntervalRef.current);
              idleCheckIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error('Failed to process WebSocket message:', err);
          setError('Failed to process stream update');
        }
      };

      ws.onerror = () => {
        // suprime errores esperados de conexión en desarrollo
        // el backend puede no estar disponible al iniciar
        if (import.meta.env.MODE === 'development') {
          console.debug(
            '[WebSocket] Connection error (expected in dev):',
            endpoint
          );
        } else {
          setError('Connection failed');
        }
      };

      ws.onclose = (evt) => {
        setIsConnected(false);
        wsRef.current = null;

        // Do not reconnect if we received a finished message or should not retry
        if (finishedRef.current || !shouldRetryConnection(evt, false)) {
          return;
        }

        // Otherwise, reconnect on unexpected/error closures
        retryAttemptsRef.current += 1;
        scheduleReconnect();
      };

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current;

        // En React Strict Mode (dev), los efectos se montan/desmontan/remontan inmediatamente
        // para detectar bugs. Si cerramos un WebSocket que aún está en CONNECTING,
        // falla con "closed before connection established". Ignorar el primer cleanup.
        if (import.meta.env.DEV && isWebSocketConnecting(ws)) {
          // No cerrar WebSockets que aún están conectándose en dev (Strict Mode)
          return;
        }

        // Clean up WebSocket using shared utility
        closeWebSocket(ws);
        wsRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (idleCheckIntervalRef.current) {
        window.clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      finishedRef.current = false;
      dataRef.current = undefined;
      setData(undefined);
      setIsInitialized(false);
    };
  }, [
    endpoint,
    enabled,
    initialData,
    injectInitialEntry,
    deduplicatePatches,
    retryNonce,
  ]);

  return {
    data,
    isConnected,
    isInitialized,
    error,
    isReconnecting,
    retryCount,
  };
};
