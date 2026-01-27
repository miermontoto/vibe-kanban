import { useCallback, useMemo } from 'react';
import { useJsonPatchWsStream } from './useJsonPatchWsStream';
import type { ActiveTaskWithProject, TaskStatus } from 'shared/types';

// re-export for convenience
export type { ActiveTaskWithProject } from 'shared/types';

type ActiveTasksState = {
  tasks: Record<string, ActiveTaskWithProject>;
};

export interface UseActiveTasksResult {
  tasks: ActiveTaskWithProject[];
  tasksByStatus: Record<TaskStatus, ActiveTaskWithProject[]>;
  tasksByProject: Record<string, ActiveTaskWithProject[]>;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
}

/**
 * Stream active tasks (in progress, in review) across ALL projects.
 * Uses a dedicated WebSocket endpoint that aggregates tasks from all projects.
 * The backend filters to only include tasks with active statuses.
 */
export const useActiveTasksAcrossProjects = (): UseActiveTasksResult => {
  const endpoint = '/api/tasks/active/stream/ws';

  const initialData = useCallback((): ActiveTasksState => ({ tasks: {} }), []);

  const { data, isConnected, isInitialized, error } =
    useJsonPatchWsStream<ActiveTasksState>(endpoint, true, initialData);

  const { tasks, tasksByStatus, tasksByProject } = useMemo(() => {
    const tasksRecord = data?.tasks ?? {};
    const sorted = Object.values(tasksRecord).sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const byStatus: Record<TaskStatus, ActiveTaskWithProject[]> = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
      cancelled: [],
    };

    const byProject: Record<string, ActiveTaskWithProject[]> = {};

    sorted.forEach((task) => {
      byStatus[task.status]?.push(task);

      if (!byProject[task.project_id]) {
        byProject[task.project_id] = [];
      }
      byProject[task.project_id].push(task);
    });

    return {
      tasks: sorted,
      tasksByStatus: byStatus,
      tasksByProject: byProject,
    };
  }, [data?.tasks]);

  const isLoading = !isInitialized && !error;

  return {
    tasks,
    tasksByStatus,
    tasksByProject,
    isLoading,
    isConnected,
    error,
  };
};
