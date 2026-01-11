-- agregar task_type enum y parent_task_id para soporte de EPICs y SUBTASKs
-- permite organización jerárquica: EPIC -> STORY -> SUBTASK

-- agregar columna task_type (default 'story' para backward compatibility)
ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'story'
    CHECK (task_type IN ('epic', 'story', 'subtask'));

-- agregar parent_task_id para relación lógica parent-child
-- distinto de parent_workspace_id (que es para execution context)
ALTER TABLE tasks ADD COLUMN parent_task_id BLOB
    REFERENCES tasks(id) ON DELETE CASCADE;

-- indexes para performance en queries jerárquicos
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);

-- index compuesto para filtrar por project + task_type (swimlane queries)
CREATE INDEX idx_tasks_project_task_type ON tasks(project_id, task_type);
