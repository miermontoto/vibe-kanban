import { useCallback, useEffect, useRef, useState } from 'react';
import { KanbanCard } from '@/components/ui/shadcn-io/kanban';
import {
  ChevronDown,
  ChevronRight,
  Link,
  Loader2,
  Play,
  XCircle,
  Layers,
  FileText,
  CheckSquare,
} from 'lucide-react';
import type { TaskWithAttemptStatus, TaskType } from 'shared/types';
import { ActionsDropdown } from '@/components/ui/actions-dropdown';
import { Button } from '@/components/ui/button';
import { useNavigateWithSearch } from '@/hooks';
import { paths } from '@/lib/paths';
import { attemptsApi } from '@/lib/api';
import type { SharedTaskRecord } from '@/hooks/useProjectTasks';
import { TaskCardHeader } from './TaskCardHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks';
import { CreateAttemptDialog } from '@/components/dialogs/tasks/CreateAttemptDialog';
import { cn } from '@/lib/utils';

type Task = TaskWithAttemptStatus;

interface TaskCardProps {
  task: Task;
  index: number;
  status: string;
  onViewDetails: (task: Task) => void;
  isOpen?: boolean;
  projectId: string;
  sharedTask?: SharedTaskRecord;
  isCollapsed?: boolean;
  onToggleCollapsed?: (taskId: string) => void;
}

// helper para obtener icono y estilo según task_type
function getTaskTypeConfig(taskType: TaskType) {
  switch (taskType) {
    case 'epic':
      return {
        icon: Layers,
        label: 'Epic',
        className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        borderClass: 'border-l-4 border-l-purple-500',
      };
    case 'subtask':
      return {
        icon: CheckSquare,
        label: 'Subtask',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        borderClass: 'border-l-2 border-l-blue-400',
      };
    case 'story':
    default:
      return {
        icon: FileText,
        label: 'Story',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
        borderClass: '',
      };
  }
}

export function TaskCard({
  task,
  index,
  status,
  onViewDetails,
  isOpen,
  projectId,
  sharedTask,
  isCollapsed = false,
  onToggleCollapsed,
}: TaskCardProps) {
  const { t } = useTranslation('tasks');
  const navigate = useNavigateWithSearch();
  const [isNavigatingToParent, setIsNavigatingToParent] = useState(false);
  const { isSignedIn } = useAuth();

  const handleClick = useCallback(() => {
    onViewDetails(task);
  }, [task, onViewDetails]);

  const handleStartTask = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      CreateAttemptDialog.show({ taskId: task.id });
    },
    [task.id]
  );

  const handleParentClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!task.parent_workspace_id || isNavigatingToParent) return;

      setIsNavigatingToParent(true);
      try {
        const parentAttempt = await attemptsApi.get(task.parent_workspace_id);
        navigate(
          paths.attempt(
            projectId,
            parentAttempt.task_id,
            task.parent_workspace_id
          )
        );
      } catch (error) {
        console.error('Failed to navigate to parent task attempt:', error);
        setIsNavigatingToParent(false);
      }
    },
    [task.parent_workspace_id, projectId, navigate, isNavigatingToParent]
  );

  const handleToggleCollapsed = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapsed?.(task.id);
    },
    [task.id, onToggleCollapsed]
  );

  const localRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !localRef.current) return;
    const el = localRef.current;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  }, [isOpen]);

  const hasExpandableContent = task.description;
  const taskTypeConfig = getTaskTypeConfig(task.task_type);
  const TaskTypeIcon = taskTypeConfig.icon;

  return (
    <KanbanCard
      key={task.id}
      id={task.id}
      name={task.title}
      index={index}
      parent={status}
      onClick={handleClick}
      isOpen={isOpen}
      forwardedRef={localRef}
      dragDisabled={(!!sharedTask || !!task.shared_task_id) && !isSignedIn}
      className={cn(
        taskTypeConfig.borderClass,
        sharedTask || task.shared_task_id
          ? 'relative overflow-hidden pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-card-foreground before:content-[""]'
          : undefined,
        task.task_type === 'subtask' ? 'ml-4' : undefined
      )}
    >
      <div className="flex flex-col gap-2">
        <TaskCardHeader
          title={
            <span className="flex items-center gap-1.5">
              {hasExpandableContent && onToggleCollapsed && (
                <Button
                  variant="icon"
                  onClick={handleToggleCollapsed}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="h-4 w-4 p-0 -ml-1 shrink-0"
                  title={isCollapsed ? t('expand') : t('collapse')}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              )}
              <span className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0',
                taskTypeConfig.className
              )}>
                <TaskTypeIcon className="h-3 w-3" />
                {task.task_type === 'epic' && 'Epic'}
                {task.task_type === 'subtask' && 'Sub'}
              </span>
              <span className="truncate">{task.title}</span>
              {task.pr_number != null && task.pr_url && (
                <a
                  href={task.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={`Pull Request #${task.pr_number.toString()}`}
                >
                  #{task.pr_number.toString()}
                </a>
              )}
            </span>
          }
          avatar={
            sharedTask
              ? {
                  firstName: sharedTask.assignee_first_name ?? undefined,
                  lastName: sharedTask.assignee_last_name ?? undefined,
                  username: sharedTask.assignee_username ?? undefined,
                }
              : undefined
          }
          right={
            <>
              {task.has_in_progress_attempt && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {task.last_attempt_failed && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {status === 'todo' &&
                !task.has_in_progress_attempt &&
                !task.last_attempt_failed && (
                  <Button
                    variant="icon"
                    onClick={handleStartTask}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    title={t('startTask')}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
              {task.parent_workspace_id && (
                <Button
                  variant="icon"
                  onClick={handleParentClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isNavigatingToParent}
                  title={t('navigateToParent')}
                >
                  <Link className="h-4 w-4" />
                </Button>
              )}
              <ActionsDropdown task={task} sharedTask={sharedTask} />
            </>
          }
        />
        {!isCollapsed && task.description && (
          <p className="text-sm text-secondary-foreground break-words">
            {task.description.length > 130
              ? `${task.description.substring(0, 130)}...`
              : task.description}
          </p>
        )}
      </div>
    </KanbanCard>
  );
}
