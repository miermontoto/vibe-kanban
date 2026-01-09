import { useCallback, useMemo } from 'react';
import { useJsonPatchWsStream } from './useJsonPatchWsStream';
import type { ProjectWithTaskCounts } from 'shared/types';

type ProjectsState = {
  projects: Record<string, ProjectWithTaskCounts>;
};

export interface UseProjectsResult {
  projects: ProjectWithTaskCounts[];
  projectsById: Record<string, ProjectWithTaskCounts>;
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function useProjects(): UseProjectsResult {
  const endpoint = '/api/projects/stream/ws';

  const initialData = useCallback((): ProjectsState => ({ projects: {} }), []);

  const { data, isConnected, isInitialized, error } =
    useJsonPatchWsStream<ProjectsState>(endpoint, true, initialData);

  const projectsById = useMemo(() => data?.projects ?? {}, [data]);

  const projects = useMemo(() => {
    // backend ordena los proyectos por actividad reciente (task updates)
    // con fallback a created_at, así que solo convertimos el record a array
    return Object.values(projectsById);
  }, [projectsById]);

  const projectsData = data ? projects : undefined;
  const errorObj = useMemo(() => (error ? new Error(error) : null), [error]);

  return {
    projects: projectsData ?? [],
    projectsById,
    isLoading: !isInitialized && !error,
    isConnected,
    error: errorObj,
  };
}
