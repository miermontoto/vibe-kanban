-- Create task_labels table for task categorization/filtering
CREATE TABLE task_labels (
    id          BLOB PRIMARY KEY,
    project_id  BLOB NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,  -- hex color code (e.g., #FF5733)
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, name)  -- label names must be unique per project
);

CREATE INDEX idx_task_labels_project_id ON task_labels(project_id);

-- Create task_label_associations junction table (many-to-many relationship)
CREATE TABLE task_label_associations (
    task_id     BLOB NOT NULL,
    label_id    BLOB NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES task_labels(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_label_associations_task_id ON task_label_associations(task_id);
CREATE INDEX idx_task_label_associations_label_id ON task_label_associations(label_id);
