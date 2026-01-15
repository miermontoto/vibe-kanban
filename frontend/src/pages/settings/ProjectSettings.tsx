import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { isEqual } from 'lodash';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  FolderGit2,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useProjectMutations } from '@/hooks/useProjectMutations';
import { RepoPickerDialog } from '@/components/dialogs/shared/RepoPickerDialog';
import { GitProjectSettings } from '@/components/settings/GitProjectSettings';
import { AutoExpandingTextarea } from '@/components/ui/auto-expanding-textarea';
import { MultiFileSearchTextarea } from '@/components/ui/multi-file-search-textarea';
import { useScriptPlaceholders } from '@/hooks/useScriptPlaceholders';
import { projectsApi, repoApi } from '@/lib/api';
import { repoBranchKeys } from '@/hooks/useRepoBranches';
import type { Project, Repo, UpdateProject, UpdateRepo } from 'shared/types';

interface ProjectFormState {
  name: string;
  git_auto_commit_enabled: boolean | null;
  git_commit_title_mode: string | null;
  auto_pr_on_review_enabled: boolean | null;
  auto_pr_draft: boolean | null;
  redirect_to_attempt_on_create: boolean | null;
}

interface RepoFormState {
  display_name: string;
  setup_script: string;
  parallel_setup_script: boolean;
  cleanup_script: string;
  copy_files: string;
  dev_server_script: string;
}

function projectToFormState(project: Project): ProjectFormState {
  return {
    name: project.name,
    git_auto_commit_enabled: project.git_auto_commit_enabled,
    git_commit_title_mode: project.git_commit_title_mode,
    auto_pr_on_review_enabled: project.auto_pr_on_review_enabled,
    auto_pr_draft: project.auto_pr_draft,
    redirect_to_attempt_on_create: project.redirect_to_attempt_on_create,
  };
}

function repoToFormState(repo: Repo): RepoFormState {
  return {
    display_name: repo.display_name,
    setup_script: repo.setup_script ?? '',
    parallel_setup_script: repo.parallel_setup_script,
    cleanup_script: repo.cleanup_script ?? '',
    copy_files: repo.copy_files ?? '',
    dev_server_script: repo.dev_server_script ?? '',
  };
}

