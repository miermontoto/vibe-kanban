import { useCallback, useState, useEffect } from 'react';
import { useJsonPatchWsStream } from './useJsonPatchWsStream';
import type { ExecutionProcess } from 'shared/types';

type ExecutionProcessState = {
  execution_processes: Record<string, ExecutionProcess>;
};

// store optimistic processes globally so they persist across hook instances
const optimisticProcessesStore = new Map<string, ExecutionProcess>();

interface UseExecutionProcessesResult {
  executionProcesses: ExecutionProcess[];
  executionProcessesById: Record<string, ExecutionProcess>;
  isAttemptRunning: boolean;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  addOptimisticProcess: (process: ExecutionProcess) => void;
}

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
  const [optimisticProcesses, setOptimisticProcesses] = useState<
    ExecutionProcess[]
  >([]);
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

  // función para añadir proceso optimista
  const addOptimisticProcess = useCallback((process: ExecutionProcess) => {
    optimisticProcessesStore.set(process.id, process);
    setOptimisticProcesses(Array.from(optimisticProcessesStore.values()));
  }, []);

  // limpiar procesos optimistas cuando llegan los reales
  useEffect(() => {
    if (!data?.execution_processes) return;

    const realProcessIds = Object.keys(data.execution_processes);
    let hasChanges = false;

    // eliminar procesos optimistas que ya están en los datos reales
    optimisticProcessesStore.forEach((_, id) => {
      if (realProcessIds.includes(id)) {
        optimisticProcessesStore.delete(id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setOptimisticProcesses(Array.from(optimisticProcessesStore.values()));
    }
  }, [data]);

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
