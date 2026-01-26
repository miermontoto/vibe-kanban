import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useActiveTasksAcrossProjects,
  useNavigateWithSearch,
} from '@/hooks';
import { paths } from '@/lib/paths';
import { statusLabels, statusBoardColors } from '@/utils/statusLabels';
import type { TaskStatus } from 'shared/types';

interface ActiveTaskItemProps {
  task: {
    id: string;
    project_id: string;
    title: string;
    status: TaskStatus;
    project_name: string;
    has_in_progress_attempt: boolean;
    last_attempt_failed: boolean;
    pr_number?: number | bigint | null;
    pr_url?: string | null;
  };
}

function ActiveTaskItem({ task }: ActiveTaskItemProps) {
  const navigate = useNavigateWithSearch();

  const handleClick = () => {
    navigate(paths.task(task.project_id, task.id));
  };

  return (
    <div
      className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: `hsl(var(${statusBoardColors[task.status]}))`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{task.title}</span>
            {task.has_in_progress_attempt && (
              <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
            )}
            {task.last_attempt_failed && (
              <XCircle className="h-3 w-3 text-destructive shrink-0" />
            )}
            {task.pr_number != null && task.pr_url && (
              <a
                href={task.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                #{task.pr_number.toString()}
              </a>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate block">
            {task.project_name}
          </span>
        </div>
      </div>
      <Badge variant="outline" className="shrink-0 ml-2">
        {statusLabels[task.status]}
      </Badge>
    </div>
  );
}

export function ActiveTasksDashboard() {
  const { t } = useTranslation('projects');
  const { tasksByStatus, isLoading, error } = useActiveTasksAcrossProjects();
  const [isExpanded, setIsExpanded] = useState(true);

  const inProgressCount = tasksByStatus.inprogress.length;
  const inReviewCount = tasksByStatus.inreview.length;
  const totalCount = inProgressCount + inReviewCount;

  // Sort tasks: inprogress first, then inreview
  const sortedTasks = useMemo(() => {
    return [...tasksByStatus.inprogress, ...tasksByStatus.inreview];
  }, [tasksByStatus]);

  // Don't render if no active tasks and not loading
  if (!isLoading && totalCount === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <CardTitle className="text-lg">
              {t('dashboard.activeTasks')}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {inProgressCount > 0 && (
              <span className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(${statusBoardColors.inprogress}))`,
                  }}
                />
                {inProgressCount} {t('dashboard.inProgress')}
              </span>
            )}
            {inReviewCount > 0 && (
              <span className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(${statusBoardColors.inreview}))`,
                  }}
                />
                {inReviewCount} {t('dashboard.inReview')}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('dashboard.loading')}
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-4 text-center">
              {t('dashboard.error')}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map((task) => (
                <ActiveTaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
