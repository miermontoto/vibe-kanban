import { useCallback, useState } from 'react';
import { sessionsApi } from '@/lib/api';
import type { CreateFollowUpAttempt, ExecutionProcess } from 'shared/types';
import { ExecutionProcessStatus, BaseCodingAgent } from 'shared/types';

type Args = {
  sessionId?: string;
  message: string;
  conflictMarkdown: string | null;
  reviewMarkdown: string;
  clickedMarkdown?: string;
  selectedVariant: string | null;
  clearComments: () => void;
  clearClickedElements?: () => void;
  onAfterSendCleanup: () => void;
  onOptimisticProcess?: (process: ExecutionProcess) => void;
  onRemoveOptimisticProcess?: (processId: string) => void;
};

export function useFollowUpSend({
  sessionId,
  message,
  conflictMarkdown,
  reviewMarkdown,
  clickedMarkdown,
  selectedVariant,
  clearComments,
  clearClickedElements,
  onAfterSendCleanup,
  onOptimisticProcess,
  onRemoveOptimisticProcess,
}: Args) {
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const onSendFollowUp = useCallback(async () => {
    if (!sessionId) return;
    const extraMessage = message.trim();
    const finalPrompt = [
      conflictMarkdown,
      clickedMarkdown?.trim(),
      reviewMarkdown?.trim(),
      extraMessage,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!finalPrompt) return;

    // guardar ID del proceso optimista para poder eliminarlo en caso de error
    let optimisticProcessId: string | null = null;

    try {
      setIsSendingFollowUp(true);
      setFollowUpError(null);
      const body: CreateFollowUpAttempt = {
        prompt: finalPrompt,
        variant: selectedVariant,
        retry_process_id: null,
        force_when_dirty: null,
        perform_git_reset: null,
      };

      // crear proceso optimista inmediatamente
      if (onOptimisticProcess) {
        optimisticProcessId = `optimistic-${Date.now()}`;
        const optimisticProcess: ExecutionProcess = {
          id: optimisticProcessId,
          session_id: sessionId,
          run_reason: 'codingagent',
          executor_action: {
            typ: {
              type: 'CodingAgentFollowUpRequest',
              prompt: finalPrompt,
              session_id: sessionId,
              executor_profile_id: {
                executor: BaseCodingAgent.CLAUDE_CODE,
                variant: selectedVariant,
              },
              working_dir: null,
            },
            next_action: null,
          },
          status: ExecutionProcessStatus.running,
          exit_code: null,
          dropped: false,
          started_at: new Date().toISOString(),
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        onOptimisticProcess(optimisticProcess);
      }

      await sessionsApi.followUp(sessionId, body);
      clearComments();
      clearClickedElements?.();
      onAfterSendCleanup();
      // Don't call jumpToLogsTab() - preserves focus on the follow-up editor
    } catch (error: unknown) {
      // eliminar proceso optimista inmediatamente en caso de error
      if (optimisticProcessId && onRemoveOptimisticProcess) {
        onRemoveOptimisticProcess(optimisticProcessId);
      }

      const err = error as { message?: string };
      setFollowUpError(
        `Failed to start follow-up execution: ${err.message ?? 'Unknown error'}`
      );
    } finally {
      setIsSendingFollowUp(false);
    }
  }, [
    sessionId,
    message,
    conflictMarkdown,
    reviewMarkdown,
    clickedMarkdown,
    selectedVariant,
    clearComments,
    clearClickedElements,
    onAfterSendCleanup,
    onOptimisticProcess,
    onRemoveOptimisticProcess,
  ]);

  return {
    isSendingFollowUp,
    followUpError,
    setFollowUpError,
    onSendFollowUp,
  } as const;
}
