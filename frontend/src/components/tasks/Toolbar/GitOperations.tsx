import {
  GitBranch as GitBranchIcon,
  GitPullRequest,
  RefreshCw,
  ArrowDownUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { useMemo, useState } from 'react';
import type {
  RepoBranchStatus,
  Merge,
  TaskWithAttemptStatus,
  Workspace,
} from 'shared/types';
import { RebaseDialog } from '@/components/dialogs/tasks/RebaseDialog';
import { CreatePRDialog } from '@/components/dialogs/tasks/CreatePRDialog';
import { useTranslation } from 'react-i18next';
import { BranchStatusInfo } from '@/components/tasks/BranchStatusInfo';
import { useRepoStatusOperations } from '@/hooks/useRepoStatusOperations';
import { useContainerWidth } from '@/hooks/useContainerWidth';

interface GitOperationsProps {
  selectedAttempt: Workspace;
  task: TaskWithAttemptStatus;
  branchStatus: RepoBranchStatus[] | null;
  branchStatusError?: Error | null;
  isAttemptRunning: boolean;
  selectedBranch: string | null;
  layout?: 'horizontal' | 'vertical';
}

export type GitOperationsInputs = Omit<GitOperationsProps, 'selectedAttempt'>;

function GitOperations({
  selectedAttempt,
  task,
  branchStatus,
  branchStatusError,
  isAttemptRunning,
  selectedBranch,
  layout = 'horizontal',
}: GitOperationsProps) {
  const { t } = useTranslation('tasks');

  // detectar el ancho del contenedor de acciones para responsive labels
  const [actionsWidth, actionsRef] = useContainerWidth<HTMLDivElement>();

  // use custom hook for repo status operations
  const {
    repos,
    selectedRepoId,
    setSelectedRepoId,
    selectedRepoStatus,
    hasConflicts: hasConflictsCalculated,
    getSelectedRepoId,
    handleChangeTargetBranchDialogOpen,
    git,
    branches,
  } = useRepoStatusOperations(selectedAttempt.id, branchStatus);

  // Local state for git operations
  const [merging, setMerging] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [rebasing, setRebasing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Memoize merge status information to avoid repeated calculations
  const mergeInfo = useMemo(() => {
    if (!selectedRepoStatus?.merges)
      return {
        hasOpenPR: false,
        openPR: null,
        hasMergedPR: false,
        mergedPR: null,
        hasMerged: false,
        latestMerge: null,
      };

    const openPR = selectedRepoStatus.merges.find(
      (m: Merge) => m.type === 'pr' && m.pr_info.status === 'open'
    );

    const mergedPR = selectedRepoStatus.merges.find(
      (m: Merge) => m.type === 'pr' && m.pr_info.status === 'merged'
    );

    const merges = selectedRepoStatus.merges.filter(
      (m: Merge) =>
        m.type === 'direct' ||
        (m.type === 'pr' && m.pr_info.status === 'merged')
    );

    return {
      hasOpenPR: !!openPR,
      openPR,
      hasMergedPR: !!mergedPR,
      mergedPR,
      hasMerged: merges.length > 0,
      latestMerge: selectedRepoStatus.merges[0] || null, // Most recent merge
    };
  }, [selectedRepoStatus]);

  const mergeButtonLabel = useMemo(() => {
    if (mergeSuccess) return t('git.states.merged');
    if (merging) return t('git.states.merging');
    return t('git.states.merge');
  }, [mergeSuccess, merging, t]);

  const rebaseButtonLabel = useMemo(() => {
    if (rebasing) return t('git.states.rebasing');
    return t('git.states.rebase');
  }, [rebasing, t]);

  const syncButtonLabel = useMemo(() => {
    if (syncSuccess) return t('git.states.synced', 'Synced');
    if (syncing) return t('git.states.syncing', 'Syncing');
    return t('git.states.sync', 'Sync');
  }, [syncSuccess, syncing, t]);

  const prButtonLabel = useMemo(() => {
    if (mergeInfo.hasOpenPR) {
      return pushSuccess
        ? t('git.states.pushed')
        : pushing
          ? t('git.states.pushing')
          : t('git.states.push');
    }
    return t('git.states.createPr');
  }, [mergeInfo.hasOpenPR, pushSuccess, pushing, t]);

  const handleMergeClick = async () => {
    // Directly perform merge without checking branch status
    await performMerge();
  };

  const handlePushClick = async () => {
    try {
      setPushing(true);
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.push({ repo_id: repoId });
      setPushSuccess(true);
      setTimeout(() => setPushSuccess(false), 2000);
    } finally {
      setPushing(false);
    }
  };

  const performMerge = async () => {
    try {
      setMerging(true);
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.merge({
        repoId,
      });
      setMergeSuccess(true);
      setTimeout(() => setMergeSuccess(false), 2000);
    } finally {
      setMerging(false);
    }
  };

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      const targetBranch = selectedRepoStatus?.target_branch_name;
      if (!targetBranch) return;

      // rebase task branch onto the current target branch (pulling latest upstream changes)
      await git.actions.rebase({
        repoId,
        newBaseBranch: targetBranch,
        oldBaseBranch: targetBranch,
      });
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2000);
    } finally {
      setSyncing(false);
    }
  };

  const handleRebaseWithNewBranchAndUpstream = async (
    newBaseBranch: string,
    selectedUpstream: string
  ) => {
    setRebasing(true);
    try {
      const repoId = getSelectedRepoId();
      if (!repoId) return;
      await git.actions.rebase({
        repoId,
        newBaseBranch: newBaseBranch,
        oldBaseBranch: selectedUpstream,
      });
    } finally {
      setRebasing(false);
    }
  };

  const handleRebaseDialogOpen = async () => {
    try {
      const defaultTargetBranch = selectedRepoStatus?.target_branch_name;
      const result = await RebaseDialog.show({
        branches,
        isRebasing: rebasing,
        initialTargetBranch: defaultTargetBranch,
        initialUpstreamBranch: defaultTargetBranch,
      });
      if (
        result.action === 'confirmed' &&
        result.branchName &&
        result.upstreamBranch
      ) {
        await handleRebaseWithNewBranchAndUpstream(
          result.branchName,
          result.upstreamBranch
        );
      }
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  const handlePRButtonClick = async () => {
    // If PR already exists, push to it
    if (mergeInfo.hasOpenPR) {
      await handlePushClick();
      return;
    }

    CreatePRDialog.show({
      attempt: selectedAttempt,
      task,
      repoId: getSelectedRepoId(),
      targetBranch: selectedRepoStatus?.target_branch_name,
    });
  };

  const isVertical = layout === 'vertical';

  // determinar si mostrar labels basado en el ancho disponible del contenedor padre
  // cuando el container es estrecho (< 600px), ocultamos las labels
  // esto previene que BranchStatusInfo sea empujado fuera de vista
  const showLabels = isVertical || actionsWidth === 0 || actionsWidth >= 600;

  const actionsClasses = isVertical
    ? 'flex flex-wrap items-center gap-2'
    : 'shrink-0 flex flex-wrap items-center gap-2 overflow-y-hidden overflow-x-visible max-h-8';

  return (
    <div className="w-full border-b py-2">
      <div
        ref={actionsRef}
        className={
          isVertical
            ? 'grid grid-cols-1 items-start gap-3 overflow-hidden'
            : 'flex items-center justify-between gap-2 overflow-hidden'
        }
      >
        <BranchStatusInfo
          selectedAttempt={selectedAttempt}
          branchStatus={branchStatus}
          selectedRepoStatus={selectedRepoStatus ?? null}
          isAttemptRunning={isAttemptRunning}
          selectedBranch={selectedBranch}
          layout={layout}
          repos={repos}
          selectedRepoId={selectedRepoId}
          onRepoSelect={setSelectedRepoId}
          onChangeTargetBranch={handleChangeTargetBranchDialogOpen}
          hasConflicts={hasConflictsCalculated}
        />

        {/* Right: Actions */}
        {branchStatusError && !selectedRepoStatus ? (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t('git.errors.branchStatusUnavailable')}</span>
          </div>
        ) : selectedRepoStatus ? (
          <div className={actionsClasses}>
            <Button
              onClick={handleSyncClick}
              disabled={
                !selectedRepoStatus ||
                syncing ||
                hasConflictsCalculated ||
                isAttemptRunning ||
                (selectedRepoStatus?.commits_behind ?? 0) === 0
              }
              variant="outline"
              size="xs"
              className="border-purple-500 text-purple-500 hover:bg-purple-500 gap-1 shrink-0"
              aria-label={syncButtonLabel}
            >
              <ArrowDownUp
                className={`h-3.5 w-3.5 ${syncing ? 'animate-bounce' : ''}`}
              />
              {showLabels && (
                <span className="truncate max-w-[10ch]">{syncButtonLabel}</span>
              )}
            </Button>

            <Button
              onClick={handleMergeClick}
              disabled={
                !selectedRepoStatus ||
                mergeInfo.hasMergedPR ||
                mergeInfo.hasOpenPR ||
                merging ||
                hasConflictsCalculated ||
                isAttemptRunning ||
                (selectedRepoStatus?.commits_ahead ?? 0) === 0
              }
              variant="outline"
              size="xs"
              className="border-success text-success hover:bg-success gap-1 shrink-0"
              aria-label={mergeButtonLabel}
            >
              <GitBranchIcon className="h-3.5 w-3.5" />
              {showLabels && (
                <span className="truncate max-w-[10ch]">{mergeButtonLabel}</span>
              )}
            </Button>

            <Button
              onClick={handlePRButtonClick}
              disabled={
                !selectedRepoStatus ||
                mergeInfo.hasMergedPR ||
                pushing ||
                isAttemptRunning ||
                hasConflictsCalculated ||
                (mergeInfo.hasOpenPR &&
                  (selectedRepoStatus?.remote_commits_ahead ?? 0) === 0)
              }
              variant="outline"
              size="xs"
              className="border-info text-info hover:bg-info gap-1 shrink-0"
              aria-label={prButtonLabel}
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              {showLabels && (
                <span className="truncate max-w-[10ch]">{prButtonLabel}</span>
              )}
            </Button>

            <Button
              onClick={handleRebaseDialogOpen}
              disabled={
                !selectedRepoStatus ||
                rebasing ||
                isAttemptRunning ||
                hasConflictsCalculated
              }
              variant="outline"
              size="xs"
              className="border-warning text-warning hover:bg-warning gap-1 shrink-0"
              aria-label={rebaseButtonLabel}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${rebasing ? 'animate-spin' : ''}`}
              />
              {showLabels && (
                <span className="truncate max-w-[10ch]">{rebaseButtonLabel}</span>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default GitOperations;