export function ProjectSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId') ?? '';
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();

  // Get OS-appropriate script placeholders
  const placeholders = useScriptPlaceholders();

  // Fetch all projects
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects();

  // Selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get('projectId') || ''
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Project form state
  const [draft, setDraft] = useState<ProjectFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Repositories state
  const [repositories, setRepositories] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [addingRepo, setAddingRepo] = useState(false);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);

  // Repo editing state
  const [repoDrafts, setRepoDrafts] = useState<Record<string, RepoFormState>>(
    {}
  );
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [savingRepoId, setSavingRepoId] = useState<string | null>(null);
  const [repoSuccess, setRepoSuccess] = useState<string | null>(null);

  // Check for unsaved project changes
  const hasUnsavedProjectChanges = useMemo(() => {
    if (!draft || !selectedProject) return false;
    return !isEqual(draft, projectToFormState(selectedProject));
  }, [draft, selectedProject]);

  // Check for unsaved repo changes
  const getRepoHasUnsavedChanges = useCallback(
    (repoId: string) => {
      const repo = repositories.find((r) => r.id === repoId);
      const repoDraft = repoDrafts[repoId];
      if (!repo || !repoDraft) return false;
      return !isEqual(repoDraft, repoToFormState(repo));
    },
    [repositories, repoDrafts]
  );

  const hasAnyUnsavedChanges = useMemo(() => {
    if (hasUnsavedProjectChanges) return true;
    return repositories.some((repo) => getRepoHasUnsavedChanges(repo.id));
  }, [hasUnsavedProjectChanges, repositories, getRepoHasUnsavedChanges]);

  // Handle project selection from dropdown
  const handleProjectSelect = useCallback(
    (id: string) => {
      if (id === selectedProjectId) return;

      if (hasAnyUnsavedChanges) {
        const confirmed = window.confirm(
          t('settings.projects.save.confirmSwitch')
        );
        if (!confirmed) return;

        setDraft(null);
        setSelectedProject(null);
        setRepoDrafts({});
        setExpandedRepos(new Set());
        setSuccess(false);
        setError(null);
      }

      setSelectedProjectId(id);
      if (id) {
        setSearchParams({ projectId: id });
      } else {
        setSearchParams({});
      }
    },
    [hasAnyUnsavedChanges, selectedProjectId, setSearchParams, t]
  );

  // Sync selectedProjectId when URL changes
  useEffect(() => {
    if (projectIdParam === selectedProjectId) return;

    if (hasAnyUnsavedChanges) {
      const confirmed = window.confirm(
        t('settings.projects.save.confirmSwitch')
      );
      if (!confirmed) {
        if (selectedProjectId) {
          setSearchParams({ projectId: selectedProjectId });
        } else {
          setSearchParams({});
        }
        return;
      }

      setDraft(null);
      setSelectedProject(null);
      setRepoDrafts({});
      setExpandedRepos(new Set());
      setSuccess(false);
      setError(null);
    }

    setSelectedProjectId(projectIdParam);
  }, [
    projectIdParam,
    hasAnyUnsavedChanges,
    selectedProjectId,
    setSearchParams,
    t,
  ]);

  // Populate draft from server data
  useEffect(() => {
    if (!projects) return;

    const nextProject = selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId)
      : null;

    setSelectedProject((prev) =>
      prev?.id === nextProject?.id ? prev : (nextProject ?? null)
    );

    if (!nextProject) {
      if (!hasUnsavedProjectChanges) setDraft(null);
      return;
    }

    if (hasUnsavedProjectChanges) return;

    setDraft(projectToFormState(nextProject));
  }, [projects, selectedProjectId, hasUnsavedProjectChanges]);

  // Warn on tab close/navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasAnyUnsavedChanges]);

  // Fetch repositories when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setRepositories([]);
      setRepoDrafts({});
      return;
    }

    setLoadingRepos(true);
    setRepoError(null);
    projectsApi
      .getRepositories(selectedProjectId)
      .then((repos) => {
        setRepositories(repos);
        // Initialize drafts for all repos
        const drafts: Record<string, RepoFormState> = {};
        repos.forEach((repo) => {
          drafts[repo.id] = repoToFormState(repo);
        });
        setRepoDrafts(drafts);
      })
      .catch((err) => {
        setRepoError(
          err instanceof Error ? err.message : 'Failed to load repositories'
        );
        setRepositories([]);
      })
      .finally(() => setLoadingRepos(false));
  }, [selectedProjectId]);

  // Toggle repo expansion
  const toggleRepoExpanded = (repoId: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  // Update repo draft
  const updateRepoDraft = (repoId: string, updates: Partial<RepoFormState>) => {
    setRepoDrafts((prev) => ({
      ...prev,
      [repoId]: { ...prev[repoId], ...updates },
    }));
  };

  // Save individual repo
  const handleSaveRepo = async (repoId: string) => {
    const repoDraft = repoDrafts[repoId];
    if (!repoDraft) return;

    setSavingRepoId(repoId);
    setRepoError(null);

    try {
      const updateData: UpdateRepo = {
        display_name: repoDraft.display_name.trim() || null,
        setup_script: repoDraft.setup_script.trim() || null,
        cleanup_script: repoDraft.cleanup_script.trim() || null,
        copy_files: repoDraft.copy_files.trim() || null,
        parallel_setup_script: repoDraft.parallel_setup_script,
        dev_server_script: repoDraft.dev_server_script.trim() || null,
      };

      const updatedRepo = await repoApi.update(repoId, updateData);
      setRepositories((prev) =>
        prev.map((r) => (r.id === repoId ? updatedRepo : r))
      );
      setRepoDrafts((prev) => ({
        ...prev,
        [repoId]: repoToFormState(updatedRepo),
      }));
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      setRepoSuccess(repoId);
      setTimeout(() => setRepoSuccess(null), 3000);
    } catch (err) {
      setRepoError(
        err instanceof Error ? err.message : 'Failed to save repository'
      );
    } finally {
      setSavingRepoId(null);
    }
  };

  // Discard repo changes
  const handleDiscardRepo = (repoId: string) => {
    const repo = repositories.find((r) => r.id === repoId);
    if (repo) {
      setRepoDrafts((prev) => ({
        ...prev,
        [repoId]: repoToFormState(repo),
      }));
    }
  };

  const handleAddRepository = async () => {
    if (!selectedProjectId) return;

    const repo = await RepoPickerDialog.show({
      title: 'Select Git Repository',
      description: 'Choose a git repository to add to this project',
    });

    if (!repo) return;

    if (repositories.some((r) => r.id === repo.id)) {
      return;
    }

    setAddingRepo(true);
    setRepoError(null);
    try {
      const newRepo = await projectsApi.addRepository(selectedProjectId, {
        display_name: repo.display_name,
        git_repo_path: repo.path,
      });
      setRepositories((prev) => [...prev, newRepo]);
      setRepoDrafts((prev) => ({
        ...prev,
        [newRepo.id]: repoToFormState(newRepo),
      }));
      // Auto-expand the newly added repo
      setExpandedRepos((prev) => new Set([...prev, newRepo.id]));
      queryClient.invalidateQueries({
        queryKey: ['projectRepositories', selectedProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ['repos'],
      });
      queryClient.invalidateQueries({
        queryKey: repoBranchKeys.byRepo(newRepo.id),
      });
    } catch (err) {
      setRepoError(
        err instanceof Error ? err.message : 'Failed to add repository'
      );
    } finally {
      setAddingRepo(false);
    }
  };

  const handleDeleteRepository = async (repoId: string) => {
    if (!selectedProjectId) return;

    const confirmed = window.confirm(
      'Are you sure you want to remove this repository from the project?'
    );
    if (!confirmed) return;

    setDeletingRepoId(repoId);
    setRepoError(null);
    try {
      await projectsApi.deleteRepository(selectedProjectId, repoId);
      setRepositories((prev) => prev.filter((r) => r.id !== repoId));
      setRepoDrafts((prev) => {
        const next = { ...prev };
        delete next[repoId];
        return next;
      });
      setExpandedRepos((prev) => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ['projectRepositories', selectedProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ['repos'],
      });
      queryClient.invalidateQueries({
        queryKey: repoBranchKeys.byRepo(repoId),
      });
    } catch (err) {
      setRepoError(
        err instanceof Error ? err.message : 'Failed to delete repository'
      );
    } finally {
      setDeletingRepoId(null);
    }
  };

  const { updateProject } = useProjectMutations({
    onUpdateSuccess: (updatedProject: Project) => {
      setSelectedProject(updatedProject);
      setDraft(projectToFormState(updatedProject));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setSaving(false);
    },
    onUpdateError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Failed to save project settings'
      );
      setSaving(false);
    },
  });

  const handleSave = async () => {
    if (!draft || !selectedProject) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: UpdateProject = {
        name: draft.name.trim(),
        default_agent_working_dir: null,
        git_auto_commit_enabled: draft.git_auto_commit_enabled,
        git_commit_title_mode: draft.git_commit_title_mode,
        auto_pr_on_review_enabled: draft.auto_pr_on_review_enabled,
        auto_pr_draft: draft.auto_pr_draft,
        redirect_to_attempt_on_create: draft.redirect_to_attempt_on_create,
      };

      updateProject.mutate({
        projectId: selectedProject.id,
        data: updateData,
      });
    } catch (err) {
      setError(t('settings.projects.save.error'));
      console.error('Error saving project settings:', err);
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!selectedProject) return;
    setDraft(projectToFormState(selectedProject));
  };

  const updateDraft = (updates: Partial<ProjectFormState>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('settings.projects.loading')}</span>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {projectsError instanceof Error
              ? projectsError.message
              : t('settings.projects.loadError')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {t('settings.projects.save.success')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.projects.title')}</CardTitle>
          <CardDescription>
            {t('settings.projects.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-selector">
              {t('settings.projects.selector.label')}
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectSelect}
            >
              <SelectTrigger id="project-selector">
                <SelectValue
                  placeholder={t('settings.projects.selector.placeholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {projects && projects.length > 0 ? (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-projects" disabled>
                    {t('settings.projects.selector.noProjects')}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t('settings.projects.selector.helper')}
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedProject && draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.projects.general.title')}</CardTitle>
              <CardDescription>
                {t('settings.projects.general.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">
                  {t('settings.projects.general.name.label')}
                </Label>
                <Input
                  id="project-name"
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  placeholder={t('settings.projects.general.name.placeholder')}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t('settings.projects.general.name.helper')}
                </p>
              </div>

              {/* Save Button for Project */}
              <div className="flex items-center justify-between pt-4 border-t">
                {hasUnsavedProjectChanges ? (
                  <span className="text-sm text-muted-foreground">
                    {t('settings.projects.save.unsavedChanges')}
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDiscard}
                    disabled={saving || !hasUnsavedProjectChanges}
                  >
                    {t('settings.projects.save.discard')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedProjectChanges}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('settings.projects.save.saving')}
                      </>
                    ) : (
                      t('settings.projects.save.button')
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Git & Workflow Settings */}
          <GitProjectSettings
            gitAutoCommitEnabled={draft.git_auto_commit_enabled}
            gitCommitTitleMode={draft.git_commit_title_mode}
            autoPrOnReviewEnabled={draft.auto_pr_on_review_enabled}
            autoPrDraft={draft.auto_pr_draft}
            redirectToAttemptOnCreate={draft.redirect_to_attempt_on_create}
            onChange={(updates) => updateDraft(updates)}
          />

          {/* Repositories Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.repos.title')}</CardTitle>
              <CardDescription>
                {t('settings.repos.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {repoError && (
                <Alert variant="destructive">
                  <AlertDescription>{repoError}</AlertDescription>
                </Alert>
              )}

              {loadingRepos ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading repositories...
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {repositories.map((repo) => {
                    const repoDraft = repoDrafts[repo.id];
                    const isExpanded = expandedRepos.has(repo.id);
                    const hasChanges = getRepoHasUnsavedChanges(repo.id);
                    const isSaving = savingRepoId === repo.id;
                    const showSuccess = repoSuccess === repo.id;

                    return (
                      <div
                        key={repo.id}
                        className={`border rounded-lg ${hasChanges ? 'border-primary/50' : ''}`}
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleRepoExpanded(repo.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium flex items-center gap-2">
                                {repo.display_name}
                                {hasChanges && (
                                  <span className="text-xs text-primary">
                                    (unsaved)
                                  </span>
                                )}
                                {showSuccess && (
                                  <span className="text-xs text-green-600">
                                    ✓ Saved
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {repo.path}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRepository(repo.id);
                              }}
                              disabled={deletingRepoId === repo.id}
                              title="Remove repository"
                            >
                              {deletingRepoId === repo.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && repoDraft && (
                          <div className="px-4 pb-4 pt-2 border-t space-y-4">
                            {/* Display Name */}
                            <div className="space-y-2">
                              <Label>
                                {t('settings.repos.general.displayName.label')}
                              </Label>
                              <Input
                                type="text"
                                value={repoDraft.display_name}
                                onChange={(e) =>
                                  updateRepoDraft(repo.id, {
                                    display_name: e.target.value,
                                  })
                                }
                                placeholder={t(
                                  'settings.repos.general.displayName.placeholder'
                                )}
                              />
                            </div>

                            {/* Dev Server Script */}
                            <div className="space-y-2">
                              <Label>
                                {t('settings.repos.scripts.devServer.label')}
                              </Label>
                              <AutoExpandingTextarea
                                value={repoDraft.dev_server_script}
                                onChange={(e) =>
                                  updateRepoDraft(repo.id, {
                                    dev_server_script: e.target.value,
                                  })
                                }
                                placeholder={placeholders.dev}
                                maxRows={8}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                              />
                              <p className="text-sm text-muted-foreground">
                                {t('settings.repos.scripts.devServer.helper')}
                              </p>
                            </div>

                            {/* Setup Script */}
                            <div className="space-y-2">
                              <Label>
                                {t('settings.repos.scripts.setup.label')}
                              </Label>
                              <AutoExpandingTextarea
                                value={repoDraft.setup_script}
                                onChange={(e) =>
                                  updateRepoDraft(repo.id, {
                                    setup_script: e.target.value,
                                  })
                                }
                                placeholder={placeholders.setup}
                                maxRows={8}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                              />
                              <p className="text-sm text-muted-foreground">
                                {t('settings.repos.scripts.setup.helper')}
                              </p>

                              <div className="flex items-center space-x-2 pt-1">
                                <Checkbox
                                  id={`parallel-setup-${repo.id}`}
                                  checked={repoDraft.parallel_setup_script}
                                  onCheckedChange={(checked) =>
                                    updateRepoDraft(repo.id, {
                                      parallel_setup_script: checked === true,
                                    })
                                  }
                                  disabled={!repoDraft.setup_script.trim()}
                                />
                                <Label
                                  htmlFor={`parallel-setup-${repo.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {t(
                                    'settings.repos.scripts.setup.parallelLabel'
                                  )}
                                </Label>
                              </div>
                            </div>

                            {/* Cleanup Script */}
                            <div className="space-y-2">
                              <Label>
                                {t('settings.repos.scripts.cleanup.label')}
                              </Label>
                              <AutoExpandingTextarea
                                value={repoDraft.cleanup_script}
                                onChange={(e) =>
                                  updateRepoDraft(repo.id, {
                                    cleanup_script: e.target.value,
                                  })
                                }
                                placeholder={placeholders.cleanup}
                                maxRows={8}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                              />
                              <p className="text-sm text-muted-foreground">
                                {t('settings.repos.scripts.cleanup.helper')}
                              </p>
                            </div>

                            {/* Copy Files */}
                            <div className="space-y-2">
                              <Label>
                                {t('settings.repos.scripts.copyFiles.label')}
                              </Label>
                              <MultiFileSearchTextarea
                                value={repoDraft.copy_files}
                                onChange={(value) =>
                                  updateRepoDraft(repo.id, {
                                    copy_files: value,
                                  })
                                }
                                placeholder={t(
                                  'settings.repos.scripts.copyFiles.placeholder'
                                )}
                                maxRows={4}
                                repoId={repo.id}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                              />
                              <p className="text-sm text-muted-foreground">
                                {t('settings.repos.scripts.copyFiles.helper')}
                              </p>
                            </div>

                            {/* Save/Discard Buttons for Repo */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDiscardRepo(repo.id)}
                                disabled={!hasChanges || isSaving}
                              >
                                {t('settings.repos.save.discard')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveRepo(repo.id)}
                                disabled={!hasChanges || isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 mr-2" />
                                )}
                                {t('settings.repos.save.button')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {repositories.length === 0 && !loadingRepos && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No repositories configured
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddRepository}
                    disabled={addingRepo}
                    className="w-full"
                  >
                    {addingRepo ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Repository
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sticky Save Button for unsaved changes */}
          {hasAnyUnsavedChanges && (
            <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-sm border-t py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('settings.projects.save.unsavedChanges')}
                </span>
                <div className="flex gap-2">
                  {hasUnsavedProjectChanges && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleDiscard}
                        disabled={saving}
                      >
                        {t('settings.projects.save.discard')}
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t('settings.projects.save.button')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
