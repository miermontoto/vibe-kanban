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
}

// timeout después del cual se eliminan procesos optimistas huérfanos (30 segundos)
const OPTIMISTIC_PROCESS_TIMEOUT_MS = 30000;

/**
 * Stream execution processes for a task attempt via WebSocket (JSON Patch) and expose as array + map.
 * Server sends initial snapshot: replace /execution_processes with an object keyed by id.
 * Live updates arrive at /execution_processes/<id> via add/replace/remove operations.
 */
export const useExecutionProcesses = (
  taskAttemptId: string | undefined,
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
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  let endpoint: string | undefined;

  if (taskAttemptId) {
    const params = new URLSearchParams({ workspace_id: taskAttemptId });
    if (typeof showSoftDeleted === 'boolean') {
      params.set('show_soft_deleted', String(showSoftDeleted));
    }
    endpoint = `/api/execution-processes/stream/ws?${params.toString()}`;
  }

  const initialData = useCallback(
    (): ExecutionProcessState => ({ execution_processes: {} }),
    []
  );

  const { data, isConnected, error } =
    useJsonPatchWsStream<ExecutionProcessState>(
      endpoint,
      !!taskAttemptId,
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

  // limpiar procesos optimistas cuando llegan los reales
  useEffect(() => {
    if (!data?.execution_processes) return;

    const realProcesses = Object.values(data.execution_processes);
    let hasChanges = false;

    // eliminar procesos optimistas si aparece un proceso real reciente del mismo tipo
    // usamos matching temporal: si un proceso real tiene un timestamp cercano (±5s)
    // y es del mismo tipo (codingagent), asumimos que es la versión real del optimista
    optimisticProcessesRef.current.forEach((entry, optimisticId) => {
      const optimisticTimestamp = entry.timestamp;

      const matchingRealProcess = realProcesses.find((realProc) => {
        if (realProc.run_reason !== 'codingagent') return false;

        const realTimestamp = new Date(realProc.created_at).getTime();
        const timeDiff = Math.abs(realTimestamp - optimisticTimestamp);

        // considerar match si el proceso real fue creado dentro de 5 segundos del optimista
        return timeDiff < 5000;
      });

      if (matchingRealProcess) {
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
  // solo ejecutar cuando hay procesos optimistas activos
  useEffect(() => {
    // no iniciar timer si no hay procesos optimistas
    if (optimisticProcesses.length === 0) {
      return;
    }

    // limpiar timer previo si existe
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
    }

    cleanupTimerRef.current = setInterval(() => {
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

      // detener timer si no quedan procesos optimistas
      if (optimisticProcessesRef.current.size === 0 && cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    }, 5000); // revisar cada 5 segundos

    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, [optimisticProcesses.length]); // re-run cuando cambia el número de procesos

  // limpiar todos los procesos optimistas al desmontar o cambiar taskAttemptId
  useEffect(() => {
    return () => {
      optimisticProcessesRef.current.clear();
      setOptimisticProcesses([]);
    };
  }, [taskAttemptId]);

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
  const isLoading = !!taskAttemptId && !data && !error; // until first snapshot

  return {
    executionProcesses,
    executionProcessesById,
    isAttemptRunning,
    isLoading,
    isConnected,
    error,
    addOptimisticProcess,
  };
};
