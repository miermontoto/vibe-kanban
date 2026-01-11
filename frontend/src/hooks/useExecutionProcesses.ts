import { useCallback, useState, useEffect, useRef } from 'react';
import { useJsonPatchWsStream } from './useJsonPatchWsStream';
import type { ExecutionProcess } from 'shared/types';

type ExecutionProcessState = {
  execution_processes: Record<string, ExecutionProcess>;
};

interface OptimisticProcessEntry {
  process: ExecutionProcess;
  timestamp: number;
}

interface UseExecutionProcessesResult {
  executionProcesses: ExecutionProcess[];
  executionProcessesById: Record<string, ExecutionProcess>;
  isAttemptRunning: boolean;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  addOptimisticProcess: (process: ExecutionProcess) => void;
  removeOptimisticProcess: (processId: string) => void;
}

// timeout después del cual se eliminan procesos optimistas huérfanos (30 segundos)
const OPTIMISTIC_PROCESS_TIMEOUT_MS = 30000;

/**
 * Stream execution processes for a session via WebSocket (JSON Patch) and expose as array + map.
 * Server sends initial snapshot: replace /execution_processes with an object keyed by id.
 * Live updates arrive at /execution_processes/<id> via add/replace/remove operations.
 */
export const useExecutionProcesses = (
  sessionId: string | undefined,
  opts?: { showSoftDeleted?: boolean }
): UseExecutionProcessesResult => {
  const showSoftDeleted = opts?.showSoftDeleted;

  // store optimista local a esta instancia del hook, con timestamps
  const optimisticProcessesRef = useRef<Map<string, OptimisticProcessEntry>>(
    new Map()
  );
  const [optimisticProcesses, setOptimisticProcesses] = useState<
    ExecutionProcess[]
  >([]);

  let endpoint: string | undefined;

  if (sessionId) {
    const params = new URLSearchParams({ session_id: sessionId });
    if (typeof showSoftDeleted === 'boolean') {
      params.set('show_soft_deleted', String(showSoftDeleted));
    }
    endpoint = `/api/execution-processes/stream/session/ws?${params.toString()}`;
  }

  const initialData = useCallback(
    (): ExecutionProcessState => ({ execution_processes: {} }),
    []
  );

  const { data, isConnected, isInitialized, error } =
    useJsonPatchWsStream<ExecutionProcessState>(
      endpoint,
      !!sessionId,
      initialData
    );

  // función para añadir proceso optimista con timestamp
  const addOptimisticProcess = useCallback((process: ExecutionProcess) => {
    optimisticProcessesRef.current.set(process.id, {
      process,
      timestamp: Date.now(),
    });
    setOptimisticProcesses(
      Array.from(optimisticProcessesRef.current.values()).map(
        (entry) => entry.process
      )
    );
  }, []);

  // función para eliminar proceso optimista manualmente (ej: en caso de error)
  const removeOptimisticProcess = useCallback((processId: string) => {
    if (optimisticProcessesRef.current.has(processId)) {
      optimisticProcessesRef.current.delete(processId);
      setOptimisticProcesses(
        Array.from(optimisticProcessesRef.current.values()).map(
          (entry) => entry.process
        )
      );
    }
  }, []);

  // limpiar procesos optimistas cuando llegan los reales
  useEffect(() => {
    if (!data?.execution_processes) return;

    const realProcesses: ExecutionProcess[] = Object.values(
      data.execution_processes
    );
    let hasChanges = false;

    // track de procesos reales ya emparejados para evitar doble-matching
    const matchedRealProcessIds = new Set<string>();

    // eliminar procesos optimistas si aparece un proceso real reciente del mismo tipo
    // usamos matching temporal: si un proceso real tiene un timestamp cercano (±5s)
    // y es del mismo tipo (codingagent), asumimos que es la versión real del optimista
    //
    // ordenar optimistas por timestamp (más antiguos primero) para emparejar en orden FIFO
    const sortedOptimistic: Array<[string, OptimisticProcessEntry]> = Array.from(
      optimisticProcessesRef.current.entries()
    ).sort(([, a], [, b]) => a.timestamp - b.timestamp);

    sortedOptimistic.forEach(([optimisticId, entry]) => {
      const optimisticTimestamp = entry.timestamp;

      // buscar el proceso real más cercano que aún no ha sido emparejado
      let bestMatch: ExecutionProcess | null = null;
      let bestTimeDiff = Infinity;

      realProcesses.forEach((realProc) => {
        if (realProc.run_reason !== 'codingagent') return;
        if (matchedRealProcessIds.has(realProc.id)) return; // skip si ya fue emparejado

        const realTimestamp = new Date(realProc.created_at).getTime();
        const timeDiff = Math.abs(realTimestamp - optimisticTimestamp);

        // considerar match si está dentro de 5 segundos y es el más cercano
        if (timeDiff < 5000 && timeDiff < bestTimeDiff) {
          bestMatch = realProc;
          bestTimeDiff = timeDiff;
        }
      });

      if (bestMatch !== null) {
        matchedRealProcessIds.add((bestMatch as ExecutionProcess).id);
        optimisticProcessesRef.current.delete(optimisticId);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setOptimisticProcesses(
        Array.from(optimisticProcessesRef.current.values()).map(
          (entry) => entry.process
        )
      );
    }
  }, [data]);

  // cleanup automático de procesos optimistas expirados
  // timer único que se ejecuta periódicamente independientemente de los cambios en el estado
  useEffect(() => {
    const timer = setInterval(() => {
      // skip si no hay procesos optimistas
      if (optimisticProcessesRef.current.size === 0) {
        return;
      }

      const now = Date.now();
      let hasChanges = false;

      optimisticProcessesRef.current.forEach((entry, id) => {
        if (now - entry.timestamp > OPTIMISTIC_PROCESS_TIMEOUT_MS) {
          optimisticProcessesRef.current.delete(id);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setOptimisticProcesses(
          Array.from(optimisticProcessesRef.current.values()).map(
            (entry) => entry.process
          )
        );
      }
    }, 5000); // revisar cada 5 segundos

    // cleanup garantizado al desmontar
    return () => {
      clearInterval(timer);
    };
  }, []); // ejecutar una sola vez al montar

  // limpiar todos los procesos optimistas al desmontar o cambiar sessionId
  useEffect(() => {
    const optimisticProcessesMap = optimisticProcessesRef.current;
    return () => {
      optimisticProcessesMap.clear();
      setOptimisticProcesses([]);
    };
  }, [sessionId]);

  // combinar procesos reales con optimistas
  const executionProcessesById = data?.execution_processes
    ? {
        ...data.execution_processes,
        ...Object.fromEntries(optimisticProcesses.map((p) => [p.id, p])),
      }
    : {};

  const executionProcesses = Object.values(executionProcessesById).sort(
    (a, b) =>
      new Date(a.created_at as unknown as string).getTime() -
      new Date(b.created_at as unknown as string).getTime()
  );
  const isAttemptRunning = executionProcesses.some(
    (process) =>
      (process.run_reason === 'codingagent' ||
        process.run_reason === 'setupscript' ||
        process.run_reason === 'cleanupscript') &&
      process.status === 'running'
  );
  const isLoading = !!sessionId && !isInitialized && !error; // until first snapshot

  return {
    executionProcesses,
    executionProcessesById,
    isAttemptRunning,
    isLoading,
    isConnected,
    error,
    addOptimisticProcess,
    removeOptimisticProcess,
  };
};
