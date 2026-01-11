import { memo, useCallback, useMemo } from 'react';
import { useAuth, useCollapsedCards } from '@/hooks';
import { useCollapsedColumns } from '@/hooks/useCollapsedColumns';
import {
  type DragEndEvent,
  KanbanBoard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/shadcn-io/kanban';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus, TaskWithAttemptStatus } from 'shared/types';
import { statusBoardColors, statusLabels } from '@/utils/statusLabels';
import type { SharedTaskRecord } from '@/hooks/useProjectTasks';
import { SharedTaskCard } from './SharedTaskCard';
import { Layers } from 'lucide-react';
import type { KanbanColumnItem, KanbanColumns } from './TaskKanbanBoard';

interface EpicSwimlaneProps {
  epic: Task | null; // null representa tareas sin epic ("No Epic" lane)
  columns: KanbanColumns;
  onDragEnd: (event: DragEndEvent) => void;
  onViewTaskDetails: (task: TaskWithAttemptStatus) => void;
  onViewSharedTask?: (task: SharedTaskRecord) => void;
  selectedTaskId?: string;
  selectedSharedTaskId?: string | null;
  onCreateTask?: () => void;
  projectId: string;
}

/** obtener un unique card ID para collapse state tracking */
function getCardId(item: KanbanColumnItem): string {
  return item.type === 'shared' ? `shared-${item.task.id}` : item.task.id;
}

function EpicSwimlane({
  epic,
  columns,
  onDragEnd,
  onViewTaskDetails,
  onViewSharedTask,
  selectedTaskId,
  selectedSharedTaskId,
  onCreateTask,
  projectId,
}: EpicSwimlaneProps) {
  const { userId } = useAuth();
  const {
    isCollapsed,
    toggleCollapsed,
    collapseAll,
    expandAll,
    areAllCollapsed,
  } = useCollapsedCards(projectId);
  const { isColumnCollapsed, toggleColumnCollapsed } =
    useCollapsedColumns(projectId);

  // compute card IDs per column for bulk collapse/expand
  const columnCardIds = useMemo(() => {
    const result: Record<TaskStatus, string[]> = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
      cancelled: [],
    };

    Object.entries(columns).forEach(([status, items]) => {
      const statusKey = status as TaskStatus;
      result[statusKey] = items.map(getCardId);
    });

    return result;
  }, [columns]);

  const handleCollapseColumn = useCallback(
    (status: TaskStatus) => {
      collapseAll(columnCardIds[status]);
    },
    [collapseAll, columnCardIds]
  );

  const handleExpandColumn = useCallback(
    (status: TaskStatus) => {
      expandAll(columnCardIds[status]);
    },
    [expandAll, columnCardIds]
  );

  return (
    <div className="mb-8 border-b pb-4">
      {/* Epic Header */}
      <div className="mb-4 flex items-center gap-2 px-2">
        {epic ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <Layers className="h-4 w-4" />
              <span className="font-semibold">{epic.title}</span>
            </div>
            {epic.description && (
              <span className="text-sm text-muted-foreground">
                {epic.description.length > 80
                  ? `${epic.description.substring(0, 80)}...`
                  : epic.description}
              </span>
            )}
          </>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            <span className="font-semibold">No Epic</span>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <KanbanProvider onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {Object.entries(columns).map(([status, items]) => {
            const statusKey = status as TaskStatus;
            const cardIds = columnCardIds[statusKey];
            const allCollapsed = areAllCollapsed(cardIds);
            const columnCollapsed = isColumnCollapsed(statusKey);

            return (
              <KanbanBoard
                key={status}
                id={statusKey}
                collapsed={columnCollapsed}
              >
                <KanbanHeader
                  name={statusLabels[statusKey]}
                  color={statusBoardColors[statusKey]}
                  onAddTask={onCreateTask}
                  onCollapseAll={() => handleCollapseColumn(statusKey)}
                  onExpandAll={() => handleExpandColumn(statusKey)}
                  allCollapsed={allCollapsed}
                  onToggleColumnCollapsed={() =>
                    toggleColumnCollapsed(statusKey)
                  }
                  columnCollapsed={columnCollapsed}
                  taskCount={items.length}
                />
                {!columnCollapsed && (
                  <KanbanCards>
                    {items.map((item, index) => {
                      const isOwnTask =
                        item.type === 'task' &&
                        (!item.sharedTask?.assignee_user_id ||
                          !userId ||
                          item.sharedTask?.assignee_user_id === userId);

                      if (isOwnTask) {
                        return (
                          <TaskCard
                            key={item.task.id}
                            task={item.task}
                            index={index}
                            status={statusKey}
                            onViewDetails={onViewTaskDetails}
                            isOpen={selectedTaskId === item.task.id}
                            projectId={projectId}
                            sharedTask={item.sharedTask}
                            isCollapsed={isCollapsed(item.task.id)}
                            onToggleCollapsed={toggleCollapsed}
                          />
                        );
                      }

                      const sharedTask =
                        item.type === 'shared' ? item.task : item.sharedTask!;
                      const cardId = getCardId(item);

                      return (
                        <SharedTaskCard
                          key={cardId}
                          task={sharedTask}
                          index={index}
                          status={statusKey}
                          isSelected={selectedSharedTaskId === item.task.id}
                          onViewDetails={onViewSharedTask}
                          isCollapsed={isCollapsed(cardId)}
                          onToggleCollapsed={toggleCollapsed}
                        />
                      );
                    })}
                  </KanbanCards>
                )}
              </KanbanBoard>
            );
          })}
        </div>
      </KanbanProvider>
    </div>
  );
}

export default memo(EpicSwimlane);
